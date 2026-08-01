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

// Canonical request path (RFC-029) — the single normalization owner shared by
// the router's own match, mounted-router prefix tests, and any consumer that
// needs to know "what path does the router treat this request as".
export { canonicalizePath, hasDotSegment } from './canonicalize';
export type { CanonicalPathResult } from './canonicalize';

// Route groups
export type { RouteGroup } from './group-router';

// Segment trie internals (for advanced usage)
export { createNode, NodeType, parseSegments } from './segment-trie';
export type { HandlerEntry, ParsedSegment, TrieNode } from './segment-trie';

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
