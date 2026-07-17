/**
 * @nextrush/adapter-bun — per-request-work-trim regression contract
 *
 * Executable contract for OpenSpec change `web-adapters-per-request-work-trim`
 * (sibling of the archived Node `node-adapter-per-request-work-trim`). Pins the
 * byte-identical observable behavior of `ctx.ip` and `ctx.next()`
 * (characterization tests, green before and after the trims) AND proves each
 * trim actually happened (optimization-assertion tests, RED before impl):
 *
 *  - HP-1: `trustProxy: false` sets `ctx.ip` directly from Bun's `clientIp`
 *          without invoking the shared header-lookup policy (`getClientIp`).
 *  - HP-7: `ctx.next()` forwards the wired dispatch thunk directly (returns its
 *          exact promise) rather than wrapping it in an extra `async` frame.
 *
 * Note: HP-4 does NOT apply — the Bun context factory takes `trustProxy`
 * positionally, so there is no per-request options object to hoist.
 */

import { createApp } from '@nextrush/core';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

// Wrap the shared client-IP helper in a spy while preserving every other export
// (getRuntime, headersToRecord, METHODS_WITHOUT_BODY, WebResponseBuilder, etc.).
// vi.mock is hoisted and applies to context.ts's own import, so the call count
// reflects reality.
vi.mock('@nextrush/runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nextrush/runtime')>();
  return { ...actual, getClientIp: vi.fn(actual.getClientIp) };
});

import { getClientIp } from '@nextrush/runtime';
import { createHandler } from '../adapter';
import { BunContext } from '../context';

const CLIENT_IP = '203.0.113.7';

function makeRequest(headers?: Record<string, string>): Request {
  return new Request('http://localhost/', headers ? { headers } : undefined);
}

/** A minimal Bun.Server stub — the runner only calls `server.requestIP`. */
function makeServerStub(address: string) {
  return { requestIP: () => ({ address, family: 'IPv4', port: 0 }) };
}

const getClientIpMock = vi.mocked(getClientIp);

beforeEach(() => {
  getClientIpMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// §2 HP-1 — ctx.ip
// ===========================================================================

describe('HP-1: Bun ctx.ip resolution', () => {
  // ---- parity / characterization (green before and after) -----------------

  it('2.1 trustProxy false + clientIp present → ctx.ip equals the clientIp', () => {
    const ctx = new BunContext(makeRequest(), CLIENT_IP, false);
    expect(ctx.ip).toBe(CLIENT_IP);
  });

  it('2.1 trustProxy false + clientIp absent → ctx.ip is the empty string', () => {
    const ctx = new BunContext(makeRequest(), undefined, false);
    expect(ctx.ip).toBe('');
  });

  it('2.2 trustProxy true + clientIp present + valid x-forwarded-for → policy result', () => {
    const ctx = new BunContext(
      makeRequest({ 'x-forwarded-for': '9.9.9.9' }),
      CLIENT_IP,
      true
    );
    expect(ctx.ip).toBe('9.9.9.9');
  });

  it('2.2 trustProxy true + clientIp absent + no proxy header → directIp fallback ""', () => {
    const ctx = new BunContext(makeRequest(), undefined, true);
    expect(ctx.ip).toBe('');
  });

  it('2.5 trustProxy false ignores x-forwarded-for / x-real-ip (returns clientIp)', () => {
    const ctx = new BunContext(
      makeRequest({ 'x-forwarded-for': '9.9.9.9', 'x-real-ip': '8.8.8.8' }),
      CLIENT_IP,
      false
    );
    expect(ctx.ip).toBe(CLIENT_IP);
  });

  // ---- optimization assertion (RED before HP-1) ----------------------------

  it('2.6 [trim] trustProxy false + clientIp present does NOT invoke getClientIp', () => {
    void new BunContext(makeRequest(), CLIENT_IP, false);
    expect(getClientIpMock).not.toHaveBeenCalled();
  });

  it('2.6 [trim] trustProxy false + clientIp absent does NOT invoke getClientIp', () => {
    void new BunContext(makeRequest(), undefined, false);
    expect(getClientIpMock).not.toHaveBeenCalled();
  });

  it('2.6 [trim] trustProxy true still resolves via getClientIp (directIp = clientIp ?? "")', () => {
    void new BunContext(makeRequest({ 'x-forwarded-for': '9.9.9.9' }), CLIENT_IP, true);
    expect(getClientIpMock).toHaveBeenCalledTimes(1);
    expect(getClientIpMock).toHaveBeenCalledWith(expect.any(Request), CLIENT_IP, true);
  });
});

// ===========================================================================
// §3 HP-7 — ctx.next() forwards the dispatch thunk without an extra async frame
// ===========================================================================

describe('HP-7: Bun ctx.next() thunk forwarding', () => {
  // ---- optimization assertion (RED before HP-7) ----------------------------

  it('3.1 [trim] ctx.next() returns the identical promise the wired thunk returns', () => {
    const ctx = new BunContext(makeRequest());
    const thunkPromise = Promise.resolve();
    ctx.setNext(() => thunkPromise);
    expect(ctx.next()).toBe(thunkPromise);
  });

  // ---- parity / characterization (green before and after) ------------------

  it('3.2 a rejection from the wired thunk propagates out of ctx.next()', async () => {
    const ctx = new BunContext(makeRequest());
    const boom = new Error('downstream failed');
    ctx.setNext(() => Promise.reject(boom));
    await expect(ctx.next()).rejects.toBe(boom);
  });

  it('3.3 ctx.next() with no wired thunk is a resolved no-op returning Promise<void>', async () => {
    const ctx = new BunContext(makeRequest());
    const result = ctx.next();
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBeUndefined();
  });

  it('3.1 await ctx.next() preserves onion ordering through the composed pipeline', async () => {
    const app = createApp();
    const order: string[] = [];
    app.use(async (ctx) => {
      order.push('a-before');
      await ctx.next();
      order.push('a-after');
    });
    app.use((ctx) => {
      order.push('b');
      ctx.json({ ok: true });
    });
    const handler = createHandler(app, { timeout: 0 });
    await handler(makeRequest(), makeServerStub(CLIENT_IP) as never);
    expect(order).toEqual(['a-before', 'b', 'a-after']);
  });

  it('3.4 the composer multiple-next guard still fires for the chain ctx.next() forwards to', async () => {
    const app = createApp();
    let secondNextError: unknown;
    app.use(async (_ctx, next) => {
      await next();
      try {
        await next(); // re-enters the same level → composer guard must reject
      } catch (err) {
        secondNextError = err;
      }
    });
    const handler = createHandler(app, { timeout: 0 });
    await handler(makeRequest(), makeServerStub(CLIENT_IP) as never);
    expect(secondNextError).toBeInstanceOf(Error);
    expect((secondNextError as Error).message).toMatch(/next\(\)/i);
  });
});
