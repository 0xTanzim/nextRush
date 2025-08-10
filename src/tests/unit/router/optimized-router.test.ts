/**
 * Comprehensive tests for OptimizedRouter
 *
 * Tests performance improvements and edge cases
 */

import {
  OptimizedRouter,
  createOptimizedRouter,
} from '@/core/router/optimized-router';
import type { Context } from '@/types/context';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('OptimizedRouter', () => {
  let router: OptimizedRouter;

  beforeEach(() => {
    router = new OptimizedRouter();
  });

  afterEach(() => {
    router.clearCache();
  });

  describe('Route Registration', () => {
    it('should register GET routes', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ message: 'GET test' });
      };

      router.get('/test', handler);
      const match = router.find('GET', '/test');

      expect(match).toBeDefined();
      expect(match?.handler).toBe(handler);
      expect(match?.params).toEqual({});
    });

    it('should register POST routes', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ message: 'POST test' });
      };

      router.post('/test', handler);
      const match = router.find('POST', '/test');

      expect(match).toBeDefined();
      expect(match?.handler).toBe(handler);
    });

    it('should register PUT routes', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ message: 'PUT test' });
      };

      router.put('/test', handler);
      const match = router.find('PUT', '/test');

      expect(match).toBeDefined();
      expect(match?.handler).toBe(handler);
    });

    it('should register DELETE routes', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ message: 'DELETE test' });
      };

      router.delete('/test', handler);
      const match = router.find('DELETE', '/test');

      expect(match).toBeDefined();
      expect(match?.handler).toBe(handler);
    });

    it('should register PATCH routes', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ message: 'PATCH test' });
      };

      router.patch('/test', handler);
      const match = router.find('PATCH', '/test');

      expect(match).toBeDefined();
      expect(match?.handler).toBe(handler);
    });

    it('should handle root path', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ message: 'root' });
      };

      router.get('/', handler);
      const match = router.find('GET', '/');

      expect(match).toBeDefined();
      expect(match?.handler).toBe(handler);
    });

    it('should handle empty path', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ message: 'empty' });
      };

      router.get('', handler);
      const match = router.find('GET', '');

      expect(match).toBeDefined();
      expect(match?.handler).toBe(handler);
    });
  });

  describe('Parameter Routes', () => {
    it('should match parameter routes', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ id: ctx.params.id });
      };

      router.get('/users/:id', handler);
      const match = router.find('GET', '/users/123');

      expect(match).toBeDefined();
      expect(match?.params).toEqual({ id: '123' });
      expect(match?.handler).toBe(handler);
    });

    it('should match multiple parameters', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ userId: ctx.params.userId, postId: ctx.params.postId });
      };

      router.get('/users/:userId/posts/:postId', handler);
      const match = router.find('GET', '/users/123/posts/456');

      expect(match).toBeDefined();
      expect(match?.params).toEqual({ userId: '123', postId: '456' });
    });

    it('should handle parameter at root level', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ id: ctx.params.id });
      };

      router.get('/:id', handler);
      const match = router.find('GET', '/123');

      expect(match).toBeDefined();
      expect(match?.params).toEqual({ id: '123' });
    });

    it('should handle parameter at end', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ name: ctx.params.name });
      };

      router.get('/api/users/:name', handler);
      const match = router.find('GET', '/api/users/john');

      expect(match).toBeDefined();
      expect(match?.params).toEqual({ name: 'john' });
    });
  });

  describe('Route Matching', () => {
    it('should return null for non-existent routes', () => {
      const match = router.find('GET', '/nonexistent');
      expect(match).toBeNull();
    });

    it('should return null for wrong HTTP method', () => {
      router.get('/test', async (ctx: Context) => {
        ctx.res.json({ message: 'test' });
      });

      const match = router.find('POST', '/test');
      expect(match).toBeNull();
    });

    it('should handle nested routes', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ message: 'nested' });
      };

      router.get('/api/v1/users/profile', handler);
      const match = router.find('GET', '/api/v1/users/profile');

      expect(match).toBeDefined();
      expect(match?.handler).toBe(handler);
    });

    it('should handle routes with trailing slash', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ message: 'trailing' });
      };

      router.get('/test', handler);
      const match = router.find('GET', '/test/');

      // By default (strict: false), /test and /test/ should be treated as the same
      expect(match).not.toBeNull();
      expect(match?.handler).toBe(handler);
    });

    it('should handle routes without leading slash', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ message: 'no leading' });
      };

      router.get('/test', handler);
      const match = router.find('GET', 'test');

      expect(match).toBeDefined();
      expect(match?.handler).toBe(handler);
    });
  });

  describe('Caching', () => {
    it('should cache route matches', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ message: 'cached' });
      };

      router.get('/cached', handler);

      // First call should populate cache
      const match1 = router.find('GET', '/cached');
      expect(match1).toBeDefined();

      // Second call should use cache
      const match2 = router.find('GET', '/cached');
      expect(match2).toBeDefined();
      expect(match1).toBe(match2); // Should be the same object
    });

    it('should cache parameter routes', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ id: ctx.params.id });
      };

      router.get('/users/:id', handler);

      const match1 = router.find('GET', '/users/123');
      const match2 = router.find('GET', '/users/123');

      expect(match1).toBeDefined();
      expect(match2).toBeDefined();
      expect(match1?.params).toEqual({ id: '123' });
      expect(match2?.params).toEqual({ id: '123' });
    });

    it('should clear cache', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ message: 'test' });
      };

      router.get('/test', handler);
      router.find('GET', '/test'); // Populate cache

      const statsBefore = router.getCacheStats();
      expect(statsBefore.cache.size).toBeGreaterThan(0);

      router.clearCache();

      const statsAfter = router.getCacheStats();
      expect(statsAfter.cache.size).toBe(0);
    });
  });

  describe('Middleware', () => {
    it('should register middleware', () => {
      const middleware = async (ctx: Context, next: () => Promise<void>) => {
        ctx.state.middleware = true;
        await next();
      };

      router.use(middleware);
      const middlewareList = router.getMiddleware();

      expect(middlewareList).toHaveLength(1);
      expect(middlewareList[0]).toBe(middleware);
    });

    it('should register multiple middleware', () => {
      const middleware1 = async (ctx: Context, next: () => Promise<void>) => {
        await next();
      };
      const middleware2 = async (ctx: Context, next: () => Promise<void>) => {
        await next();
      };

      router.use(middleware1);
      router.use(middleware2);

      const middlewareList = router.getMiddleware();
      expect(middlewareList).toHaveLength(2);
    });
  });

  describe('Sub-routers', () => {
    it('should handle sub-router with parameters', () => {
      const router = new OptimizedRouter();

      // Create a sub-router
      const subRouter = new OptimizedRouter();
      subRouter.get('/:id', async ctx => {
        ctx.res.json({ id: ctx.req.params.id });
      });

      // Use the sub-router with a prefix
      router.use('/api', subRouter);

      // Test the route
      const match = router.find('GET', '/api/123');
      expect(match).toBeDefined();
      expect(match?.params).toEqual({ id: '123' });
    });

    it('should handle nested sub-routers', () => {
      const router = new OptimizedRouter();

      // Create nested sub-routers
      const innerRouter = new OptimizedRouter();
      innerRouter.get('/:commentId', async ctx => {
        ctx.res.json({ commentId: ctx.req.params.commentId });
      });

      const outerRouter = new OptimizedRouter();
      outerRouter.get('/:postId', async ctx => {
        ctx.res.json({ postId: ctx.req.params.postId });
      });
      outerRouter.use('/:postId/comments', innerRouter); // Updated to include :postId in prefix

      router.use('/api/posts', outerRouter);

      // Test nested routes
      const postMatch = router.find('GET', '/api/posts/456');
      expect(postMatch).toBeDefined();
      expect(postMatch?.params).toEqual({ postId: '456' });

      const commentMatch = router.find('GET', '/api/posts/456/comments/789');
      expect(commentMatch).toBeDefined();
      expect(commentMatch?.params).toEqual({ postId: '456', commentId: '789' }); // Updated expectation
    });
  });

  describe('Route Configuration', () => {
    it('should handle route config objects', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ message: 'config' });
      };

      const middleware = async (ctx: Context, next: () => Promise<void>) => {
        ctx.state.config = true;
        await next();
      };

      router.get('/config', {
        handler,
        middleware: [middleware],
      });

      const match = router.find('GET', '/config');
      expect(match).toBeDefined();
      expect(match?.handler).toBe(handler);

      const middlewareList = router.getMiddleware();
      expect(middlewareList).toHaveLength(1);
      expect(middlewareList[0]).toBe(middleware);
    });
  });

  describe('Performance Tests', () => {
    it('should handle many routes efficiently', () => {
      const routes = [
        '/api/users',
        '/api/users/:id',
        '/api/users/:id/posts',
        '/api/users/:id/posts/:postId',
        '/api/posts',
        '/api/posts/:id',
        '/api/comments',
        '/api/comments/:id',
        '/api/likes',
        '/api/likes/:id',
      ];

      // Register many routes
      routes.forEach((route, index) => {
        router.get(route, async (ctx: Context) => {
          ctx.res.json({ route: index });
        });
      });

      // Test route matching performance
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        router.find('GET', '/api/users/123');
      }
      const end = performance.now();

      expect(end - start).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should handle deep nested routes without stack overflow', () => {
      // Create a deeply nested route
      let path = '';
      for (let i = 0; i < 100; i++) {
        path += `/level${i}`;
        router.get(path, async (ctx: Context) => {
          ctx.res.json({ level: i });
        });
      }

      // This should not throw a stack overflow error
      expect(() => {
        router.find('GET', path);
      }).not.toThrow();
    });

    it('should reuse parameter objects from pool', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ params: ctx.params });
      };

      router.get('/users/:id/posts/:postId', handler);

      // Make multiple requests to test parameter object reuse
      for (let i = 0; i < 10; i++) {
        const match = router.find('GET', `/users/${i}/posts/${i * 2}`);
        expect(match).toBeDefined();
        expect(match?.params).toEqual({
          id: i.toString(),
          postId: (i * 2).toString(),
        });
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty path segments', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ message: 'empty segments' });
      };

      router.get('/test//path', handler);
      const match = router.find('GET', '/test//path');

      expect(match).toBeDefined();
      expect(match?.handler).toBe(handler);
    });

    it('should handle special characters in paths', () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ message: 'special chars' });
      };

      router.get('/test-path_with_underscores', handler);
      const match = router.find('GET', '/test-path_with_underscores');

      expect(match).toBeDefined();
      expect(match?.handler).toBe(handler);
    });

    it('should handle very long paths', () => {
      const longPath = '/a'.repeat(1000);
      const handler = async (ctx: Context) => {
        ctx.res.json({ message: 'long path' });
      };

      router.get(longPath, handler);
      const match = router.find('GET', longPath);

      expect(match).toBeDefined();
      expect(match?.handler).toBe(handler);
    });

    it('should handle concurrent access', async () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ message: 'concurrent' });
      };

      router.get('/concurrent', handler);

      // Simulate concurrent access
      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve(router.find('GET', '/concurrent'))
      );

      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result?.handler).toBe(handler);
      });
    });
  });

  describe('createOptimizedRouter', () => {
    it('should create router with prefix', () => {
      const router = createOptimizedRouter('/api');
      const handler = async (ctx: Context) => {
        ctx.res.json({ message: 'prefixed' });
      };

      router.get('/users', handler);
      const match = router.find('GET', '/api/users');

      expect(match).toBeDefined();
      expect(match?.handler).toBe(handler);
    });

    it('should create router with custom cache size', () => {
      const router = createOptimizedRouter('', 500);
      const stats = router.getCacheStats();

      // The cache size should be configurable
      expect(stats.cache.size).toBe(0);
    });
  });
});
