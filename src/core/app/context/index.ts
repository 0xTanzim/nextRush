/**
 * Context Module for NextRush v2
 *
 * Exports all context-related utilities including
 * context creation, pooling, and methods.
 *
 * @packageDocumentation
 */

// Context creation and management
export { clearContextPool, createContext, releaseContext } from '../context';

// Context pool (extracted for better modularity)
export {
  acquireContext,
  clearPool,
  getPoolSize,
  getPoolStats,
  releaseToPool
} from '../context-pool';

// Context methods (extracted to avoid per-context recreation)
export {
  bindContextMethods,
  bindConvenienceMethods,
  ctxAssert,
  ctxCacheable,
  ctxFresh,
  ctxIdempotent,
  ctxSet,
  ctxStale,
  ctxThrow
} from '../context-methods';
