/**
 * @nextrush/router - High-Performance Router for NextRush
 *
 * This package provides a segment trie based router with:
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
export { createRouter, endpoint, Router } from './router';

// Route groups
export type { RouteGroup } from './group-router';

// Segment trie internals (for advanced usage; type/function names retain the
// historical "radix" prefix and will be renamed in a future major — audit RT-2)
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
