/**
 * High-Performance Router Tests
 *
 * Tests the optimized routing algorithm with O(1) static and O(log n) parameterized lookups
 *
 * @packageDocumentation
 */

import {
  HighPerformanceRouter,
  createHighPerformanceRouter,
} from '@/core/router/high-performance-router';
import { beforeEach, describe, expect, it } from 'vitest';

describe('High Performance Router', () => {
  let router: HighPerformanceRouter;

  beforeEach(() => {
    router = createHighPerformanceRouter();
  });

  describe('Static Routes (O(1) lookup)', () => {
    it('should register and find static routes', () => {
      const handler = () => {};
      router.register('GET', '/users', handler);

      const match = router.find('GET', '/users');
      expect(match).toBeDefined();
      expect(match!.handler).toBe(handler);
      expect(match!.params).toEqual({});
    });

    it('should handle multiple static routes', () => {
      const userHandler = () => {};
      const postHandler = () => {};

      router.register('GET', '/users', userHandler);
      router.register('GET', '/posts', postHandler);

      expect(router.find('GET', '/users')!.handler).toBe(userHandler);
      expect(router.find('GET', '/posts')!.handler).toBe(postHandler);
    });

    it('should handle different HTTP methods', () => {
      const getHandler = () => {};
      const postHandler = () => {};

      router.register('GET', '/users', getHandler);
      router.register('POST', '/users', postHandler);

      expect(router.find('GET', '/users')!.handler).toBe(getHandler);
      expect(router.find('POST', '/users')!.handler).toBe(postHandler);
    });
  });

  describe('Parameterized Routes (O(log n) lookup)', () => {
    it('should handle single parameter routes', () => {
      const handler = () => {};
      router.register('GET', '/users/:id', handler);

      const match = router.find('GET', '/users/123');
      expect(match).toBeDefined();
      expect(match!.handler).toBe(handler);
      expect(match!.params).toEqual({ id: '123' });
    });

    it('should handle multiple parameters', () => {
      const handler = () => {};
      router.register('GET', '/users/:userId/posts/:postId', handler);

      const match = router.find('GET', '/users/123/posts/456');
      expect(match).toBeDefined();
      expect(match!.handler).toBe(handler);
      expect(match!.params).toEqual({ userId: '123', postId: '456' });
    });

    it('should handle mixed static and parameter routes', () => {
      const staticHandler = () => {};
      const paramHandler = () => {};

      router.register('GET', '/users', staticHandler);
      router.register('GET', '/users/:id', paramHandler);

      expect(router.find('GET', '/users')!.handler).toBe(staticHandler);
      expect(router.find('GET', '/users/123')!.handler).toBe(paramHandler);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large number of static routes efficiently', () => {
      const startTime = performance.now();

      // Register 1000 static routes
      for (let i = 0; i < 1000; i++) {
        router.register('GET', `/route${i}`, () => {});
      }

      const registrationTime = performance.now() - startTime;
      expect(registrationTime).toBeLessThan(100); // Should be very fast

      // Test lookup performance
      const lookupStart = performance.now();
      for (let i = 0; i < 1000; i++) {
        router.find('GET', `/route${i}`);
      }
      const lookupTime = performance.now() - lookupStart;
      expect(lookupTime).toBeLessThan(50); // O(1) lookup should be very fast
    });

    it('should handle parameterized routes efficiently', () => {
      const startTime = performance.now();

      // Register 100 parameterized routes
      for (let i = 0; i < 100; i++) {
        router.register('GET', `/users/:id/posts/${i}`, () => {});
      }

      const registrationTime = performance.now() - startTime;
      expect(registrationTime).toBeLessThan(50);

      // Test lookup performance
      const lookupStart = performance.now();
      for (let i = 0; i < 100; i++) {
        router.find('GET', `/users/123/posts/${i}`);
      }
      const lookupTime = performance.now() - lookupStart;
      expect(lookupTime).toBeLessThan(100); // O(log n) should be reasonable
    });
  });

  describe('Edge Cases', () => {
    it('should handle root path', () => {
      const handler = () => {};
      router.register('GET', '/', handler);

      const match = router.find('GET', '/');
      expect(match).toBeDefined();
      expect(match!.handler).toBe(handler);
    });

    it('should handle empty path', () => {
      const handler = () => {};
      router.register('GET', '', handler);

      const match = router.find('GET', '');
      expect(match).toBeDefined();
      expect(match!.handler).toBe(handler);
    });

    it('should return null for non-existent routes', () => {
      expect(router.find('GET', '/nonexistent')).toBeNull();
      expect(router.find('POST', '/users')).toBeNull();
    });

    it('should handle different parameter names at same level', () => {
      const userHandler = () => {};
      const postHandler = () => {};

      router.register('GET', '/users/:id', userHandler);
      router.register('GET', '/posts/:postId', postHandler);

      expect(router.find('GET', '/users/123')!.handler).toBe(userHandler);
      expect(router.find('GET', '/posts/456')!.handler).toBe(postHandler);
    });
  });

  describe('Statistics', () => {
    it('should provide accurate route statistics', () => {
      router.register('GET', '/users', () => {});
      router.register('POST', '/users', () => {});
      router.register('GET', '/users/:id', () => {});

      const stats = router.getStats();
      expect(stats.staticRoutes).toBe(2);
      expect(stats.paramRoutes).toBe(1);
      expect(stats.totalRoutes).toBe(3);
    });
  });

  describe('Benchmark', () => {
    it('should provide benchmark results', () => {
      const results = router.benchmark(1000);

      expect(results.staticLookup).toBeGreaterThan(0);
      expect(results.paramLookup).toBeGreaterThan(0);
      expect(results.registration).toBeGreaterThan(0);

      // Static lookup should be faster than parameterized
      expect(results.staticLookup).toBeLessThan(results.paramLookup);
    });
  });
});
