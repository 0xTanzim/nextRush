/**
 * @nextrush/adapter-node — per-request-work-trim regression contract
 *
 * Executable contract for OpenSpec change `node-adapter-per-request-work-trim`
 * (hot-path review P1). Pins the byte-identical observable behavior of `ctx.ip`
 * and `ctx.next()` (characterization tests, green before and after the trims)
 * AND proves each trim actually happened (the optimization-assertion tests,
 * RED before implementation):
 *
 *  - HP-1: `trustProxy: false` sets `ctx.ip` directly from the socket without
 *          invoking the proxy-header resolution policy (`resolveClientIp`).
 *  - HP-4: `createHandler` reuses one frozen `{ trustProxy }` options object
 *          across requests instead of allocating per request.
 *  - HP-7: `ctx.next()` forwards the wired dispatch thunk directly (returns its
 *          exact promise) rather than wrapping it in an extra `async` frame.
 */

import { createApp } from '@nextrush/core';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Wrap the shared client-IP policy in a spy while preserving every other export
// (getRuntime, METHODS_WITHOUT_BODY, isBodylessResponse, assertHeaderSafe, the
// DEFAULT_* timeout constants adapter.ts needs, etc.). vi.mock is hoisted and
// applies to context.ts's own import, so the call count reflects reality.
vi.mock('@nextrush/runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nextrush/runtime')>();
  return { ...actual, resolveClientIp: vi.fn(actual.resolveClientIp) };
});

// Wrap the context factory so the HP-4 test can observe the options object
// createHandler passes per request, while NodeContext itself stays the real class.
vi.mock('../context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../context')>();
  return { ...actual, createNodeContext: vi.fn(actual.createNodeContext) };
});

import { resolveClientIp } from '@nextrush/runtime';
import { createHandler } from '../adapter';
import { createNodeContext, NodeContext } from '../context';

const SOCKET_IP = '203.0.113.7';

/** Build a mock request; pass `remoteAddress: undefined` for the no-address case. */
function makeReq(
  opts: {
    remoteAddress?: string | undefined;
    headers?: Record<string, string | string[]>;
    method?: string;
    url?: string;
  } = {}
): IncomingMessage {
  const socket = new Socket();
  const remoteAddress = 'remoteAddress' in opts ? opts.remoteAddress : SOCKET_IP;
  Object.defineProperty(socket, 'remoteAddress', {
    value: remoteAddress,
    configurable: true,
  });
  const req = new IncomingMessage(socket);
  req.method = opts.method ?? 'GET';
  req.url = opts.url ?? '/';
  req.headers = opts.headers ?? {};
  return req;
}

/** Build a mock response with `end`/`setHeader` stubbed so no real socket write happens. */
function makeRes(): ServerResponse {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  const res = new ServerResponse(req);
  vi.spyOn(res, 'setHeader').mockImplementation(() => res);
  vi.spyOn(res, 'end').mockImplementation(() => res);
  return res;
}

const resolveClientIpMock = vi.mocked(resolveClientIp);
const createNodeContextMock = vi.mocked(createNodeContext);

