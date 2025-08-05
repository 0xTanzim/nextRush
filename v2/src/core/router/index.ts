/**
 * Radix Tree Router for NextRush v2
 *
 * High-performance router with O(k) lookup performance
 * where k is path length, not route count.
 *
 * @packageDocumentation
 */

import type {
  Middleware,
  RouteConfig,
  RouteHandler,
  Router as RouterInterface,
} from '@/types/context';

// Re-export the optimized router as the main implementation
export { OptimizedRouter as Router, createOptimizedRouter as createRouter } from './optimized-router';

// For backward compatibility, also export the original class name
export { OptimizedRouter } from './optimized-router';
