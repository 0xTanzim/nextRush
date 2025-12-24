/**
 * Context Pool for NextRush v2
 *
 * Implements object pooling pattern for Context objects to reduce GC pressure
 * and improve performance in high-throughput scenarios.
 *
 * @packageDocumentation
 */

import { CONTEXT_CONSTANTS } from '@/core/constants';
import type { Context } from '@/types/context';

/**
 * Maximum number of contexts to keep in the pool
 */
const MAX_POOL_SIZE = CONTEXT_CONSTANTS.MAX_POOL_SIZE;

/**
 * Pre-allocated pool of reusable context objects
 */
const pool: Partial<Context>[] = [];

/**
 * Properties to reset when releasing a context back to the pool.
 * Using explicit property assignment instead of delete for V8 optimization.
 */
const RESETTABLE_PROPERTIES = [
  'req',
  'res',
  'method',
  'url',
  'path',
  'query',
  'params',
  'body',
  'headers',
  'status',
  'id',
  'ip',
  'secure',
  'protocol',
  'state',
  'cookie',
] as const;

/**
 * Acquire a context object from the pool or create a new one
 *
 * @returns Partial context object ready to be populated
 *
 * @example
 * ```typescript
 * const ctx = acquireContext();
 * // Populate ctx with request data...
 * ```
 */
export function acquireContext(): Partial<Context> {
  return pool.pop() || {};
}

/**
 * Release a context object back to the pool for reuse
 *
 * The context is reset to avoid memory leaks and then
 * returned to the pool if there's room.
 *
 * @param ctx - Context object to release
 *
 * @example
 * ```typescript
 * // After request processing is complete
 * releaseToPool(ctx);
 * ```
 */
export function releaseToPool(ctx: Partial<Context>): void {
  if (pool.length >= MAX_POOL_SIZE) {
    // Pool is full, let this context be garbage collected
    return;
  }

  // Reset properties using assignment (V8 optimization)
  // Using undefined assignment avoids V8 hidden class deoptimization
  for (const prop of RESETTABLE_PROPERTIES) {
    (ctx as any)[prop] = undefined;
  }

  pool.push(ctx);
}

/**
 * Clear all contexts from the pool
 *
 * Use this during application shutdown to free memory.
 *
 * @example
 * ```typescript
 * // During shutdown
 * clearPool();
 * ```
 */
export function clearPool(): void {
  pool.length = 0;
}

/**
 * Get the current pool size (for monitoring/debugging)
 *
 * @returns Number of contexts currently in the pool
 */
export function getPoolSize(): number {
  return pool.length;
}

/**
 * Get pool statistics (for monitoring/debugging)
 *
 * @returns Pool statistics object
 */
export function getPoolStats(): { size: number; maxSize: number; utilization: number } {
  return {
    size: pool.length,
    maxSize: MAX_POOL_SIZE,
    utilization: pool.length / MAX_POOL_SIZE,
  };
}
