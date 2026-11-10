/**
 * @nextrush/router - Multi-Prefix Sub-Router Mounting Tests
 *
 * Tests for mounting sub-routers across multiple path prefixes simultaneously
 * (router.mount(['/api', '/v1'], subRouter)), validating input arrays,
 * prefix normalization, root mounts, route parameter preservation,
 * and segment boundary isolation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, Router } from '../router';

describe('Multi-Prefix Sub-Router Mounting (router.mount)', () => {
  let router: Router;

  beforeEach(() => {
    router = createRouter();
  });

  describe('Feature 1: Multi-prefix mounting and route resolution', () => {
    it('mounts sub-router routes across multiple prefixes simultaneously', () => {
      const subRouter = createRouter();
      const handler = vi.fn();
      subRouter.get('/users', handler);

      router.mount(['/api', '/v1'], subRouter);

      const matchApi = router.match('GET', '/api/users');
      expect(matchApi).not.toBeNull();
      expect(matchApi?.handler).toBe(handler);

      const matchV1 = router.match('GET', '/v1/users');
      expect(matchV1).not.toBeNull();
      expect(matchV1?.handler).toBe(handler);
    });

    it('mounts across three or more prefixes', () => {
      const subRouter = createRouter();
      subRouter.get('/items', vi.fn());

      router.mount(['/api/v1', '/api/v2', '/internal/api'], subRouter);

      for (const prefix of ['/api/v1', '/api/v2', '/internal/api']) {
        const match = router.match('GET', `${prefix}/items`);
        expect(match).not.toBeNull();
      }
    });

    it('preserves route parameters across all mounted prefixes', () => {
      const subRouter = createRouter();
      subRouter.get('/users/:userId/posts/:postId', vi.fn());

      router.mount(['/api', '/v1'], subRouter);

      const matchApi = router.match('GET', '/api/users/42/posts/100');
      expect(matchApi).not.toBeNull();
      expect(matchApi?.params.userId).toBe('42');
      expect(matchApi?.params.postId).toBe('100');

      const matchV1 = router.match('GET', '/v1/users/99/posts/200');
      expect(matchV1).not.toBeNull();
      expect(matchV1?.params.userId).toBe('99');
      expect(matchV1?.params.postId).toBe('200');
    });

    it('preserves multiple HTTP methods across all prefixes', () => {
      const subRouter = createRouter();
      const getFn = vi.fn();
      const postFn = vi.fn();
      const deleteFn = vi.fn();

      subRouter.get('/resource', getFn);
      subRouter.post('/resource', postFn);
      subRouter.delete('/resource', deleteFn);

      router.mount(['/api', '/v1'], subRouter);

      for (const prefix of ['/api', '/v1']) {
        expect(router.match('GET', `${prefix}/resource`)?.handler).toBe(getFn);
        expect(router.match('POST', `${prefix}/resource`)?.handler).toBe(postFn);
        expect(router.match('DELETE', `${prefix}/resource`)?.handler).toBe(deleteFn);
      }
    });

    it('supports chaining mount calls', () => {
      const sub1 = createRouter();
      sub1.get('/foo', vi.fn());

      const sub2 = createRouter();
      sub2.get('/bar', vi.fn());

      router
        .mount(['/a', '/b'], sub1)
        .mount(['/c', '/d'], sub2);

      expect(router.match('GET', '/a/foo')).not.toBeNull();
      expect(router.match('GET', '/b/foo')).not.toBeNull();
      expect(router.match('GET', '/c/bar')).not.toBeNull();
      expect(router.match('GET', '/d/bar')).not.toBeNull();
    });

    it('supports readonly string arrays', () => {
      const prefixes: readonly string[] = Object.freeze(['/v1', '/v2'] as const);
      const subRouter = createRouter();
      subRouter.get('/ping', vi.fn());

      router.mount(prefixes, subRouter);

      expect(router.match('GET', '/v1/ping')).not.toBeNull();
      expect(router.match('GET', '/v2/ping')).not.toBeNull();
    });
  });

  describe('Feature 2: Empty prefix array guard', () => {
    it('throws descriptive Error when empty array is passed to mount()', () => {
      const subRouter = createRouter();

      expect(() => {
        router.mount([], subRouter);
      }).toThrowError('router.mount() requires at least one path prefix when an array is provided');
    });

    it('does not register any routes when empty array throws', () => {
      const subRouter = createRouter();
      subRouter.get('/test', vi.fn());

      expect(() => router.mount([], subRouter)).toThrow();
      expect(router.getRoutes().length).toBe(0);
    });
  });

  describe('Feature 3: Type validation', () => {
    it('throws TypeError when array element is null', () => {
      const subRouter = createRouter();
      expect(() => {
        router.mount(['/api', null as unknown as string], subRouter);
      }).toThrow(new TypeError('Route path prefix must be a string, received null'));
    });

    it('throws TypeError when array element is undefined', () => {
      const subRouter = createRouter();
      expect(() => {
        router.mount(['/api', undefined as unknown as string], subRouter);
      }).toThrow(new TypeError('Route path prefix must be a string, received undefined'));
    });

    it('throws TypeError when array element is a number', () => {
      const subRouter = createRouter();
      expect(() => {
        router.mount(['/api', 42 as unknown as string], subRouter);
      }).toThrow(new TypeError('Route path prefix must be a string, received number'));
    });

    it('throws TypeError when array element is an empty string', () => {
      const subRouter = createRouter();
      expect(() => {
        router.mount(['/api', ''], subRouter);
      }).toThrow(new TypeError('Route path prefix must be a non-empty string'));
    });

    it('throws TypeError when prefix is not a string or array', () => {
      const subRouter = createRouter();
      expect(() => {
        router.mount(123 as unknown as string, subRouter);
      }).toThrow(
        new TypeError('Route path prefix must be a string or array of strings, received number')
      );
    });

    it('throws TypeError when router is not a Router instance', () => {
      expect(() => {
        router.mount('/api', {} as unknown as Router);
      }).toThrow(new TypeError('router.mount() requires a Router instance'));

      expect(() => {
        router.mount(['/api', '/v1'], null as unknown as Router);
      }).toThrow(new TypeError('router.mount() requires a Router instance'));
    });
  });

  describe('Feature 4: Prefix normalization & root mount in array', () => {
    it('normalizes prefixes with trailing slashes and lacking leading slashes', () => {
      const subRouter = createRouter();
      subRouter.get('/health', vi.fn());

      router.mount(['api/', 'v1/'], subRouter);

      expect(router.match('GET', '/api/health')).not.toBeNull();
      expect(router.match('GET', '/v1/health')).not.toBeNull();
    });

    it('supports root mount alongside prefixes in array (e.g. ["/api", "/"])', () => {
      const subRouter = createRouter();
      const handler = vi.fn();
      subRouter.get('/status', handler);

      router.mount(['/api', '/'], subRouter);

      const matchApi = router.match('GET', '/api/status');
      expect(matchApi).not.toBeNull();
      expect(matchApi?.handler).toBe(handler);

      const matchRoot = router.match('GET', '/status');
      expect(matchRoot).not.toBeNull();
      expect(matchRoot?.handler).toBe(handler);
    });

    it('supports root prefix as first element in array (e.g. ["/", "/v1"])', () => {
      const subRouter = createRouter();
      subRouter.get('/ping', vi.fn());

      router.mount(['/', '/v1'], subRouter);

      expect(router.match('GET', '/ping')).not.toBeNull();
      expect(router.match('GET', '/v1/ping')).not.toBeNull();
    });
  });

  describe('Feature 5: Sub-router middleware propagation', () => {
    it('carries sub-router middleware to each mounted prefix', async () => {
      const subRouter = createRouter();
      const executed: string[] = [];

      subRouter.use(async (_ctx, next) => {
        executed.push('sub-middleware');
        await next();
      });

      subRouter.get('/test', async (ctx) => {
        executed.push(`handler:${ctx.path}`);
      });

      router.mount(['/api', '/v1'], subRouter);

      const routes = router.getRoutes();
      expect(routes.length).toBe(2);

      const matchApi = router.match('GET', '/api/test');
      expect(matchApi).not.toBeNull();
      const mockCtxApi = { path: '/api/test' } as any;
      await matchApi?.executor(mockCtxApi);
      expect(executed).toEqual(['sub-middleware', 'handler:/api/test']);

      executed.length = 0;
      const matchV1 = router.match('GET', '/v1/test');
      expect(matchV1).not.toBeNull();
      const mockCtxV1 = { path: '/v1/test' } as any;
      await matchV1?.executor(mockCtxV1);
      expect(executed).toEqual(['sub-middleware', 'handler:/v1/test']);
    });
  });

  describe('Feature 6: Segment boundary isolation', () => {
    it('does not match prefix substring on segment boundary collision (/api vs /apigateway)', () => {
      const subRouter = createRouter();
      subRouter.get('/users', vi.fn());

      router.mount(['/api', '/v1'], subRouter);

      expect(router.match('GET', '/api/users')).not.toBeNull();
      expect(router.match('GET', '/apigateway/users')).toBeNull();
      expect(router.match('GET', '/api-extra/users')).toBeNull();
    });
  });

  describe('Feature 7: router.use() parity with multi-prefix', () => {
    it('supports array of prefixes in router.use(prefixes, subRouter)', () => {
      const subRouter = createRouter();
      const handler = vi.fn();
      subRouter.get('/info', handler);

      router.use(['/api', '/v1'], subRouter);

      expect(router.match('GET', '/api/info')?.handler).toBe(handler);
      expect(router.match('GET', '/v1/info')?.handler).toBe(handler);
    });

    it('throws error when router.use(prefixes) is called without second Router argument', () => {
      expect(() => {
        router.use(['/api', '/v1']);
      }).toThrowError(/router.use\(prefixes, ...\) requires a Router instance as the second argument/);
    });
  });

  describe('Route introspection across multi-prefix', () => {
    it('registers introspection rows under each mounted prefix', () => {
      const subRouter = createRouter();
      subRouter.get('/a', vi.fn());
      subRouter.post('/b', vi.fn());

      router.mount(['/api', '/v1'], subRouter);

      const routes = router.getRoutes();
      expect(routes.length).toBe(4);

      const paths = routes.map((r) => `${r.method} ${r.path}`).sort();
      expect(paths).toEqual([
        'GET /api/a',
        'GET /v1/a',
        'POST /api/b',
        'POST /v1/b',
      ]);
    });
  });
});
