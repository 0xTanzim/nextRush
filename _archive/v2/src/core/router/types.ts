/**
 * Type definitions for NextRush v2 Router
 *
 * @packageDocumentation
 */

import type { Middleware, RouteHandler } from '@/types/context';

/**
 * Optimized radix tree node
 */
export interface OptimizedRadixNode {
  path: string;
  handlers: Map<string, RouteData>;
  children: Map<string, OptimizedRadixNode>;
  paramChild?: OptimizedRadixNode; // Single parameter child for O(1) access
  isParam: boolean;
  paramName?: string;
  paramIndex?: number; // Pre-computed parameter index
  wildcardChild?: OptimizedRadixNode;
  regex?: RegExp; // For regex patterns
}

/**
 * Route data stored at tree nodes
 */
export interface RouteData {
  handler: RouteHandler;
  middleware: Middleware[];
  compiled?: (ctx: any) => Promise<void>; // Compiled handler for maximum performance
}

/**
 * Route match result with pre-allocated parameter object
 */
export interface OptimizedRouteMatch {
  handler: RouteHandler;
  middleware: Middleware[];
  params: Record<string, string>;
  path: string;
  compiled?: (ctx: any) => Promise<void>; // Compiled handler for maximum performance
}

/**
 * Cache performance statistics
 */
export interface CacheStats {
  size: number;
  hitRate: number;
  hits: number;
  misses: number;
}

/**
 * Parameter pool statistics
 */
export interface PoolStats {
  poolSize: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * Comprehensive router performance statistics
 */
export interface RouterStats {
  cache: CacheStats;
  pool: PoolStats;
  performance: {
    totalRoutes: number;
    pathCacheSize: number;
  };
}
