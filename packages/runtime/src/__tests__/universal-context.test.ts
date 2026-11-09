import { describe, expect, it, vi } from 'vitest';
import {
  createUniversalWebContext,
  UniversalWebContext,
  type UniversalExecutionContext,
} from '../universal-context';

describe('UniversalWebContext', () => {
  describe('5-signature invocation normalization', () => {
    it('normalizes Shape 1: Cloudflare Workers 3-arg (req, env, ctx)', () => {
      const waitUntilFn = vi.fn();
      const mockCtx: UniversalExecutionContext = { waitUntil: waitUntilFn };
      const mockEnv = { KV: 'store-binding', SECRET: 'xyz' };

      const ctx = new UniversalWebContext(
        new Request('http://localhost/api/test', {
          headers: { 'cf-connecting-ip': '203.0.113.195' },
        }),
        mockEnv,
        mockCtx,
        { proxy: 1 }
      );

      expect(ctx.env).toEqual(mockEnv);
      expect(ctx.executionContext).toBe(mockCtx);
      expect(ctx.ip).toBe('203.0.113.195');

      const bgPromise = Promise.resolve('done');
      ctx.waitUntil(bgPromise);
      expect(waitUntilFn).toHaveBeenCalledWith(bgPromise);
      expect(ctx.pendingWaitUntils).toHaveLength(0); // Handled by host context
    });

    it('normalizes Shape 2: Vercel Edge 2-arg (req, ctx)', () => {
      const waitUntilFn = vi.fn();
      const mockCtx: UniversalExecutionContext = { waitUntil: waitUntilFn };

      const ctx = new UniversalWebContext(
        new Request('http://localhost/edge', {
          headers: { 'x-forwarded-for': '198.51.100.42' },
        }),
        mockCtx,
        undefined,
        { proxy: 1 }
      );

      expect(ctx.env).toBeUndefined();
      expect(ctx.executionContext).toBe(mockCtx);
      expect(ctx.ip).toBe('198.51.100.42');

      const bgPromise = Promise.resolve('ok');
      ctx.waitUntil(bgPromise);
      expect(waitUntilFn).toHaveBeenCalledWith(bgPromise);
      expect(ctx.pendingWaitUntils).toHaveLength(0);
    });

    it('normalizes Shape 3: Bun Server 2-arg (req, server) with RFC-044 lazy IP', () => {
      const requestIPSpy = vi.fn().mockReturnValue({ address: '192.168.1.100' });
      const mockServer = { requestIP: requestIPSpy };

      const req = new Request('http://localhost/bun?foo=bar', {
        headers: { 'user-agent': 'BunTest/1.0' },
      });

      const ctx = new UniversalWebContext(req, mockServer);

      expect(ctx.env).toBeUndefined();
      expect(ctx.executionContext).toBeUndefined();

      // Invariants: zero calls to server.requestIP before ctx.ip is read
      expect(ctx.path).toBe('/bun');
      expect(ctx.query).toEqual({ foo: 'bar' });
      expect(ctx.get('user-agent')).toBe('BunTest/1.0');
      expect(requestIPSpy).not.toHaveBeenCalled();

      // First read triggers resolution
      expect(ctx.ip).toBe('192.168.1.100');
      expect(requestIPSpy).toHaveBeenCalledTimes(1);

      // Second read returns memoized address
      expect(ctx.ip).toBe('192.168.1.100');
      expect(requestIPSpy).toHaveBeenCalledTimes(1);
    });

    it('normalizes Shape 4: Deno ServeHandlerInfo 2-arg (req, info) with lazy IP', () => {
      const mockInfo = { remoteAddr: { hostname: '10.0.0.55' } };

      const req = new Request('http://localhost/deno');
      const ctx = new UniversalWebContext(req, mockInfo);

      expect(ctx.env).toBeUndefined();
      expect(ctx.executionContext).toBeUndefined();
      expect(ctx.ip).toBe('10.0.0.55');
      // Second read memoized
      expect(ctx.ip).toBe('10.0.0.55');
    });

    it('normalizes Shape 4-alt: Cloudflare Workers 2-arg (req, env without ctx)', () => {
      const mockEnv = { D1: 'database-handle' };

      const ctx = new UniversalWebContext(
        new Request('http://localhost/cf-no-ctx'),
        mockEnv
      );

      expect(ctx.env).toEqual(mockEnv);
      expect(ctx.executionContext).toBeUndefined();
    });

    it('normalizes Shape 5: Standard 1-arg fetch (req)', () => {
      const req = new Request('http://localhost/standard', {
        headers: { 'x-forwarded-for': '192.0.2.1' },
      });

      // Default proxy is false -> IP is empty string
      const ctxNoProxy = new UniversalWebContext(req);
      expect(ctxNoProxy.env).toBeUndefined();
      expect(ctxNoProxy.executionContext).toBeUndefined();
      expect(ctxNoProxy.ip).toBe('');

      // When proxy trust is configured, standard headers are resolved
      const ctxWithProxy = new UniversalWebContext(req, undefined, undefined, { proxy: 1 });
      expect(ctxWithProxy.ip).toBe('192.0.2.1');
    });
  });

  describe('Proxy CIDR Array Guard', () => {
    it('throws when CIDR peer list is passed to EdgeHeaders mode (Shape 1)', () => {
      expect(() => {
        new UniversalWebContext(
          new Request('http://localhost/'),
          { KV: {} },
          { waitUntil() {} },
          { proxy: ['10.0.0.0/8'] }
        );
      }).toThrow(/proxy: \['<cidr>', \.\.\.\] is not supported on edge runtimes without a socket peer address/);
    });

    it('throws when CIDR peer list is passed to EdgeHeaders mode (Shape 2)', () => {
      expect(() => {
        new UniversalWebContext(
          new Request('http://localhost/'),
          { waitUntil() {} },
          undefined,
          { proxy: ['192.168.0.0/16'] }
        );
      }).toThrow(/proxy: \['<cidr>', \.\.\.\] is not supported on edge runtimes without a socket peer address/);
    });

    it('allows CIDR peer list on Bun (Shape 3) where socket peer address exists', () => {
      const mockServer = {
        requestIP: () => ({ address: '10.0.0.1' }),
      };

      const req = new Request('http://localhost/', {
        headers: { 'x-forwarded-for': '203.0.113.1' },
      });

      const ctx = new UniversalWebContext(req, mockServer, undefined, {
        proxy: ['10.0.0.1'],
      });

      expect(() => ctx.ip).not.toThrow();
      expect(ctx.ip).toBe('203.0.113.1');
    });

    it('allows CIDR peer list on Deno (Shape 4) where socket peer address exists', () => {
      const mockInfo = { remoteAddr: { hostname: '10.0.0.2' } };

      const req = new Request('http://localhost/', {
        headers: { 'x-forwarded-for': '203.0.113.2' },
      });

      const ctx = new UniversalWebContext(req, mockInfo, undefined, {
        proxy: ['10.0.0.2'],
      });

      expect(() => ctx.ip).not.toThrow();
      expect(ctx.ip).toBe('203.0.113.2');
    });
  });

  describe('waitUntil fallback & promise tracking', () => {
    it('tracks background promises and drains them with drainWaitUntil()', async () => {
      const ctx = new UniversalWebContext(new Request('http://localhost/'));

      let task1Finished = false;
      let task2Finished = false;

      const task1 = (async () => {
        await Promise.resolve();
        task1Finished = true;
      })();

      const task2 = (async () => {
        await Promise.resolve();
        task2Finished = true;
      })();

      ctx.waitUntil(task1);
      ctx.waitUntil(task2);

      expect(ctx.pendingWaitUntils).toHaveLength(2);
      expect(ctx.pendingWaitUntils[0]).toBe(task1);
      expect(ctx.pendingWaitUntils[1]).toBe(task2);

      await ctx.drainWaitUntil();

      expect(task1Finished).toBe(true);
      expect(task2Finished).toBe(true);
    });

    it('shields against unhandled rejections in background promises', async () => {
      const ctx = new UniversalWebContext(new Request('http://localhost/'));

      const failingPromise = Promise.reject(new Error('Background analytics failed'));
      ctx.waitUntil(failingPromise);

      // drainWaitUntil should settle without throwing
      await expect(ctx.drainWaitUntil()).resolves.toBeUndefined();
    });

    it('emits development warning when waitUntil is called without host context', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const ctx = new UniversalWebContext(new Request('http://localhost/'), undefined, undefined, {
        isProduction: false,
      });

      ctx.waitUntil(Promise.resolve());
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[nextrush/universal] ctx.waitUntil() was called, but the host environment provided no execution context.')
      );

      // Subsequent call does not warn again on the same context
      ctx.waitUntil(Promise.resolve());
      expect(warnSpy).toHaveBeenCalledTimes(1);

      warnSpy.mockRestore();
    });

    it('does not emit development warning for waitUntil in production mode', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const ctx = new UniversalWebContext(new Request('http://localhost/'), undefined, undefined, {
        isProduction: true,
      });

      ctx.waitUntil(Promise.resolve());
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('Development IP warning', () => {
    it('warns when reading empty IP in development mode with proxy: false', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const ctx = new UniversalWebContext(new Request('http://localhost/'), undefined, undefined, {
        isProduction: false,
        proxy: false,
      });

      expect(ctx.ip).toBe('');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[nextrush/universal] ctx.ip is an empty string because proxy is false')
      );

      // Subsequent read does not warn again
      expect(ctx.ip).toBe('');
      expect(warnSpy).toHaveBeenCalledTimes(1);

      warnSpy.mockRestore();
    });

    it('does not warn when reading IP in production mode', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const ctx = new UniversalWebContext(new Request('http://localhost/'), undefined, undefined, {
        isProduction: true,
        proxy: false,
      });

      expect(ctx.ip).toBe('');
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('createUniversalWebContext factory helper', () => {
    it('constructs an instance identical to new UniversalWebContext', () => {
      const req = new Request('http://localhost/api');
      const ctx = createUniversalWebContext(req, { KV: 'store' });

      expect(ctx).toBeInstanceOf(UniversalWebContext);
      expect(ctx.env).toEqual({ KV: 'store' });
      expect(ctx.path).toBe('/api');
    });
  });
});
