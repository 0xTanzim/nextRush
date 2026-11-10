import { describe, expect, it, vi } from 'vitest';
import { DISPATCH_SETTLED_SYNC, type Logger, type UniversalFetchHandler } from '@nextrush/types';
import {
  createUniversalFetchHandler,
  DEFAULT_UNIVERSAL_TIMEOUT_MS,
} from '../universal-runner';
import type { WebRunnerApp } from '../web-runner';
import { UniversalWebContext } from '../universal-context';

function createMockApp(
  dispatch: (ctx: UniversalWebContext) => Promise<void> | void,
  syncDispatchSafe = true
): WebRunnerApp<(ctx: UniversalWebContext) => Promise<void>> & { readyCalls: number } {
  let readyCalls = 0;
  const logger: Logger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };

  return {
    isReady: true,
    isProduction: true,
    logger,
    syncDispatchSafe,
    get readyCalls() {
      return readyCalls;
    },
    ready: () => {
      readyCalls += 1;
      return Promise.resolve();
    },
    start: vi.fn(),
    callback: () => (ctx: UniversalWebContext) => {
      const res = dispatch(ctx);
      return res instanceof Promise ? res : Promise.resolve();
    },
  };
}

describe('Adversarial Universal Compatibility & Edge Cases', () => {
  describe('Synchronous Fast-Path Bypass Under High Concurrency', () => {
    it('returns pure bare Response objects with zero Promise allocations under 2,000 concurrent requests', () => {
      let invocationCount = 0;
      const app = createMockApp((ctx) => {
        invocationCount += 1;
        ctx.json({ sync: true, id: invocationCount });
        (ctx as unknown as Record<symbol, unknown>)[DISPATCH_SETTLED_SYNC] = true;
      }, true);

      const fetch = createUniversalFetchHandler(app);
      const CONCURRENCY = 2000;
      const results: (Response | Promise<Response>)[] = new Array(CONCURRENCY);

      // Fire 2,000 requests in rapid succession
      for (let i = 0; i < CONCURRENCY; i++) {
        results[i] = fetch(new Request(`http://localhost/sync/${i}`));
      }

      expect(invocationCount).toBe(CONCURRENCY);

      // Verify every single return value is a bare Response without a Promise wrapper
      for (let i = 0; i < CONCURRENCY; i++) {
        const res = results[i];
        expect(res).toBeInstanceOf(Response);
        expect(res instanceof Promise).toBe(false);
        expect(typeof (res as Promise<Response>).then).toBe('undefined');
        expect(res.status).toBe(200);
      }
    });

    it('handles interleaved synchronous and asynchronous concurrency without state bleeding', async () => {
      const SYNC_TOTAL = 1000;
      const ASYNC_TOTAL = 1000;

      const app = createMockApp(async (ctx) => {
        if (ctx.path.startsWith('/sync/')) {
          ctx.json({ type: 'sync', path: ctx.path });
          (ctx as unknown as Record<symbol, unknown>)[DISPATCH_SETTLED_SYNC] = true;
          return;
        }

        // Asynchronous handler
        await Promise.resolve();
        ctx.json({ type: 'async', path: ctx.path });
      }, true);

      const fetch = createUniversalFetchHandler(app);

      // Generate interleaved work items
      const operations: { isSync: boolean; path: string }[] = [];
      for (let i = 0; i < SYNC_TOTAL; i++) {
        operations.push({ isSync: true, path: `/sync/${i}` });
      }
      for (let i = 0; i < ASYNC_TOTAL; i++) {
        operations.push({ isSync: false, path: `/async/${i}` });
      }

      // Shuffle deterministically
      for (let i = operations.length - 1; i > 0; i--) {
        const j = (i * 31 + 7) % (i + 1);
        const temp = operations[i]!;
        operations[i] = operations[j]!;
        operations[j] = temp;
      }

      const syncResponses: Response[] = [];
      const asyncPromises: Promise<Response>[] = [];

      for (const op of operations) {
        const result = fetch(new Request(`http://localhost${op.path}`));
        if (op.isSync) {
          expect(result).toBeInstanceOf(Response);
          expect(result instanceof Promise).toBe(false);
          expect(typeof (result as Promise<Response>).then).toBe('undefined');
          syncResponses.push(result as Response);
        } else {
          expect(typeof (result as Promise<Response>).then).toBe('function');
          asyncPromises.push(result as Promise<Response>);
        }
      }

      expect(syncResponses).toHaveLength(SYNC_TOTAL);
      expect(asyncPromises).toHaveLength(ASYNC_TOTAL);

      // Settle all async promises
      const asyncResponses = await Promise.all(asyncPromises);
      for (const res of asyncResponses) {
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.type).toBe('async');
      }

      for (const res of syncResponses) {
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.type).toBe('sync');
      }
    });

    it('settles synchronous responses in the same tick before microtasks', async () => {
      let microtaskExecuted = false;
      queueMicrotask(() => {
        microtaskExecuted = true;
      });

      const app = createMockApp((ctx) => {
        ctx.json({ immediate: true });
        (ctx as unknown as Record<symbol, unknown>)[DISPATCH_SETTLED_SYNC] = true;
      }, true);

      const fetch = createUniversalFetchHandler(app);
      const res = fetch(new Request('http://localhost/immediate'));

      // Microtask has NOT run yet
      expect(microtaskExecuted).toBe(false);
      expect(res).toBeInstanceOf(Response);
      expect(res.status).toBe(200);

      // Drain microtask
      await Promise.resolve();
      expect(microtaskExecuted).toBe(true);
    });

    it('synchronously catches and finalizes errors when handler throws synchronously', () => {
      const app = createMockApp(() => {
        throw new Error('Immediate catastrophic failure');
      }, true);

      const fetch = createUniversalFetchHandler(app, {
        onError: (err) => {
          return new Response(JSON.stringify({ caughtSync: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      });

      const res = fetch(new Request('http://localhost/throw-sync'));

      // Should return bare Response synchronously
      expect(res).toBeInstanceOf(Response);
      expect(res instanceof Promise).toBe(false);
      expect(res.status).toBe(500);
    });
  });

  describe('Cloudflare Workers Client IP Resolution & Edge Guards', () => {
    it('resolves valid IPv4 and IPv6 cf-connecting-ip', () => {
      const v4Ctx = new UniversalWebContext(
        new Request('http://localhost/cf-v4', {
          headers: { 'cf-connecting-ip': '198.51.100.77' },
        }),
        { KV: {} },
        { waitUntil() {} },
        { proxy: 1 }
      );
      expect(v4Ctx.ip).toBe('198.51.100.77');

      const v6Ctx = new UniversalWebContext(
        new Request('http://localhost/cf-v6', {
          headers: { 'cf-connecting-ip': '2001:db8:85a3::8a2e:370:7334' },
        }),
        { KV: {} },
        { waitUntil() {} },
        { proxy: 1 }
      );
      expect(v6Ctx.ip).toBe('2001:db8:85a3::8a2e:370:7334');
    });

    it('rejects malformed cf-connecting-ip and falls back to x-forwarded-for', () => {
      const malformedIps = [
        '999.999.999.999',
        'invalid.ip.string',
        '1.2.3.4.5',
        '::ffff:999.999.999.999',
        '   ',
        '',
      ];

      for (const badIp of malformedIps) {
        const ctx = new UniversalWebContext(
          new Request('http://localhost/cf-bad', {
            headers: {
              'cf-connecting-ip': badIp,
              'x-forwarded-for': '203.0.113.50',
            },
          }),
          { KV: {} },
          { waitUntil() {} },
          { proxy: 1 }
        );

        // bad cf-connecting-ip must be bypassed, resolving x-forwarded-for
        expect(ctx.ip).toBe('203.0.113.50');
      }
    });

    it('respects proxy hop counts when cf-connecting-ip is absent', () => {
      const req = new Request('http://localhost/hops', {
        headers: {
          'x-forwarded-for': '192.0.2.1, 198.51.100.2, 203.0.113.3',
        },
      });

      // Hop 1 (rightmost)
      const ctxHop1 = new UniversalWebContext(req, { KV: {} }, { waitUntil() {} }, { proxy: 1 });
      expect(ctxHop1.ip).toBe('203.0.113.3');

      // Hop 2 (second from right)
      const ctxHop2 = new UniversalWebContext(req, { KV: {} }, { waitUntil() {} }, { proxy: 2 });
      expect(ctxHop2.ip).toBe('198.51.100.2');

      // Hop 3 (third from right)
      const ctxHop3 = new UniversalWebContext(req, { KV: {} }, { waitUntil() {} }, { proxy: 3 });
      expect(ctxHop3.ip).toBe('192.0.2.1');

      // Hop count exceeded (fallback to direct / empty for edge)
      const ctxHop99 = new UniversalWebContext(req, { KV: {} }, { waitUntil() {} }, { proxy: 99 });
      expect(ctxHop99.ip).toBe('');
    });

    it('strictly rejects CIDR array configuration on Edge runtimes with descriptive error', () => {
      const testCases = [
        { name: 'Shape 1 (3-arg)', args: [new Request('http://localhost/'), { KV: {} }, { waitUntil() {} }] },
        { name: 'Shape 2 (2-arg Vercel)', args: [new Request('http://localhost/'), { waitUntil() {} }] },
        { name: 'Shape 4-alt (2-arg CF bindings)', args: [new Request('http://localhost/'), { KV: {} }] },
      ];

      for (const tc of testCases) {
        expect(() => {
          new UniversalWebContext(
            tc.args[0] as Request,
            tc.args[1],
            tc.args[2],
            { proxy: ['10.0.0.0/8', '192.168.0.0/16'] }
          );
        }).toThrow(
          "proxy: ['<cidr>', ...] is not supported on edge runtimes without a socket peer address. Use proxy: <hopCount> instead (e.g. proxy: 1 for Cloudflare)."
        );
      }
    });
  });

  describe('Bun Server Client IP Caching & Safety', () => {
    it('calls server.requestIP() exactly once across 50 property reads (RFC-044 memoization)', () => {
      const requestIPSpy = vi.fn().mockReturnValue({ address: '172.16.0.42' });
      const mockServer = { requestIP: requestIPSpy };

      const ctx = new UniversalWebContext(
        new Request('http://localhost/bun-cache'),
        mockServer
      );

      expect(requestIPSpy).not.toHaveBeenCalled();

      // Read ctx.ip 50 times
      for (let i = 0; i < 50; i++) {
        expect(ctx.ip).toBe('172.16.0.42');
      }

      // Must be called exactly once
      expect(requestIPSpy).toHaveBeenCalledTimes(1);
    });

    it('safely handles server.requestIP() returning null and caches empty string without re-calling', () => {
      const requestIPSpy = vi.fn().mockReturnValue(null);
      const mockServer = { requestIP: requestIPSpy };

      const ctx = new UniversalWebContext(
        new Request('http://localhost/bun-null'),
        mockServer
      );

      // First read: requestIP returns null -> ctx.ip is ''
      expect(ctx.ip).toBe('');
      expect(requestIPSpy).toHaveBeenCalledTimes(1);

      // Second read: should read cached '' without calling requestIP again!
      expect(ctx.ip).toBe('');
      expect(requestIPSpy).toHaveBeenCalledTimes(1);
    });

    it('safely handles server.requestIP() returning object without address property', () => {
      const requestIPSpy = vi.fn().mockReturnValue({});
      const mockServer = { requestIP: requestIPSpy };

      const ctx = new UniversalWebContext(
        new Request('http://localhost/bun-no-addr'),
        mockServer
      );

      expect(ctx.ip).toBe('');
      expect(ctx.ip).toBe('');
      expect(requestIPSpy).toHaveBeenCalledTimes(1);
    });

    it('supports CIDR proxy trust on Bun using direct connection as peer', () => {
      const mockServer = {
        requestIP: () => ({ address: '10.0.0.1' }),
      };

      const req = new Request('http://localhost/bun-cidr', {
        headers: { 'x-forwarded-for': '203.0.113.88' },
      });

      const ctx = new UniversalWebContext(req, mockServer, undefined, {
        proxy: ['10.0.0.1'],
      });

      expect(ctx.ip).toBe('203.0.113.88');
    });
  });

  describe('Deno ServeHandlerInfo Client IP & Safety', () => {
    it('resolves remoteAddr hostname with memoization', () => {
      const info = { remoteAddr: { hostname: '192.168.10.5' } };
      const ctx = new UniversalWebContext(
        new Request('http://localhost/deno-ip'),
        info
      );

      expect(ctx.ip).toBe('192.168.10.5');
      expect(ctx.ip).toBe('192.168.10.5');
    });

    it('handles remoteAddr as null safely (JavaScript typeof null === object boundary)', () => {
      const info = { remoteAddr: null as unknown as { hostname?: string } };
      const ctx = new UniversalWebContext(
        new Request('http://localhost/deno-null'),
        info
      );

      expect(ctx.ip).toBe('');
    });

    it('handles remoteAddr without hostname safely', () => {
      const info = { remoteAddr: {} };
      const ctx = new UniversalWebContext(
        new Request('http://localhost/deno-empty'),
        info
      );

      expect(ctx.ip).toBe('');
    });

    it('supports CIDR proxy trust on Deno using direct hostname as peer', () => {
      const info = { remoteAddr: { hostname: '192.168.1.1' } };
      const req = new Request('http://localhost/deno-cidr', {
        headers: { 'x-forwarded-for': '198.51.100.99' },
      });

      const ctx = new UniversalWebContext(req, info, undefined, {
        proxy: ['192.168.1.1'],
      });

      expect(ctx.ip).toBe('198.51.100.99');
    });
  });

  describe('Standard 1-Argument Fallback', () => {
    it('defaults to empty string when proxy: false without warnings in production', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const req = new Request('http://localhost/standard-prod', {
        headers: { 'x-forwarded-for': '192.0.2.100' },
      });

      const ctx = new UniversalWebContext(req, undefined, undefined, {
        isProduction: true,
        proxy: false,
      });

      expect(ctx.ip).toBe('');
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('emits a single development warning when ctx.ip is read with proxy: false', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const req = new Request('http://localhost/standard-dev');

      const ctx = new UniversalWebContext(req, undefined, undefined, {
        isProduction: false,
        proxy: false,
      });

      expect(ctx.ip).toBe('');
      expect(warnSpy).toHaveBeenCalledTimes(1);

      // Repeated read does not duplicate warning
      expect(ctx.ip).toBe('');
      expect(warnSpy).toHaveBeenCalledTimes(1);

      warnSpy.mockRestore();
    });

    it('resolves x-forwarded-for and x-real-ip when proxy hop count is configured', () => {
      // With x-forwarded-for
      const reqForwarded = new Request('http://localhost/standard-proxy', {
        headers: { 'x-forwarded-for': '203.0.113.123' },
      });
      const ctx1 = new UniversalWebContext(reqForwarded, undefined, undefined, { proxy: 1 });
      expect(ctx1.ip).toBe('203.0.113.123');

      // With x-real-ip fallback
      const reqReal = new Request('http://localhost/standard-real', {
        headers: { 'x-real-ip': '203.0.113.234' },
      });
      const ctx2 = new UniversalWebContext(reqReal, undefined, undefined, { proxy: 1 });
      expect(ctx2.ip).toBe('203.0.113.234');

      // No headers with proxy: 1 returns empty direct address
      const reqEmpty = new Request('http://localhost/standard-none');
      const ctx3 = new UniversalWebContext(reqEmpty, undefined, undefined, { proxy: 1 });
      expect(ctx3.ip).toBe('');
    });
  });

  describe('UniversalFetchHandler Type Signature Invariants', () => {
    it('verifies createUniversalFetchHandler satisfies UniversalFetchHandler for async and sync routes', async () => {
      // Async route without sync marker
      const appAsync = createMockApp((ctx) => {
        ctx.json({ ok: true });
      });

      const asyncHandler: UniversalFetchHandler = createUniversalFetchHandler(appAsync);
      expect(typeof asyncHandler).toBe('function');

      // 1 arg
      const r1 = asyncHandler(new Request('http://localhost/1'));
      expect(typeof (r1 as Promise<Response>).then).toBe('function');
      expect((await r1).status).toBe(200);

      // 2 args
      const r2 = asyncHandler(new Request('http://localhost/2'), { waitUntil() {} });
      expect(typeof (r2 as Promise<Response>).then).toBe('function');
      expect((await r2).status).toBe(200);

      // 3 args
      const r3 = asyncHandler(new Request('http://localhost/3'), {}, {});
      expect(typeof (r3 as Promise<Response>).then).toBe('function');
      expect((await r3).status).toBe(200);

      // Sync route with DISPATCH_SETTLED_SYNC marker
      const appSync = createMockApp((ctx) => {
        ctx.json({ ok: true });
        (ctx as unknown as Record<symbol, unknown>)[DISPATCH_SETTLED_SYNC] = true;
      }, true);

      const syncHandler: UniversalFetchHandler = createUniversalFetchHandler(appSync);

      // Bare Response synchronously
      const s1 = syncHandler(new Request('http://localhost/sync1'));
      expect(s1).toBeInstanceOf(Response);
      expect(s1 instanceof Promise).toBe(false);
      expect(s1.status).toBe(200);

      const s2 = syncHandler(new Request('http://localhost/sync2'), { waitUntil() {} });
      expect(s2).toBeInstanceOf(Response);
      expect(s2 instanceof Promise).toBe(false);

      const s3 = syncHandler(new Request('http://localhost/sync3'), {}, {});
      expect(s3).toBeInstanceOf(Response);
      expect(s3 instanceof Promise).toBe(false);
    });
  });
});
