/**
 * High-performance route cache for NextRush v2 Router
 *
 * Uses Map for O(1) operations with simplified LRU eviction strategy.
 *
 * @packageDocumentation
 */

import { ROUTER_CONSTANTS } from '@/core/constants';
import type { OptimizedRouteMatch } from './types';

/**
 * Route cache statistics interface
 */
export interface RouteCacheStats {
  size: number;
  hitRate: number;
  hits: number;
  misses: number;
}

/**
 * High-performance cache using Map for O(1) operations
 * Simplified design eliminates LRU overhead for better performance
 */
export class RouteCache {
  private cache = new Map<string, OptimizedRouteMatch | null>();
  private maxSize: number;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(maxSize: number = ROUTER_CONSTANTS.DEFAULT_CACHE_SIZE) {
    this.maxSize = maxSize;
  }

  /**
   * Get a cached route match
   * @param key - Cache key (method:path)
   * @returns Cached route match, null for negative cache, or undefined if not cached
   */
  get(key: string): OptimizedRouteMatch | null | undefined {
    const result = this.cache.get(key);
    if (result !== undefined) {
      this.cacheHits++;
      return result;
    }
    this.cacheMisses++;
    return undefined;
  }

  /**
   * Store a route match in cache
   * @param key - Cache key (method:path)
   * @param value - Route match or null for negative caching
   */
  set(key: string, value: OptimizedRouteMatch | null): void {
    // Simple size-based eviction - clear half when full for better performance
    if (this.cache.size >= this.maxSize) {
      const entries = Array.from(this.cache.entries());
      this.cache.clear();
      // Keep the second half (more recently used entries)
      const keepFrom = Math.floor(entries.length / 2);
      for (let i = keepFrom; i < entries.length; i++) {
        const entry = entries[i];
        if (entry) {
          this.cache.set(entry[0], entry[1]);
        }
      }
    }
    this.cache.set(key, value);
  }

  /**
   * Clear all cached routes and reset statistics
   */
  clear(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get current cache size
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Get cache performance statistics
   */
  getStats(): RouteCacheStats {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total === 0 ? 0 : this.cacheHits / total;
    return {
      size: this.getSize(),
      hitRate,
      hits: this.cacheHits,
      misses: this.cacheMisses,
    };
  }
}
