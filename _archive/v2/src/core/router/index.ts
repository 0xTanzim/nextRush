/**
 * Radix Tree Router for NextRush v2
 *
 * High-performance router with O(k) lookup performance
 * where k is path length, not route count.
 *
 * @packageDocumentation
 */

// Main router implementation
export {
    OptimizedRouter, OptimizedRouter as Router,
    createOptimizedRouter as createRouter
} from './optimized-router';

// Utilities
export { ParamPool } from './param-pool';
export { PathSplitter } from './path-splitter';
export { RouteCache, type RouteCacheStats } from './route-cache';
export { RouteTree } from './route-tree';
export { StaticRouteMap } from './static-routes';

// Types
export type {
    CacheStats,
    OptimizedRadixNode,
    OptimizedRouteMatch,
    PoolStats,
    RouteData,
    RouterStats
} from './types';
