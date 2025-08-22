/**
 * Tests for your specific multi-level routing requirements
 *
 * /root/:param_1/abc/:param2
 * /root/:param_1/abc/:param2/xyz/:parm3
 */

import { OptimizedRouter } from '@/core/router/optimized-router';
import type { Context } from '@/types/context';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Your Multi-Level Routes Tests', () => {
  let router: OptimizedRouter;

  beforeEach(() => {
    router = new OptimizedRouter();
  });

  describe('/root/:param_1/abc/:param2 Route Tests', () => {
    it('should handle basic route matching', async () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({
          message: 'Route 1 matched!',
          param_1: ctx.params['param_1'],
          param2: ctx.params['param2'],
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
    });

    it('should handle various parameter values', async () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ params: ctx.params });
      };

      router.get('/root/:param_1/abc/:param2', handler);

      const testCases = [
        {
          path: '/root/user123/abc/data456',
          expected: { param_1: 'user123', param2: 'data456' },
        },
        {
          path: '/root/test-value/abc/another-test',
          expected: { param_1: 'test-value', param2: 'another-test' },
        },
        {
          path: '/root/123/abc/456',
          expected: { param_1: '123', param2: '456' },
        },
        {
          path: '/root/user_123/abc/data.json',
          expected: { param_1: 'user_123', param2: 'data.json' },
        },
      ];

      testCases.forEach(({ path, expected }) => {
        const match = router.find('GET', path);
        expect(match).toBeDefined();
        expect(match?.params).toEqual(expected);
      });
    });

    it('should handle all HTTP methods', async () => {
      const handlers = {
        GET: async (ctx: Context) => {
          ctx.res.json({ method: 'GET' });
        },
        POST: async (ctx: Context) => {
          ctx.res.json({ method: 'POST' });
        },
        PUT: async (ctx: Context) => {
          ctx.res.json({ method: 'PUT' });
        },
        DELETE: async (ctx: Context) => {
          ctx.res.json({ method: 'DELETE' });
        },
        PATCH: async (ctx: Context) => {
          ctx.res.json({ method: 'PATCH' });
        },
      };

      router.get('/root/:param_1/abc/:param2', handlers.GET);
      router.post('/root/:param_1/abc/:param2', handlers.POST);
      router.put('/root/:param_1/abc/:param2', handlers.PUT);
      router.delete('/root/:param_1/abc/:param2', handlers.DELETE);
      router.patch('/root/:param_1/abc/:param2', handlers.PATCH);

      Object.entries(handlers).forEach(([method, handler]) => {
        const match = router.find(method, '/root/test/abc/value');
        expect(match?.handler).toBe(handler);
        expect(match?.params).toEqual({ param_1: 'test', param2: 'value' });
      });
    });

    it('should reject incomplete paths', async () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ params: ctx.params });
      };

      router.get('/root/:param_1/abc/:param2', handler);

      // These should not match
      expect(router.find('GET', '/root')).toBeNull();
      expect(router.find('GET', '/root/value1')).toBeNull();
      expect(router.find('GET', '/root/value1/abc')).toBeNull();
      expect(router.find('GET', '/root/value1/def/value2')).toBeNull(); // wrong middle segment
    });
  });

  describe('/root/:param_1/abc/:param2/xyz/:parm3 Route Tests', () => {
    it('should handle basic route matching', async () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({
          message: 'Route 2 matched!',
          param_1: ctx.params['param_1'],
          param2: ctx.params['param2'],
          parm3: ctx.params['parm3'], // keeping your parameter name
        });
      };

      router.get('/root/:param_1/abc/:param2/xyz/:parm3', handler);

      const match = router.find('GET', '/root/value1/abc/value2/xyz/value3');

      expect(match).toBeDefined();
      expect(match?.handler).toBe(handler);
      expect(match?.params).toEqual({
        param_1: 'value1',
        param2: 'value2',
        parm3: 'value3',
      });
    });

    it('should handle various parameter values', async () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ params: ctx.params });
      };

      router.get('/root/:param_1/abc/:param2/xyz/:parm3', handler);

      const testCases = [
        {
          path: '/root/user123/abc/data456/xyz/item789',
          expected: { param_1: 'user123', param2: 'data456', parm3: 'item789' },
        },
        {
          path: '/root/alpha/abc/beta/xyz/gamma',
          expected: { param_1: 'alpha', param2: 'beta', parm3: 'gamma' },
        },
        {
          path: '/root/first/abc/second/xyz/third',
          expected: { param_1: 'first', param2: 'second', parm3: 'third' },
        },
        {
          path: '/root/test_123/abc/data-file.json/xyz/final_item',
          expected: {
            param_1: 'test_123',
            param2: 'data-file.json',
            parm3: 'final_item',
          },
        },
      ];

      testCases.forEach(({ path, expected }) => {
        const match = router.find('GET', path);
        expect(match).toBeDefined();
        expect(match?.params).toEqual(expected);
      });
    });

    it('should handle all HTTP methods', async () => {
      const handlers = {
        GET: async (ctx: Context) => {
          ctx.res.json({ method: 'GET' });
        },
        POST: async (ctx: Context) => {
          ctx.res.json({ method: 'POST' });
        },
        PUT: async (ctx: Context) => {
          ctx.res.json({ method: 'PUT' });
        },
        DELETE: async (ctx: Context) => {
          ctx.res.json({ method: 'DELETE' });
        },
        PATCH: async (ctx: Context) => {
          ctx.res.json({ method: 'PATCH' });
        },
      };

      router.get('/root/:param_1/abc/:param2/xyz/:parm3', handlers.GET);
      router.post('/root/:param_1/abc/:param2/xyz/:parm3', handlers.POST);
      router.put('/root/:param_1/abc/:param2/xyz/:parm3', handlers.PUT);
      router.delete('/root/:param_1/abc/:param2/xyz/:parm3', handlers.DELETE);
      router.patch('/root/:param_1/abc/:param2/xyz/:parm3', handlers.PATCH);

      Object.entries(handlers).forEach(([method, handler]) => {
        const match = router.find(method, '/root/test1/abc/test2/xyz/test3');
        expect(match?.handler).toBe(handler);
        expect(match?.params).toEqual({
          param_1: 'test1',
          param2: 'test2',
          parm3: 'test3',
        });
      });
    });

    it('should reject incomplete or wrong paths', async () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ params: ctx.params });
      };

      router.get('/root/:param_1/abc/:param2/xyz/:parm3', handler);

      // These should not match
      expect(router.find('GET', '/root/value1/abc/value2')).toBeNull(); // too short
      expect(router.find('GET', '/root/value1/abc/value2/xyz')).toBeNull(); // incomplete
      expect(
        router.find('GET', '/root/value1/def/value2/xyz/value3')
      ).toBeNull(); // wrong middle
      expect(
        router.find('GET', '/root/value1/abc/value2/uvw/value3')
      ).toBeNull(); // wrong fourth segment
    });
  });

  describe('Both Routes Together', () => {
    it('should handle both routes without conflicts', async () => {
      const shorterHandler = async (ctx: Context) => {
        ctx.res.json({
          route: 'shorter',
          params: ctx.params,
        });
      };

      const longerHandler = async (ctx: Context) => {
        ctx.res.json({
          route: 'longer',
          params: ctx.params,
        });
      };

      router.get('/root/:param_1/abc/:param2', shorterHandler);
      router.get('/root/:param_1/abc/:param2/xyz/:parm3', longerHandler);

      // Test shorter route
      const shorterMatch = router.find('GET', '/root/test1/abc/test2');
      expect(shorterMatch?.handler).toBe(shorterHandler);
      expect(shorterMatch?.params).toEqual({
        param_1: 'test1',
        param2: 'test2',
      });

      // Test longer route
      const longerMatch = router.find('GET', '/root/test1/abc/test2/xyz/test3');
      expect(longerMatch?.handler).toBe(longerHandler);
      expect(longerMatch?.params).toEqual({
        param_1: 'test1',
        param2: 'test2',
        parm3: 'test3',
      });

      // Verify they are different handlers
      expect(shorterMatch?.handler).not.toBe(longerMatch?.handler);
    });

    it('should handle multiple requests efficiently', async () => {
      const shorterHandler = async (ctx: Context) => {
        ctx.res.json({ route: 'shorter' });
      };
      const longerHandler = async (ctx: Context) => {
        ctx.res.json({ route: 'longer' });
      };

      router.get('/root/:param_1/abc/:param2', shorterHandler);
      router.get('/root/:param_1/abc/:param2/xyz/:parm3', longerHandler);

      // Test performance with many requests
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        const shorterMatch = router.find('GET', `/root/user${i}/abc/data${i}`);
        const longerMatch = router.find(
          'GET',
          `/root/user${i}/abc/data${i}/xyz/item${i}`
        );

        expect(shorterMatch?.handler).toBe(shorterHandler);
        expect(longerMatch?.handler).toBe(longerHandler);
      }

      const end = performance.now();
      expect(end - start).toBeLessThan(100); // Should be fast
    });
  });

  describe('Edge Cases and Special Scenarios', () => {
    it('should handle URL-encoded parameter values', async () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ params: ctx.params });
      };

      router.get('/root/:param_1/abc/:param2/xyz/:parm3', handler);

      const match = router.find(
        'GET',
        '/root/hello%20world/abc/test%2Bvalue/xyz/final%26result'
      );

      expect(match).toBeDefined();
      expect(match?.params).toEqual({
        param_1: 'hello%20world',
        param2: 'test%2Bvalue',
        parm3: 'final%26result',
      });
    });

    it('should handle UUID-like parameter values', async () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ params: ctx.params });
      };

      router.get('/root/:param_1/abc/:param2/xyz/:parm3', handler);

      const uuid1 = '550e8400-e29b-41d4-a716-446655440000';
      const uuid2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      const uuid3 = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

      const match = router.find(
        'GET',
        `/root/${uuid1}/abc/${uuid2}/xyz/${uuid3}`
      );

      expect(match).toBeDefined();
      expect(match?.params).toEqual({
        param_1: uuid1,
        param2: uuid2,
        parm3: uuid3,
      });
    });

    it('should handle numeric parameter values', async () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ params: ctx.params });
      };

      router.get('/root/:param_1/abc/:param2/xyz/:parm3', handler);

      const match = router.find('GET', '/root/123/abc/456/xyz/789');

      expect(match).toBeDefined();
      expect(match?.params).toEqual({
        param_1: '123',
        param2: '456',
        parm3: '789',
      });
    });

    it('should handle parameter values with special characters', async () => {
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

    it('should handle routes with trailing slash variations', async () => {
      const handler = async (ctx: Context) => {
        ctx.res.json({ params: ctx.params });
      };

      router.get('/root/:param_1/abc/:param2', handler);

      // Test with trailing slash (should work due to route normalization)
      const match = router.find('GET', '/root/value1/abc/value2/');
      expect(match).toBeDefined();
      expect(match?.params).toEqual({ param_1: 'value1', param2: 'value2' });
    });
  });

  describe('Cache Performance Tests', () => {
    it('should cache routes effectively', async () => {
      const handler1 = async (ctx: Context) => {
        ctx.res.json({ route: 1 });
      };
      const handler2 = async (ctx: Context) => {
        ctx.res.json({ route: 2 });
      };

      router.get('/root/:param_1/abc/:param2', handler1);
      router.get('/root/:param_1/abc/:param2/xyz/:parm3', handler2);

      // First calls to populate cache
      const match1 = router.find('GET', '/root/test1/abc/test2');
      const match2 = router.find('GET', '/root/test1/abc/test2/xyz/test3');

      // Second calls should hit cache
      const cachedMatch1 = router.find('GET', '/root/test1/abc/test2');
      const cachedMatch2 = router.find(
        'GET',
        '/root/test1/abc/test2/xyz/test3'
      );

      // Verify cache works
      expect(match1).toBe(cachedMatch1);
      expect(match2).toBe(cachedMatch2);

      // Check cache stats
      const stats = router.getCacheStats();
      expect(stats.cache.hits).toBeGreaterThan(0);
    });

    it('should handle high volume requests', async () => {
      const handler1 = async (ctx: Context) => {
        ctx.res.json({ route: 1 });
      };
      const handler2 = async (ctx: Context) => {
        ctx.res.json({ route: 2 });
      };

      router.get('/root/:param_1/abc/:param2', handler1);
      router.get('/root/:param_1/abc/:param2/xyz/:parm3', handler2);

      const start = performance.now();

      // Make 5000 requests
      for (let i = 0; i < 5000; i++) {
        const match1 = router.find(
          'GET',
          `/root/user${i % 100}/abc/data${i % 100}`
        );
        const match2 = router.find(
          'GET',
          `/root/user${i % 100}/abc/data${i % 100}/xyz/item${i % 100}`
        );

        expect(match1?.handler).toBe(handler1);
        expect(match2?.handler).toBe(handler2);
      }

      const end = performance.now();
      expect(end - start).toBeLessThan(500); // Should handle 5000 requests quickly
    });
  });
});
