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

      // Check route-specific middleware from the match
      expect(match?.middleware).toHaveLength(1);
      expect(match?.middleware[0]).toBe(middleware);

      // Router getMiddleware() should return router-level middleware (empty in this case)
      const routerMiddleware = router.getMiddleware();
      expect(routerMiddleware).toHaveLength(0);
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

  describe('Multi-Level Routing Tests', () => {
    describe('Complex Parameter Patterns', () => {
      it('should handle /root/:param_1/abc/:param2', () => {
        const handler = async (ctx: Context) => {
          ctx.res.json({
            param_1: ctx.params.param_1,
            param2: ctx.params.param2,
            message: 'Multi-level route match',
          });
        };

        router.get('/root/:param_1/abc/:param2', handler);
        const match = router.find('GET', '/root/value1/abc/value2');

        expect(match).toBeDefined();
        expect(match?.handler).toBe(handler);
        expect(match?.params).toEqual({
          param_1: 'value1',
          param2: 'value2',
        });
        expect(match?.path).toBe('/root/value1/abc/value2');
      });

      it('should handle /root/:param_1/abc/:param2/xyz/:param3', () => {
        const handler = async (ctx: Context) => {
          ctx.res.json({
            param_1: ctx.params.param_1,
            param2: ctx.params.param2,
            param3: ctx.params.param3,
            message: 'Deep multi-level route match',
          });
        };

        router.get('/root/:param_1/abc/:param2/xyz/:param3', handler);
        const match = router.find(
          'GET',
          '/root/user123/abc/post456/xyz/comment789'
        );

        expect(match).toBeDefined();
        expect(match?.handler).toBe(handler);
        expect(match?.params).toEqual({
          param_1: 'user123',
          param2: 'post456',
          param3: 'comment789',
        });
        expect(match?.path).toBe('/root/user123/abc/post456/xyz/comment789');
      });

      it('should handle multiple routes with same prefix but different parameters', () => {
        const handler1 = async (ctx: Context) => {
          ctx.res.json({ route: 'handler1', params: ctx.params });
        };
        const handler2 = async (ctx: Context) => {
          ctx.res.json({ route: 'handler2', params: ctx.params });
        };

        router.get('/root/:param_1/abc/:param2', handler1);
        router.get('/root/:param_1/abc/:param2/xyz/:param3', handler2);

        // Test shorter route
        const match1 = router.find('GET', '/root/test1/abc/test2');
        expect(match1).toBeDefined();
        expect(match1?.handler).toBe(handler1);
        expect(match1?.params).toEqual({ param_1: 'test1', param2: 'test2' });

        // Test longer route
        const match2 = router.find('GET', '/root/test1/abc/test2/xyz/test3');
        expect(match2).toBeDefined();
        expect(match2?.handler).toBe(handler2);
        expect(match2?.params).toEqual({
          param_1: 'test1',
          param2: 'test2',
          param3: 'test3',
        });
      });
    });

    describe('Advanced Multi-Level Parameter Scenarios', () => {
      it('should handle different HTTP methods on same multi-level route', () => {
        const getHandler = async (ctx: Context) => {
          ctx.res.json({ method: 'GET', params: ctx.params });
        };
        const postHandler = async (ctx: Context) => {
          ctx.res.json({ method: 'POST', params: ctx.params });
        };
        const deleteHandler = async (ctx: Context) => {
          ctx.res.json({ method: 'DELETE', params: ctx.params });
        };

        router.get('/root/:param_1/abc/:param2', getHandler);
        router.post('/root/:param_1/abc/:param2', postHandler);
        router.delete('/root/:param_1/abc/:param2', deleteHandler);

        const getMatch = router.find('GET', '/root/user1/abc/data1');
        const postMatch = router.find('POST', '/root/user1/abc/data1');
        const deleteMatch = router.find('DELETE', '/root/user1/abc/data1');

        expect(getMatch?.handler).toBe(getHandler);
        expect(postMatch?.handler).toBe(postHandler);
        expect(deleteMatch?.handler).toBe(deleteHandler);

        // All should have the same parameters
        const expectedParams = { param_1: 'user1', param2: 'data1' };
        expect(getMatch?.params).toEqual(expectedParams);
        expect(postMatch?.params).toEqual(expectedParams);
        expect(deleteMatch?.params).toEqual(expectedParams);
      });

      it('should handle mixed static and dynamic segments', () => {
        const handler = async (ctx: Context) => {
          ctx.res.json({
            action: 'mixed-segments',
            params: ctx.params,
          });
        };

        // Pattern: /api/v1/users/:userId/posts/:postId/comments/:commentId/likes
        router.get(
          '/api/v1/users/:userId/posts/:postId/comments/:commentId/likes',
          handler
        );

        const match = router.find(
          'GET',
          '/api/v1/users/john123/posts/post456/comments/comment789/likes'
        );

        expect(match).toBeDefined();
        expect(match?.handler).toBe(handler);
        expect(match?.params).toEqual({
          userId: 'john123',
          postId: 'post456',
          commentId: 'comment789',
        });
      });

      it('should handle parameter names with underscores and numbers', () => {
        const handler = async (ctx: Context) => {
          ctx.res.json({
            params: ctx.params,
            message: 'Complex parameter names',
          });
        };

        router.get(
          '/api/:api_version/users/:user_id_123/data/:data_param_v2',
          handler
        );
        const match = router.find(
          'GET',
          '/api/v2.1/users/user_456/data/dataset_789'
        );

        expect(match).toBeDefined();
        expect(match?.params).toEqual({
          api_version: 'v2.1',
          user_id_123: 'user_456',
          data_param_v2: 'dataset_789',
        });
      });

      it('should handle very deep multi-level routes', () => {
        const handler = async (ctx: Context) => {
          ctx.res.json({
            depth: 'very-deep',
            params: ctx.params,
          });
        };

        // 8 levels deep with alternating static/dynamic segments
        router.get(
          '/level1/:p1/level2/:p2/level3/:p3/level4/:p4/level5/:p5',
          handler
        );

        const match = router.find(
          'GET',
          '/level1/val1/level2/val2/level3/val3/level4/val4/level5/val5'
        );

        expect(match).toBeDefined();
        expect(match?.params).toEqual({
          p1: 'val1',
          p2: 'val2',
          p3: 'val3',
          p4: 'val4',
          p5: 'val5',
        });
      });

      it('should handle URL-encoded parameter values', () => {
        const handler = async (ctx: Context) => {
          ctx.res.json({ params: ctx.params });
        };

        router.get('/root/:param_1/abc/:param2', handler);

        // Test with URL-encoded values
        const match = router.find(
          'GET',
          '/root/hello%20world/abc/test%2Bvalue'
        );

        expect(match).toBeDefined();
        expect(match?.params).toEqual({
          param_1: 'hello%20world', // Router doesn't decode - that's handled by HTTP layer
          param2: 'test%2Bvalue',
        });
      });

      it('should handle numeric parameter values', () => {
        const handler = async (ctx: Context) => {
          ctx.res.json({ params: ctx.params });
        };

        router.get('/root/:param_1/abc/:param2/xyz/:param3', handler);

        const match = router.find('GET', '/root/123/abc/456/xyz/789');

        expect(match).toBeDefined();
        expect(match?.params).toEqual({
          param_1: '123',
          param2: '456',
          param3: '789',
        });
      });

      it('should handle parameter values with special characters', () => {
        const handler = async (ctx: Context) => {
          ctx.res.json({ params: ctx.params });
        };

        router.get('/root/:param_1/abc/:param2', handler);

        const match = router.find('GET', '/root/user-123_test/abc/data.json');

        expect(match).toBeDefined();
        expect(match?.params).toEqual({
          param_1: 'user-123_test',
          param2: 'data.json',
        });
      });

      it('should not match incomplete multi-level routes', () => {
        const handler = async (ctx: Context) => {
          ctx.res.json({ params: ctx.params });
        };

        router.get('/root/:param_1/abc/:param2/xyz/:param3', handler);

        // Should not match incomplete paths
        expect(router.find('GET', '/root/value1')).toBeNull();
        expect(router.find('GET', '/root/value1/abc')).toBeNull();
        expect(router.find('GET', '/root/value1/abc/value2')).toBeNull();
        expect(router.find('GET', '/root/value1/abc/value2/xyz')).toBeNull();

        // Should match complete path
        const completeMatch = router.find(
          'GET',
          '/root/value1/abc/value2/xyz/value3'
        );
        expect(completeMatch).toBeDefined();
        expect(completeMatch?.params).toEqual({
          param_1: 'value1',
          param2: 'value2',
          param3: 'value3',
        });
      });

      it('should handle overlapping multi-level routes with different structures', () => {
        const handler1 = async (ctx: Context) => {
          ctx.res.json({ route: 'static-abc', params: ctx.params });
        };
        const handler2 = async (ctx: Context) => {
          ctx.res.json({ route: 'param-abc', params: ctx.params });
        };
        const handler3 = async (ctx: Context) => {
          ctx.res.json({ route: 'param-param', params: ctx.params });
        };

        router.get('/root/static/abc/:param2', handler1);
        router.get('/root/:param_1/abc/:param2', handler2);
        router.get('/root/:param_1/:segment/:param2', handler3);

        // Static route should match first
        const staticMatch = router.find('GET', '/root/static/abc/value');
        expect(staticMatch?.handler).toBe(handler1);
        expect(staticMatch?.params).toEqual({ param2: 'value' });

        // Dynamic route with abc should match
        const dynamicMatch = router.find('GET', '/root/dynamic/abc/value');
        expect(dynamicMatch?.handler).toBe(handler2);
        expect(dynamicMatch?.params).toEqual({
          param_1: 'dynamic',
          param2: 'value',
        });

        // Fully dynamic route should match when middle segment is not 'abc'
        const fullyDynamicMatch = router.find('GET', '/root/dynamic/xyz/value');
        expect(fullyDynamicMatch?.handler).toBe(handler3);
        expect(fullyDynamicMatch?.params).toEqual({
          param_1: 'dynamic',
          segment: 'xyz',
          param2: 'value',
        });
      });
    });

    describe('Performance Tests for Multi-Level Routes', () => {
      it('should handle many multi-level routes efficiently', () => {
        // Register many complex multi-level routes
        for (let i = 0; i < 100; i++) {
          router.get(
            `/root/:param${i}/abc/:param${i}_2/xyz/:param${i}_3`,
            async (ctx: Context) => {
              ctx.res.json({ route: i, params: ctx.params });
            }
          );
        }

        // Test performance
        const start = performance.now();
        for (let i = 0; i < 1000; i++) {
          const match = router.find('GET', '/root/val1/abc/val2/xyz/val3');
          expect(match).toBeDefined();
        }
        const end = performance.now();

        expect(end - start).toBeLessThan(200); // Should complete efficiently
      });

      it('should cache multi-level parameter routes effectively', () => {
        const handler = async (ctx: Context) => {
          ctx.res.json({ params: ctx.params });
        };

        router.get('/root/:param_1/abc/:param2/xyz/:param3', handler);

        // First call populates cache
        const match1 = router.find('GET', '/root/test1/abc/test2/xyz/test3');
        expect(match1).toBeDefined();

        // Second call should hit cache and be identical
        const match2 = router.find('GET', '/root/test1/abc/test2/xyz/test3');
        expect(match2).toBeDefined();
        expect(match1).toBe(match2); // Should be same cached object

        // Different parameters should not hit cache but create new matches
        const match3 = router.find('GET', '/root/diff1/abc/diff2/xyz/diff3');
        expect(match3).toBeDefined();
        expect(match3).not.toBe(match1);
        expect(match3?.params).toEqual({
          param_1: 'diff1',
          param2: 'diff2',
          param3: 'diff3',
        });
      });
    });

    describe('Edge Cases for Multi-Level Routes', () => {
      it('should handle empty parameter values', () => {
        const handler = async (ctx: Context) => {
          ctx.res.json({ params: ctx.params });
        };

        router.get('/root/:param_1/abc/:param2', handler);

        // This should not match because parameters cannot be empty
        expect(router.find('GET', '/root//abc/value')).toBeNull();
        expect(router.find('GET', '/root/value/abc/')).toBeNull();
        expect(router.find('GET', '/root//abc/')).toBeNull();
      });

      it('should handle routes with trailing slashes on multi-level routes', () => {
        const handler = async (ctx: Context) => {
          ctx.res.json({ params: ctx.params });
        };

        router.get('/root/:param_1/abc/:param2', handler);

        // Test with trailing slash
        const match = router.find('GET', '/root/value1/abc/value2/');
        expect(match).toBeDefined();
        expect(match?.params).toEqual({ param_1: 'value1', param2: 'value2' });
      });

      it('should reject routes that do not match the exact pattern', () => {
        const handler = async (ctx: Context) => {
          ctx.res.json({ params: ctx.params });
        };

        router.get('/root/:param_1/abc/:param2/xyz/:param3', handler);

        // These should not match
        expect(router.find('GET', '/root/val1/def/val2/xyz/val3')).toBeNull(); // 'def' instead of 'abc'
        expect(router.find('GET', '/root/val1/abc/val2/uvw/val3')).toBeNull(); // 'uvw' instead of 'xyz'
        expect(router.find('GET', '/other/val1/abc/val2/xyz/val3')).toBeNull(); // 'other' instead of 'root'
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

    it('should create router with prefix for multi-level routes', () => {
      const router = createOptimizedRouter('/api/v2');
      const handler = async (ctx: Context) => {
        ctx.res.json({ params: ctx.params });
      };

      router.get('/root/:param_1/abc/:param2', handler);
      const match = router.find('GET', '/api/v2/root/value1/abc/value2');

      expect(match).toBeDefined();
      expect(match?.handler).toBe(handler);
      expect(match?.params).toEqual({ param_1: 'value1', param2: 'value2' });
    });
  });
});