beforeEach(() => {
  resolveClientIpMock.mockClear();
  createNodeContextMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// §2 HP-1 — ctx.ip
// ===========================================================================

describe('HP-1: ctx.ip resolution', () => {
  // ---- parity / characterization (green before and after) -----------------

  it('2.1 trustProxy false → ctx.ip equals the socket remote address', () => {
    const ctx = new NodeContext(makeReq(), makeRes(), { trustProxy: false });
    expect(ctx.ip).toBe(SOCKET_IP);
  });

  it('2.2 trustProxy false ignores x-forwarded-for / x-real-ip (parity with today)', () => {
    const ctx = new NodeContext(
      makeReq({ headers: { 'x-forwarded-for': '9.9.9.9', 'x-real-ip': '8.8.8.8' } }),
      makeRes(),
      { trustProxy: false }
    );
    expect(ctx.ip).toBe(SOCKET_IP);
  });

  it('2.3 trustProxy true with a valid x-forwarded-for resolves via the shared policy', () => {
    const ctx = new NodeContext(
      makeReq({ headers: { 'x-forwarded-for': '9.9.9.9' } }),
      makeRes(),
      { trustProxy: true }
    );
    expect(ctx.ip).toBe('9.9.9.9');
  });

  it('2.4 socket with no remoteAddress yields the empty string', () => {
    const ctx = new NodeContext(makeReq({ remoteAddress: undefined }), makeRes(), {
      trustProxy: false,
    });
    expect(ctx.ip).toBe('');
  });

  it('2.5 ctx.ip is stable and never undefined regardless of read timing', () => {
    const req = makeReq();
    const ctx = new NodeContext(req, makeRes(), { trustProxy: false });
    const first = ctx.ip;
    // Simulate socket teardown after the request began.
    Object.defineProperty(req.socket, 'remoteAddress', { value: undefined, configurable: true });
    const second = ctx.ip;
    expect(first).toBe(SOCKET_IP);
    expect(second).toBe(SOCKET_IP);
    expect(ctx.ip).not.toBeUndefined();
  });

  // ---- optimization assertion (RED before HP-1) ----------------------------

  it('2.6 [trim] trustProxy false does NOT invoke the proxy-header resolution policy', () => {
    void new NodeContext(makeReq(), makeRes(), { trustProxy: false });
    expect(resolveClientIpMock).not.toHaveBeenCalled();
  });

  it('2.7 [trim] trustProxy true still resolves via the shared policy', () => {
    void new NodeContext(
      makeReq({ headers: { 'x-forwarded-for': '9.9.9.9' } }),
      makeRes(),
      { trustProxy: true }
    );
    expect(resolveClientIpMock).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// §3 HP-4 — hoisted, frozen context-options object
// ===========================================================================

describe('HP-4: context-options object is not allocated per request', () => {
  it('3.1 [trim] many requests share one frozen options object (no per-request allocation)', async () => {
    const app = createApp({ proxy: true });
    const seenIps: string[] = [];
    app.use(async (ctx) => {
      seenIps.push(ctx.ip);
      ctx.json({ ok: true });
    });
    const handler = createHandler(app);

    for (let i = 0; i < 5; i++) {
      handler(makeReq({ headers: { 'x-forwarded-for': '9.9.9.9' } }), makeRes());
    }
    await new Promise((r) => setImmediate(r));

    const optionArgs = createNodeContextMock.mock.calls.map((call) => call[2]);
    expect(optionArgs.length).toBeGreaterThanOrEqual(5);
    // All requests must receive the *same* options reference, and it must be frozen.
    const [firstOptions] = optionArgs;
    expect(firstOptions).toBeDefined();
    for (const opt of optionArgs) {
      expect(opt).toBe(firstOptions);
      expect(Object.isFrozen(opt)).toBe(true);
    }
    // Config parity: every request observed trustProxy=true behavior.
    expect(seenIps).toEqual(['9.9.9.9', '9.9.9.9', '9.9.9.9', '9.9.9.9', '9.9.9.9']);
  });

  it('3.2 [trim] concurrent requests observe the same trustProxy value via the shared object', async () => {
    const app = createApp({ proxy: true });
    const seenIps: string[] = [];
    app.use(async (ctx) => {
      seenIps.push(ctx.ip);
      ctx.json({ ok: true });
    });
    const handler = createHandler(app);

    await Promise.all(
      Array.from({ length: 4 }, () => {
        handler(makeReq({ headers: { 'x-forwarded-for': '9.9.9.9' } }), makeRes());
        return new Promise((r) => setImmediate(r));
      })
    );

    const optionArgs = createNodeContextMock.mock.calls.map((call) => call[2]);
    const [firstOptions] = optionArgs;
    for (const opt of optionArgs) {
      expect(opt).toBe(firstOptions);
    }
    expect(seenIps.every((ip) => ip === '9.9.9.9')).toBe(true);
  });
});

// ===========================================================================
// §3 HP-7 — ctx.next() forwards the dispatch thunk without an extra async frame
// ===========================================================================

describe('HP-7: ctx.next() thunk forwarding', () => {
  // ---- optimization assertion (RED before HP-7) ----------------------------

  it('3.3 [trim] ctx.next() returns the identical promise the wired thunk returns', () => {
    const ctx = new NodeContext(makeReq(), makeRes());
    const thunkPromise = Promise.resolve();
    ctx.setNext(() => thunkPromise);
    expect(ctx.next()).toBe(thunkPromise);
  });

  // ---- parity / characterization (green before and after) ------------------

  it('3.4 await ctx.next() preserves onion ordering', async () => {
    const app = createApp();
    const order: string[] = [];
    app.use(async (ctx) => {
      order.push('a-before');
      await ctx.next();
      order.push('a-after');
    });
    app.use(async (ctx) => {
      order.push('b');
      ctx.json({ ok: true });
    });
    const handler = createHandler(app);
    handler(makeReq(), makeRes());
    await new Promise((r) => setImmediate(r));
    expect(order).toEqual(['a-before', 'b', 'a-after']);
  });

  it('3.5 a rejection from the wired thunk propagates out of ctx.next()', async () => {
    const ctx = new NodeContext(makeReq(), makeRes());
    const boom = new Error('downstream failed');
    ctx.setNext(() => Promise.reject(boom));
    await expect(ctx.next()).rejects.toBe(boom);
  });

  it('3.6 ctx.next() with no wired thunk is a resolved no-op', async () => {
    const ctx = new NodeContext(makeReq(), makeRes());
    await expect(ctx.next()).resolves.toBeUndefined();
  });

  it('3.7 ctx.next() always returns a Promise<void> (wired and unwired)', async () => {
    const unwired = new NodeContext(makeReq(), makeRes());
    const unwiredResult = unwired.next();
    expect(unwiredResult).toBeInstanceOf(Promise);
    await expect(unwiredResult).resolves.toBeUndefined();

    const wired = new NodeContext(makeReq(), makeRes());
    let advanced = false;
    wired.setNext(() => {
      advanced = true;
      return Promise.resolve();
    });
    const wiredResult = wired.next();
    expect(wiredResult).toBeInstanceOf(Promise);
    // Not awaiting still advanced the chain (the thunk was invoked synchronously).
    expect(advanced).toBe(true);
    await expect(wiredResult).resolves.toBeUndefined();
  });

  it('3.8 the composer guard still protects the chain ctx.next() forwards to (multiple-next fires)', async () => {
    // ctx.next() is wired to the composer's per-level dispatch thunk
    // (dispatch → setNext(nextFn)). Over-advancing that same level — canonically
    // by calling the level-bound `next` twice — must still be rejected by the
    // composer's multiple-next guard; HP-7's direct forward does not bypass it.
    const app = createApp();
    let secondNextError: unknown;
    app.use(async (_ctx, next) => {
      await next();
      try {
        await next(); // second call re-enters the same level → guard must reject
      } catch (err) {
        secondNextError = err;
      }
    });
    const handler = createHandler(app);
    handler(makeReq(), makeRes());
    await new Promise((r) => setImmediate(r));
    expect(secondNextError).toBeInstanceOf(Error);
    expect((secondNextError as Error).message).toMatch(/next\(\)/i);
  });
});
