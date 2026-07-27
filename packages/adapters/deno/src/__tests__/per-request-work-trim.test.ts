/**
 * @nextrush/adapter-deno — per-request-work-trim regression contract
 *
 * Executable contract for OpenSpec change `web-adapters-per-request-work-trim`
 * (sibling of the archived Node `node-adapter-per-request-work-trim`). Pins the
 * byte-identical observable behavior of `ctx.ip` and `ctx.next()`
 * (characterization tests, green before and after the trims) AND proves each
 * trim actually happened (optimization-assertion tests, RED before impl):
 *
 *  - HP-1: `proxy: false` sets `ctx.ip` directly from the connection
 *          `remoteAddr.hostname` without invoking the shared header-lookup
 *          policy (`getClientIp`).
 *  - HP-7: `ctx.next()` forwards the wired dispatch thunk directly (returns its
 *          exact promise) rather than wrapping it in an extra `async` frame.
 *
 * Note: HP-4 does NOT apply — the Deno context factory takes `proxy`
 * positionally, so there is no per-request options object to hoist.
 */

import { createApp } from '@nextrush/core';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@nextrush/runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nextrush/runtime')>();
  return { ...actual, getClientIp: vi.fn(actual.getClientIp) };
});

import { getClientIp } from '@nextrush/runtime';
import { createHandler } from '../adapter';
import { DenoContext } from '../context';

const DIRECT_IP = '203.0.113.7';

function makeRequest(headers?: Record<string, string>): Request {
  return new Request('http://localhost/', headers ? { headers } : undefined);
}

function connInfo(hostname: string): { remoteAddr?: { hostname: string } } {
  return { remoteAddr: { hostname } };
}

/** Deno's `DenoServeHandlerInfo` shape used by the handler runner. */
function makeInfo(hostname: string): { remoteAddr: { hostname: string; port: number } } {
  return { remoteAddr: { hostname, port: 0 } };
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

describe('HP-1: Deno ctx.ip resolution', () => {
  // ---- parity / characterization (green before and after) -----------------

  it('2.3 proxy: false → ctx.ip equals connInfo.remoteAddr.hostname', () => {
    const ctx = new DenoContext(makeRequest(), connInfo(DIRECT_IP), false);
    expect(ctx.ip).toBe(DIRECT_IP);
  });

  it('2.3 proxy: false + no connInfo → ctx.ip is the empty string', () => {
    const ctx = new DenoContext(makeRequest(), undefined, false);
    expect(ctx.ip).toBe('');
  });

  it('2.3 proxy: 1 (hop count) + valid x-forwarded-for → policy result', () => {
    const ctx = new DenoContext(
      makeRequest({ 'x-forwarded-for': '9.9.9.9' }),
      connInfo(DIRECT_IP),
      1
    );
    expect(ctx.ip).toBe('9.9.9.9');
  });

  it('2.3 proxy: 1 (hop count) + no proxy header → directIp fallback', () => {
    const ctx = new DenoContext(makeRequest(), connInfo(DIRECT_IP), 1);
    expect(ctx.ip).toBe(DIRECT_IP);
  });

  it('2.5 proxy: false ignores x-forwarded-for / x-real-ip (returns connection address)', () => {
    const ctx = new DenoContext(
      makeRequest({ 'x-forwarded-for': '9.9.9.9', 'x-real-ip': '8.8.8.8' }),
      connInfo(DIRECT_IP),
      false
    );
    expect(ctx.ip).toBe(DIRECT_IP);
  });

  // ---- optimization assertion (RED before HP-1) ----------------------------

  it('2.6 [trim] proxy: false does NOT invoke getClientIp', () => {
    void new DenoContext(makeRequest(), connInfo(DIRECT_IP), false);
    expect(getClientIpMock).not.toHaveBeenCalled();
  });

  it('2.6 [trim] proxy: 1 (hop count) still resolves via getClientIp (directIp = remoteAddr.hostname)', () => {
    void new DenoContext(makeRequest({ 'x-forwarded-for': '9.9.9.9' }), connInfo(DIRECT_IP), 1);
    expect(getClientIpMock).toHaveBeenCalledTimes(1);
    expect(getClientIpMock).toHaveBeenCalledWith(expect.any(Request), DIRECT_IP, 1);
  });
});

// ===========================================================================
// §3 HP-7 — ctx.next() forwards the dispatch thunk without an extra async frame
// ===========================================================================

describe('HP-7: Deno ctx.next() thunk forwarding', () => {
  it('3.1 [trim] ctx.next() returns the identical promise the wired thunk returns', () => {
    const ctx = new DenoContext(makeRequest());
    const thunkPromise = Promise.resolve();
    ctx.setNext(() => thunkPromise);
    expect(ctx.next()).toBe(thunkPromise);
  });

  it('3.2 a rejection from the wired thunk propagates out of ctx.next()', async () => {
    const ctx = new DenoContext(makeRequest());
    const boom = new Error('downstream failed');
    ctx.setNext(() => Promise.reject(boom));
    await expect(ctx.next()).rejects.toBe(boom);
  });

  it('3.3 ctx.next() with no wired thunk is a resolved no-op returning Promise<void>', async () => {
    const ctx = new DenoContext(makeRequest());
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
    await handler(makeRequest(), makeInfo(DIRECT_IP) as never);
    expect(order).toEqual(['a-before', 'b', 'a-after']);
  });

  it('3.4 the composer multiple-next guard still fires for the chain ctx.next() forwards to', async () => {
    const app = createApp();
    let secondNextError: unknown;
    app.use(async (_ctx, next) => {
      await next();
      try {
        await next();
      } catch (err) {
        secondNextError = err;
      }
    });
    const handler = createHandler(app, { timeout: 0 });
    await handler(makeRequest(), makeInfo(DIRECT_IP) as never);
    expect(secondNextError).toBeInstanceOf(Error);
    expect((secondNextError as Error).message).toMatch(/next\(\)/i);
  });
});
