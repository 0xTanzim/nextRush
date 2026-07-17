/**
 * @nextrush/adapter-edge — per-request-work-trim regression contract
 *
 * Executable contract for OpenSpec change `web-adapters-per-request-work-trim`
 * (sibling of the archived Node `node-adapter-per-request-work-trim`). Pins the
 * byte-identical observable behavior of `ctx.ip` and `ctx.next()`
 * (characterization tests, green before and after the trims) AND proves each
 * trim actually happened (optimization-assertion tests, RED before impl):
 *
 *  - HP-1: `trustProxy: false` sets `ctx.ip` to `''` directly (Edge has no
 *          socket) without invoking the edge header-lookup policy
 *          (`getEdgeClientIp`); `trustProxy: true` still resolves via it,
 *          preserving the cf-connecting-ip → x-forwarded-for → x-real-ip
 *          precedence.
 *  - HP-7: `ctx.next()` forwards the wired dispatch thunk directly (returns its
 *          exact promise) rather than wrapping it in an extra `async` frame.
 *
 * Note: HP-4 does NOT apply — the Edge context factory takes `trustProxy`
 * positionally, so there is no per-request options object to hoist.
 */

import { createApp } from '@nextrush/core';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@nextrush/runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nextrush/runtime')>();
  return { ...actual, getEdgeClientIp: vi.fn(actual.getEdgeClientIp) };
});

import { getEdgeClientIp } from '@nextrush/runtime';
import { createFetchHandler } from '../adapter';
import { EdgeContext } from '../context';

function makeRequest(headers?: Record<string, string>): Request {
  return new Request('http://localhost/', headers ? { headers } : undefined);
}

const getEdgeClientIpMock = vi.mocked(getEdgeClientIp);

beforeEach(() => {
  getEdgeClientIpMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// §2 HP-1 — ctx.ip
// ===========================================================================

describe('HP-1: Edge ctx.ip resolution', () => {
  // ---- parity / characterization (green before and after) -----------------

  it('2.4 trustProxy false → ctx.ip is the empty string (Edge has no socket)', () => {
    const ctx = new EdgeContext(makeRequest(), undefined, false);
    expect(ctx.ip).toBe('');
  });

  it('2.4 trustProxy true + cf-connecting-ip wins the Cloudflare precedence', () => {
    const ctx = new EdgeContext(
      makeRequest({
        'cf-connecting-ip': '198.51.100.5',
        'x-forwarded-for': '9.9.9.9',
        'x-real-ip': '8.8.8.8',
      }),
      undefined,
      true
    );
    expect(ctx.ip).toBe('198.51.100.5');
  });

  it('2.4 trustProxy true + no cf-connecting-ip → x-forwarded-for → x-real-ip precedence', () => {
    const xff = new EdgeContext(
      makeRequest({ 'x-forwarded-for': '9.9.9.9', 'x-real-ip': '8.8.8.8' }),
      undefined,
      true
    );
    expect(xff.ip).toBe('9.9.9.9');

    const real = new EdgeContext(makeRequest({ 'x-real-ip': '8.8.8.8' }), undefined, true);
    expect(real.ip).toBe('8.8.8.8');
  });

  it('2.5 trustProxy false ignores cf-connecting-ip / x-forwarded-for / x-real-ip', () => {
    const ctx = new EdgeContext(
      makeRequest({
        'cf-connecting-ip': '198.51.100.5',
        'x-forwarded-for': '9.9.9.9',
        'x-real-ip': '8.8.8.8',
      }),
      undefined,
      false
    );
    expect(ctx.ip).toBe('');
  });

  // ---- optimization assertion (RED before HP-1) ----------------------------

  it('2.6 [trim] trustProxy false does NOT invoke getEdgeClientIp', () => {
    void new EdgeContext(makeRequest(), undefined, false);
    expect(getEdgeClientIpMock).not.toHaveBeenCalled();
  });

  it('2.6 [trim] trustProxy true still resolves via getEdgeClientIp', () => {
    void new EdgeContext(makeRequest({ 'cf-connecting-ip': '198.51.100.5' }), undefined, true);
    expect(getEdgeClientIpMock).toHaveBeenCalledTimes(1);
    expect(getEdgeClientIpMock).toHaveBeenCalledWith(expect.any(Request), true);
  });
});

// ===========================================================================
// §3 HP-7 — ctx.next() forwards the dispatch thunk without an extra async frame
// ===========================================================================

describe('HP-7: Edge ctx.next() thunk forwarding', () => {
  it('3.1 [trim] ctx.next() returns the identical promise the wired thunk returns', () => {
    const ctx = new EdgeContext(makeRequest());
    const thunkPromise = Promise.resolve();
    ctx.setNext(() => thunkPromise);
    expect(ctx.next()).toBe(thunkPromise);
  });

  it('3.2 a rejection from the wired thunk propagates out of ctx.next()', async () => {
    const ctx = new EdgeContext(makeRequest());
    const boom = new Error('downstream failed');
    ctx.setNext(() => Promise.reject(boom));
    await expect(ctx.next()).rejects.toBe(boom);
  });

  it('3.3 ctx.next() with no wired thunk is a resolved no-op returning Promise<void>', async () => {
    const ctx = new EdgeContext(makeRequest());
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
    const handler = createFetchHandler(app);
    await handler(makeRequest());
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
    const handler = createFetchHandler(app);
    await handler(makeRequest());
    expect(secondNextError).toBeInstanceOf(Error);
    expect((secondNextError as Error).message).toMatch(/next\(\)/i);
  });
});
