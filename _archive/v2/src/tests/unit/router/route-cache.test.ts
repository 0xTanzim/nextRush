/**
 * RouteCache unit tests
 */

import { RouteCache } from '@/core/router/route-cache';
import type { OptimizedRouteMatch } from '@/core/router/types';
import { beforeEach, describe, expect, it } from 'vitest';

describe('RouteCache', () => {
  let cache: RouteCache;

  beforeEach(() => {
    cache = new RouteCache(10);
  });

  describe('get/set operations', () => {
    it('should return undefined for cache miss', () => {
      expect(cache.get('GET:/unknown')).toBeUndefined();
    });

    it('should return cached value for cache hit', () => {
      const match: OptimizedRouteMatch = {
        handler: async () => {},
        middleware: [],
        params: {},
        path: '/test',
      };

      cache.set('GET:/test', match);
      expect(cache.get('GET:/test')).toBe(match);
    });

    it('should support null values for negative caching', () => {
      cache.set('GET:/notfound', null);
      expect(cache.get('GET:/notfound')).toBeNull();
    });
  });

  describe('cache eviction', () => {
    it('should evict half the cache when full', () => {
      const cache = new RouteCache(4);

      // Fill the cache
      for (let i = 0; i < 4; i++) {
        cache.set(`GET:/path${i}`, {
          handler: async () => {},
          middleware: [],
          params: {},
          path: `/path${i}`,
        });
      }

      expect(cache.getSize()).toBe(4);

      // Add one more to trigger eviction
      cache.set('GET:/path4', {
        handler: async () => {},
        middleware: [],
        params: {},
        path: '/path4',
      });

      // Should have evicted half + added new one
      expect(cache.getSize()).toBeLessThanOrEqual(3);
    });
  });

  describe('statistics', () => {
    it('should track cache hits', () => {
      const match: OptimizedRouteMatch = {
        handler: async () => {},
        middleware: [],
        params: {},
        path: '/test',
      };

      cache.set('GET:/test', match);
      cache.get('GET:/test');
      cache.get('GET:/test');

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
    });

    it('should track cache misses', () => {
      cache.get('GET:/miss1');
      cache.get('GET:/miss2');

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    it('should calculate hit rate correctly', () => {
      const match: OptimizedRouteMatch = {
        handler: async () => {},
        middleware: [],
        params: {},
        path: '/test',
      };

      cache.set('GET:/test', match);
      cache.get('GET:/test'); // hit
      cache.get('GET:/miss'); // miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0.5);
    });

    it('should return 0 hit rate when no operations', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('GET:/test', {
        handler: async () => {},
        middleware: [],
        params: {},
        path: '/test',
      });

      cache.clear();

      expect(cache.getSize()).toBe(0);
      expect(cache.get('GET:/test')).toBeUndefined();
    });

    it('should reset statistics on clear', () => {
      const match: OptimizedRouteMatch = {
        handler: async () => {},
        middleware: [],
        params: {},
        path: '/test',
      };

      cache.set('GET:/test', match);
      cache.get('GET:/test');
      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });
});
