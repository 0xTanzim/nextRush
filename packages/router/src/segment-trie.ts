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

import type { Context, HttpMethod, Middleware, RouteHandler } from '@nextrush/types';

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
  /** Children nodes keyed by first character */
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
}

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

  // FAST PATH: No middleware — direct handler call. Wire ctx.next() to a no-op
  // so a handler that calls it settles safely.
  if (len === 0) {
    return async (ctx: Context) => {
      if (ctx.setNext) ctx.setNext(NOOP_NEXT);
      await handler(ctx, NOOP_NEXT);
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
