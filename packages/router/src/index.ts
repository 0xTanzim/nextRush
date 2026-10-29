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
export type { CanonicalPathResult, CanonicalPaths } from './canonicalize';

// Route groups
export type { RouteGroup } from './group-router';

// Segment trie internals (for advanced usage)
export { createNode, NodeType, parseSegments } from './segment-trie';
export type { HandlerEntry, ParsedSegment, TrieNode } from './segment-trie';

// Handler return-value settlement (RFC-050). Internal: exported so
// `@nextrush/class` settles controller returns through the same table; the
// public handler contract stays `void | Promise<void>`.
export { settleHandlerReturn } from './settle';

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
