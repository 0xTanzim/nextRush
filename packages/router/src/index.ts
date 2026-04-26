/**
 * @nextrush/router - High-Performance Router for NextRush
 *
 * This package provides a radix tree based router with:
 * - O(k) route matching where k is path length
 * - Named parameters (/users/:id)
 * - Wildcard routes (/files/*)
 * - Route middleware
 * - Router composition
 *
 * @packageDocumentation
 * @module @nextrush/router
 */

// Router
export { createRouter, Router } from './router';

// Radix tree internals (for advanced usage)
export { createNode, NodeType, parseSegments } from './radix-tree';
export type { HandlerEntry, ParsedSegment, RadixNode } from './radix-tree';

// Re-export relevant types
export type {
  HttpMethod,
  Middleware,
  Route,
  RouteHandler,
  RouteMatch,
  Router as RouterInterface,
  RouterOptions
} from '@nextrush/types';
