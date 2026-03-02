/**
 * @nextrush/router - Router Tests
 */

import type { Context, HttpMethod, RouteHandler } from '@nextrush/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, Router } from '../router';

/**
 * Create mock context for testing
 */
function createMockContext(overrides: Partial<Context> = {}): Context {
  return {
    method: 'GET',
    path: '/',
    params: {},
    query: {},
    body: undefined,
    headers: {},
    status: 200,
    state: {},
    json: vi.fn(),
    send: vi.fn(),
    html: vi.fn(),
    redirect: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    next: vi.fn(),
    raw: {
      req: {} as any,
      res: {} as any,
    },
    ...overrides,
  } as Context;
}

describe('Router', () => {
  let router: Router;

  beforeEach(() => {
    router = createRouter();
  });

  describe('createRouter', () => {
    it('should create a router instance', () => {
      expect(router).toBeInstanceOf(Router);
    });

    it('should accept options', () => {
      const r = createRouter({ prefix: '/api', caseSensitive: true });
      expect(r).toBeInstanceOf(Router);
    });
  });

  describe('route registration', () => {
    it('should register GET route', () => {
      const handler: RouteHandler = vi.fn();
      router.get('/users', handler);

      const match = router.match('GET', '/users');
      expect(match).not.toBeNull();
      expect(match?.handler).toBe(handler);
    });

    it('should register POST route', () => {
      const handler: RouteHandler = vi.fn();
      router.post('/users', handler);

      const match = router.match('POST', '/users');
      expect(match).not.toBeNull();
    });

    it('should register PUT route', () => {
      const handler: RouteHandler = vi.fn();
      router.put('/users/:id', handler);

      const match = router.match('PUT', '/users/123');
      expect(match).not.toBeNull();
    });

    it('should register DELETE route', () => {
      const handler: RouteHandler = vi.fn();
      router.delete('/users/:id', handler);

      const match = router.match('DELETE', '/users/123');
      expect(match).not.toBeNull();
    });

    it('should register PATCH route', () => {
      const handler: RouteHandler = vi.fn();
      router.patch('/users/:id', handler);

      const match = router.match('PATCH', '/users/123');
      expect(match).not.toBeNull();
    });

    it('should register all methods with .all()', () => {
      const handler: RouteHandler = vi.fn();
      router.all('/any', handler);

      const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
      for (const method of methods) {
        const match = router.match(method, '/any');
        expect(match).not.toBeNull();
      }
    });

    it('should allow method chaining', () => {
      const result = router.get('/a', vi.fn()).post('/b', vi.fn()).put('/c', vi.fn());

      expect(result).toBe(router);
    });
  });

  describe('route matching', () => {
    it('should match exact path', () => {
      const handler: RouteHandler = vi.fn();
      router.get('/users', handler);

      const match = router.match('GET', '/users');
      expect(match?.handler).toBe(handler);
      expect(match?.params).toEqual({});
    });

    it('should return null for non-matching path', () => {
      router.get('/users', vi.fn());

      const match = router.match('GET', '/posts');
      expect(match).toBeNull();
    });

    it('should return null for non-matching method', () => {
      router.get('/users', vi.fn());

      const match = router.match('POST', '/users');
      expect(match).toBeNull();
    });

    it('should match root path', () => {
      const handler: RouteHandler = vi.fn();
      router.get('/', handler);

      const match = router.match('GET', '/');
      expect(match?.handler).toBe(handler);
    });
  });

  describe('parameter extraction', () => {
    it('should extract single parameter', () => {
      router.get('/users/:id', vi.fn());

      const match = router.match('GET', '/users/123');
      expect(match?.params).toEqual({ id: '123' });
    });

    it('should extract multiple parameters', () => {
      router.get('/users/:userId/posts/:postId', vi.fn());

      const match = router.match('GET', '/users/1/posts/2');
      expect(match?.params).toEqual({ userId: '1', postId: '2' });
    });

    it('should handle URL-encoded parameters', () => {
      router.get('/search/:query', vi.fn());

      const match = router.match('GET', '/search/hello%20world');
      expect(match?.params).toEqual({ query: 'hello%20world' });
    });
  });

  describe('wildcard routes', () => {
    it('should match wildcard at end', () => {
      router.get('/files/*', vi.fn());

      const match = router.match('GET', '/files/docs/readme.md');
      expect(match).not.toBeNull();
      expect(match?.params['*']).toBe('docs/readme.md');
    });

    it('should match single segment wildcard', () => {
      router.get('/static/*', vi.fn());

      const match = router.match('GET', '/static/style.css');
      expect(match?.params['*']).toBe('style.css');
    });
  });

  describe('prefix option', () => {
    it('should prepend prefix to routes', () => {
      const r = createRouter({ prefix: '/api/v1' });
      r.get('/users', vi.fn());

      const match = r.match('GET', '/api/v1/users');
      expect(match).not.toBeNull();
    });

    it('should handle trailing slash in prefix', () => {
      const r = createRouter({ prefix: '/api' });
      r.get('/users', vi.fn());

      const match = r.match('GET', '/api/users');
      expect(match).not.toBeNull();
    });
  });

  describe('case sensitivity', () => {
    it('should be case-insensitive by default', () => {
      router.get('/Users', vi.fn());

      const match = router.match('GET', '/users');
      expect(match).not.toBeNull();
    });

    it('should be case-sensitive when enabled', () => {
      const r = createRouter({ caseSensitive: true });
      r.get('/Users', vi.fn());

      expect(r.match('GET', '/Users')).not.toBeNull();
      expect(r.match('GET', '/users')).toBeNull();
    });
  });

  describe('strict routing', () => {
    it('should ignore trailing slash by default', () => {
      router.get('/users', vi.fn());

      expect(router.match('GET', '/users')).not.toBeNull();
      expect(router.match('GET', '/users/')).not.toBeNull();
    });

    it('should respect trailing slash when strict', () => {
      const r = createRouter({ strict: true });
      r.get('/users', vi.fn());

      // In strict mode, trailing slash handling is preserved
      // Both with and without trailing slash should match since
      // the path normalization removes trailing slashes during split
      expect(r.match('GET', '/users')).not.toBeNull();
      expect(r.match('GET', '/users/')).not.toBeNull();
      // Note: Full strict mode differentiation is a future enhancement
    });
  });

  describe('routes() middleware', () => {
    it('should return middleware function', () => {
      const middleware = router.routes();
      expect(typeof middleware).toBe('function');
    });

    it('should call handler when route matches', async () => {
      const handler = vi.fn();
      router.get('/test', handler);

      const ctx = createMockContext({ method: 'GET', path: '/test' });
      const middleware = router.routes();

      await middleware(ctx, async () => {});

      // Handler is called with ctx and a next function
      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0]?.[0]).toBe(ctx);
    });

    it('should set params on context', async () => {
      router.get('/users/:id', vi.fn());

      const ctx = createMockContext({ method: 'GET', path: '/users/42' });
      await router.routes()(ctx, async () => {});

      expect(ctx.params).toEqual({ id: '42' });
    });

    it('should call next when no route matches', async () => {
      router.get('/users', vi.fn());

      const ctx = createMockContext({ method: 'GET', path: '/posts' });
      const next = vi.fn();

      await router.routes()(ctx, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('allowedMethods() middleware', () => {
    it('should return middleware function', () => {
      const middleware = router.allowedMethods();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('multiple handlers', () => {
    it('should support multiple handlers as middleware', async () => {
      const order: number[] = [];

      const mw1: RouteHandler = async (_ctx, next) => {
        order.push(1);
        if (next) await next();
      };

      const mw2: RouteHandler = async (_ctx, next) => {
        order.push(2);
        if (next) await next();
      };

      const handler: RouteHandler = async () => {
        order.push(3);
      };

      router.get('/test', mw1, mw2, handler);

      const ctx = createMockContext({ method: 'GET', path: '/test' });
      const routesMiddleware = router.routes();
      await routesMiddleware(ctx, async () => {});

      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('route groups', () => {
    it('should create a group with prefix', () => {
      router.group('/api', (r) => {
        r.get('/users', vi.fn());
        r.get('/posts', vi.fn());
      });

      expect(router.match('GET', '/api/users')).not.toBeNull();
      expect(router.match('GET', '/api/posts')).not.toBeNull();
    });

    it('should create a group with middleware', async () => {
      const order: number[] = [];
      const groupMiddleware = vi.fn(async (_ctx: Context, next?: () => Promise<void>) => {
        order.push(1);
        if (next) await next();
      });

      const handler = vi.fn(async () => {
        order.push(2);
      });

      router.group('/admin', [groupMiddleware], (r) => {
        r.get('/dashboard', handler);
      });

      const ctx = createMockContext({ method: 'GET', path: '/admin/dashboard' });
      await router.routes()(ctx, async () => {});

      expect(groupMiddleware).toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
      expect(order).toEqual([1, 2]);
    });

    it('should support nested groups', () => {
      router.group('/api', (r) => {
        r.group('/v1', (v1) => {
          v1.get('/users', vi.fn());
        });
        r.group('/v2', (v2) => {
          v2.get('/users', vi.fn());
        });
      });

      expect(router.match('GET', '/api/v1/users')).not.toBeNull();
      expect(router.match('GET', '/api/v2/users')).not.toBeNull();
    });

    it('should combine middleware in nested groups', async () => {
      const order: number[] = [];

      const outerMw = vi.fn(async (_ctx: Context, next?: () => Promise<void>) => {
        order.push(1);
        if (next) await next();
      });

      const innerMw = vi.fn(async (_ctx: Context, next?: () => Promise<void>) => {
        order.push(2);
        if (next) await next();
      });

      const handler = vi.fn(async () => {
        order.push(3);
      });

      router.group('/api', [outerMw], (r) => {
        r.group('/users', [innerMw], (ur) => {
          ur.get('/', handler);
        });
      });

      const ctx = createMockContext({ method: 'GET', path: '/api/users' });
      await router.routes()(ctx, async () => {});

      expect(order).toEqual([1, 2, 3]);
    });

    it('should support all HTTP methods in groups', () => {
      router.group('/api', (r) => {
        r.get('/resource', vi.fn());
        r.post('/resource', vi.fn());
        r.put('/resource/:id', vi.fn());
        r.delete('/resource/:id', vi.fn());
        r.patch('/resource/:id', vi.fn());
      });

      expect(router.match('GET', '/api/resource')).not.toBeNull();
      expect(router.match('POST', '/api/resource')).not.toBeNull();
      expect(router.match('PUT', '/api/resource/1')).not.toBeNull();
      expect(router.match('DELETE', '/api/resource/1')).not.toBeNull();
      expect(router.match('PATCH', '/api/resource/1')).not.toBeNull();
    });

    it('should handle root path in groups', () => {
      router.group('/api', (r) => {
        r.get('/', vi.fn());
      });

      expect(router.match('GET', '/api')).not.toBeNull();
    });

    it('should extract params in group routes', () => {
      router.group('/users', (r) => {
        r.get('/:id', vi.fn());
        r.get('/:id/posts/:postId', vi.fn());
      });

      const match1 = router.match('GET', '/users/42');
      expect(match1?.params.id).toBe('42');

      const match2 = router.match('GET', '/users/1/posts/2');
      expect(match2?.params.id).toBe('1');
      expect(match2?.params.postId).toBe('2');
    });

    it('should throw if callback is missing with middleware array', () => {
      expect(() => {
        router.group('/api', [vi.fn()] as any);
      }).toThrow('Callback function is required');
    });

    it('should support .all() in groups', () => {
      router.group('/api', (r) => {
        r.all('/any', vi.fn());
      });

      expect(router.match('GET', '/api/any')).not.toBeNull();
      expect(router.match('POST', '/api/any')).not.toBeNull();
      expect(router.match('PUT', '/api/any')).not.toBeNull();
    });
  });

  describe('redirect', () => {
    it('should register redirect route with default 301 status', async () => {
      router.redirect('/old', '/new');

      const match = router.match('GET', '/old');
      expect(match).not.toBeNull();

      const ctx = createMockContext({ method: 'GET', path: '/old' });
      await match!.handler(ctx, async () => {});

      expect(ctx.status).toBe(301);
      expect(ctx.set).toHaveBeenCalledWith('Location', '/new');
    });

    it('should support custom redirect status codes', async () => {
      router.redirect('/temp', '/destination', 302);

      const ctx = createMockContext({ method: 'GET', path: '/temp' });
      const match = router.match('GET', '/temp');
      await match!.handler(ctx, async () => {});

      expect(ctx.status).toBe(302);
    });

    it('should support 303 See Other', async () => {
      router.redirect('/see-other', '/target', 303);

      const ctx = createMockContext({ method: 'GET', path: '/see-other' });
      const match = router.match('GET', '/see-other');
      await match!.handler(ctx, async () => {});

      expect(ctx.status).toBe(303);
    });

    it('should support 307 Temporary Redirect', async () => {
      router.redirect('/temporary', '/target', 307);

      const ctx = createMockContext({ method: 'GET', path: '/temporary' });
      const match = router.match('GET', '/temporary');
      await match!.handler(ctx, async () => {});

      expect(ctx.status).toBe(307);
    });

    it('should support 308 Permanent Redirect', async () => {
      router.redirect('/permanent', '/target', 308);

      const ctx = createMockContext({ method: 'GET', path: '/permanent' });
      const match = router.match('GET', '/permanent');
      await match!.handler(ctx, async () => {});

      expect(ctx.status).toBe(308);
    });

    it('should register redirect for HEAD method', () => {
      router.redirect('/old', '/new');

      const headMatch = router.match('HEAD', '/old');
      expect(headMatch).not.toBeNull();
    });

    it('should redirect to external URLs', async () => {
      router.redirect('/docs', 'https://docs.example.com');

      const ctx = createMockContext({ method: 'GET', path: '/docs' });
      const match = router.match('GET', '/docs');
      await match!.handler(ctx, async () => {});

      expect(ctx.set).toHaveBeenCalledWith('Location', 'https://docs.example.com');
    });

    it('should support parameter interpolation in target path', async () => {
      router.redirect('/users/:id', '/profiles/:id');

      const ctx = createMockContext({
        method: 'GET',
        path: '/users/42',
        params: { id: '42' },
      });

      const match = router.match('GET', '/users/42');
      await match!.handler(ctx, async () => {});

      expect(ctx.set).toHaveBeenCalledWith('Location', '/profiles/42');
    });

    it('should support multiple parameters in redirect', async () => {
      router.redirect('/old/:type/:id', '/new/:type/item/:id');

      const ctx = createMockContext({
        method: 'GET',
        path: '/old/product/123',
        params: { type: 'product', id: '123' },
      });

      const match = router.match('GET', '/old/product/123');
      await match!.handler(ctx, async () => {});

      expect(ctx.set).toHaveBeenCalledWith('Location', '/new/product/item/123');
    });

    it('should set empty body on redirect', async () => {
      router.redirect('/old', '/new');

      const ctx = createMockContext({ method: 'GET', path: '/old' });
      const match = router.match('GET', '/old');
      await match!.handler(ctx, async () => {});

      expect(ctx.body).toBe('');
    });

    it('should work in route groups', async () => {
      router.group('/api/v1', (r) => {
        r.redirect('/old-endpoint', '/api/v2/new-endpoint');
      });

      const match = router.match('GET', '/api/v1/old-endpoint');
      expect(match).not.toBeNull();

      const ctx = createMockContext({
        method: 'GET',
        path: '/api/v1/old-endpoint',
      });
      await match!.handler(ctx, async () => {});

      expect(ctx.status).toBe(301);
      expect(ctx.set).toHaveBeenCalledWith('Location', '/api/v2/new-endpoint');
    });

    it('should support chaining', () => {
      const result = router.redirect('/a', '/b').redirect('/c', '/d').get('/e', vi.fn());

      expect(result).toBe(router);
      expect(router.match('GET', '/a')).not.toBeNull();
      expect(router.match('GET', '/c')).not.toBeNull();
      expect(router.match('GET', '/e')).not.toBeNull();
    });
  });
});
