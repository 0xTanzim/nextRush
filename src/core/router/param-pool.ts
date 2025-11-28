/**
 * Parameter Pool for NextRush v2 Router
 *
 * Pre-allocated parameter object pool for zero-allocation route matching.
 * Uses object pooling pattern to minimize GC pressure during high-traffic routing.
 *
 * @packageDocumentation
 */

import { ROUTER_CONSTANTS } from '@/core/constants';

/**
 * Pool statistics for monitoring
 */
export interface PoolStats {
  /** Current pool size */
  poolSize: number;
  /** Maximum pool size */
  maxSize: number;
  /** Cache hits (objects reused from pool) */
  hits: number;
  /** Cache misses (new objects created) */
  misses: number;
  /** Hit rate (0-1) */
  hitRate: number;
}

/**
 * Parameter object pool for high-performance route matching
 *
 * Pre-allocates parameter objects to avoid allocation during request handling.
 * Objects are cleared and reused rather than garbage collected.
 *
 * @example
 * ```typescript
 * const pool = new ParamPool(100);
 * const params = pool.acquire();
 * params.id = '123';
 * params.name = 'user';
 * // Use params...
 * pool.release(params);
 * ```
 */
export class ParamPool {
  private pool: Record<string, string>[] = [];
  private maxPoolSize: number;
  private poolHits = 0;
  private poolMisses = 0;

  /**
   * Create a new parameter pool
   *
   * @param maxSize - Maximum pool size (default: from constants)
   */
  constructor(maxSize: number = ROUTER_CONSTANTS.MAX_PARAM_POOL_SIZE) {
    this.maxPoolSize = maxSize;

    // Pre-allocate parameter objects
    for (let i = 0; i < maxSize; i++) {
      this.pool.push({});
    }
  }

  /**
   * Acquire a parameter object from the pool
   *
   * If the pool is empty, creates a new object.
   *
   * @returns Empty parameter object
   */
  acquire(): Record<string, string> {
    if (this.pool.length > 0) {
      this.poolHits++;
      const params = this.pool.pop()!;
      // Efficiently clear object properties
      for (const key in params) {
        if (Object.prototype.hasOwnProperty.call(params, key)) {
          delete params[key];
        }
      }
      return params;
    }

    this.poolMisses++;
    return {}; // Create new object if pool is empty
  }

  /**
   * Release a parameter object back to the pool
   *
   * @param params - Parameter object to release
   */
  release(params: Record<string, string>): void {
    if (this.pool.length < this.maxPoolSize) {
      this.pool.push(params);
    }
  }

  /**
   * Get pool statistics
   *
   * @returns Pool performance statistics
   */
  getStats(): PoolStats {
    const total = this.poolHits + this.poolMisses;
    return {
      poolSize: this.pool.length,
      maxSize: this.maxPoolSize,
      hits: this.poolHits,
      misses: this.poolMisses,
      hitRate: total === 0 ? 0 : this.poolHits / total,
    };
  }

  /**
   * Reset pool statistics
   */
  resetStats(): void {
    this.poolHits = 0;
    this.poolMisses = 0;
  }

  /**
   * Clear the pool and reset statistics
   */
  clear(): void {
    this.pool.length = 0;
    this.poolHits = 0;
    this.poolMisses = 0;
  }

  /**
   * Refill the pool to maximum capacity
   */
  refill(): void {
    while (this.pool.length < this.maxPoolSize) {
      this.pool.push({});
    }
  }
}
