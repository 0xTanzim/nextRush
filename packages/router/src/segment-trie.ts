/**
 * @nextrush/router - Segment Trie Node
 *
 * Internal segment trie implementation for high-performance route matching.
 * Segments are split by `/` and matched one trie level per segment for O(k)
 * lookups where k is path length.
 *
 * @packageDocumentation
 * @internal
 */

import type { Context, HttpMethod, Middleware, RouteHandler, RouteMetadata } from '@nextrush/types';

/**
 * Node type enumeration
 */
export const enum NodeType {
  /** Static path segment: /users */
  STATIC = 0,
  /** Named parameter: /:id */
  PARAM = 1,
  /** Wildcard: /* */
  WILDCARD = 2,
}

/**
 * Segment trie node
 */
export interface TrieNode {
  /** Path segment for this node */
  segment: string;
  /** Node type */
  type: NodeType;
  /** Static child nodes keyed by whole path segment (e.g. `users`), not the first character */
  children: Map<string, TrieNode>;
  /** Parameter name if this is a param node */
  paramName?: string;
  /** Handlers keyed by HTTP method */
  handlers: Map<HttpMethod, HandlerEntry>;
  /** Wildcard child if any */
  wildcardChild?: TrieNode;
  /** Parameter child if any */
  paramChild?: TrieNode;
}

/**
 * Handler entry with middleware and pre-compiled executor
 */
export interface HandlerEntry {
  handler: RouteHandler;
  middleware: Middleware[];
  /** Pre-compiled executor for fast dispatch (no closure per request) */
  executor?: (ctx: Context) => Promise<void>;
  /**
   * `true` only for a `HEAD` entry derived from a `GET` registration
   * (RFC 9110 §9.3.2). A derived entry is replaced by an explicit `HEAD`
   * registration instead of reporting a route conflict, is absent from
   * `getRoutes()`, and is skipped when copying routes into a parent router —
   * which re-derives it from the `GET` it copies.
   */
  autoHead: boolean;
  /**
   * Merged route metadata (from `validate()`, `endpoint()`, etc.), retained on
   * the entry so a parent router's `copyRoutes()` can re-emit it when this
   * route is copied by `mount()`. Registration-time state only — request
   * dispatch never reads it. `undefined` for metadata-free routes.
   */
  metadata?: RouteMetadata;
}

/**
 * Method-nested static-route fast-path map (HP-9): the OUTER map selects an
 * inner map by HTTP method, the INNER map probes by the trailing-slash-
 * normalized path. This replaces the former `Map<"METHOD path", HandlerEntry>`
 * so a static lookup no longer builds a `` `${method} ${path}` `` key string per
 * request — it selects the inner map by `method` and probes by the raw path.
 */
export type StaticRouteMap = Map<HttpMethod, Map<string, HandlerEntry>>;

/**
 * No-op next function - reusable, zero allocation
 * Caches the resolved Promise to avoid per-call allocation
 * @internal
 */
const RESOLVED_PROMISE = Promise.resolve();
export const NOOP_NEXT = (): Promise<void> => RESOLVED_PROMISE;

/**
 * Compile an executor for a route handler with middleware
 * This creates the executor ONCE at registration time, not per-request
 * @internal
 */
export function compileExecutor(
  handler: RouteHandler,
  middleware: Middleware[]
): (ctx: Context) => Promise<void> {
  const len = middleware.length;

  // FAST PATH: No middleware — direct handler call, no extra async frame (NF-1).
  if (len === 0) {
    return (ctx: Context): Promise<void> => {
      // `setNext(NOOP_NEXT)` is LOAD-BEARING, not redundant (NF-4a): it
      // terminates the middleware chain at the handler so a handler that calls
      // `ctx.next()` is a safe no-op and cannot leak into app-level middleware
      // mounted AFTER the router (the general `compose` dispatch wires ctx._next
      // to advance into that middleware before running the router).
      if (ctx.setNext) ctx.setNext(NOOP_NEXT);
      try {
        // `Promise.resolve(...)` — NOT `x instanceof Promise ? x : RESOLVED` — so
        // a non-Promise THENABLE return is adopted (its async work awaited), not
        // dropped: byte-identical to the former `await handler(...)`, minus the
        // async form's internal microtask hop. A native promise is returned as-is
        // (`Promise.resolve(p) === p`); a void return yields a resolved promise.
        return Promise.resolve(handler(ctx, NOOP_NEXT));
      } catch (err) {
        // Self-contained "never throw synchronously" contract, identical to the
        // len >= 1 branch: a sync throw becomes a rejection; a non-Error is wrapped.
        return Promise.reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
  }

  // Middleware present: guarded recursive dispatch. This mirrors core `compose()`
  // so per-route middleware behave identically to application middleware:
  //  - `ctx.next()` (modern) and the `(ctx, next)` argument advance the SAME chain
  //    (ctx.setNext is wired before each layer),
  //  - a synchronous throw is turned into a rejected promise (proper propagation),
  //  - calling next() more than once in a layer rejects with a clear error.
  return (ctx: Context): Promise<void> => {
    let index = -1;

    const dispatch = (i: number): Promise<void> => {
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'));
      }
      index = i;

      if (i < len) {
        const mw = middleware[i];
        if (mw === undefined) return Promise.reject(new Error('middleware length mismatch'));
        const next = (): Promise<void> => dispatch(i + 1);
        if (ctx.setNext) ctx.setNext(next);
        try {
          return Promise.resolve(mw(ctx, next));
        } catch (err) {
          return Promise.reject(err instanceof Error ? err : new Error(String(err)));
        }
      }

      // Final handler. A handler calling next() is a safe no-op.
      if (ctx.setNext) ctx.setNext(NOOP_NEXT);
      try {
        return Promise.resolve(handler(ctx, NOOP_NEXT));
      } catch (err) {
        return Promise.reject(err instanceof Error ? err : new Error(String(err)));
      }
    };

    return dispatch(0);
  };
}

/**
 * Create a new segment trie node
 */
export function createNode(segment: string, type: NodeType = NodeType.STATIC): TrieNode {
  return {
    segment,
    type,
    children: new Map(),
    handlers: new Map(),
  };
}

/**
 * Reset a trie node to its empty state — clears children/handlers and drops the
 * param/wildcard branches. Used by `Router.reset()` for test isolation and
 * hot-reload re-registration.
 */
export function clearNode(node: TrieNode): void {
  node.children.clear();
  node.handlers.clear();
  node.paramChild = undefined;
  node.wildcardChild = undefined;
}

/**
 * Parse path segments
 * Splits path into segments and identifies param/wildcard types
 *
 * @param path - Route path to parse
 * @param caseSensitive - If false, lowercase static segments for case-insensitive matching
 */
export function parseSegments(path: string, caseSensitive = true): ParsedSegment[] {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  if (normalized === '') return [];

  const parts = normalized.split('/');
  const segments: ParsedSegment[] = [];

  for (const part of parts) {
    if (part.startsWith(':')) {
      // Preserve the original parameter name case
      const paramName = part.slice(1);
      segments.push({
        segment: part, // Preserve original case — param nodes match any segment
        type: NodeType.PARAM,
        paramName, // Keep original case
      });
    } else if (part === '*') {
      segments.push({
        segment: '*',
        type: NodeType.WILDCARD,
      });
      break; // Wildcard must be last
    } else {
      segments.push({
        segment: caseSensitive ? part : part.toLowerCase(),
        type: NodeType.STATIC,
      });
    }
  }

  return segments;
}

/**
 * Parsed segment structure
 */
export interface ParsedSegment {
  segment: string;
  type: NodeType;
  paramName?: string;
}
