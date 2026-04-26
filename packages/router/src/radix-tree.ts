/**
 * @nextrush/router - Segment Trie Node
 *
 * Internal segment trie implementation for high-performance route matching.
 * Uses a compressed trie structure for O(k) lookups where k is path length.
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
 * Radix tree node
 */
export interface RadixNode {
  /** Path segment for this node */
  segment: string;
  /** Node type */
  type: NodeType;
  /** Children nodes keyed by first character */
  children: Map<string, RadixNode>;
  /** Parameter name if this is a param node */
  paramName?: string;
  /** Handlers keyed by HTTP method */
  handlers: Map<HttpMethod, HandlerEntry>;
  /** Wildcard child if any */
  wildcardChild?: RadixNode;
  /** Parameter child if any */
  paramChild?: RadixNode;
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

  // FAST PATH: No middleware - direct handler call
  if (len === 0) {
    return async (ctx: Context) => {
      await handler(ctx, NOOP_NEXT);
    };
  }

  // FAST PATH: Single middleware
  if (len === 1) {
    const mw = middleware[0];
    if (mw === undefined) throw new Error('middleware length mismatch');
    return async (ctx: Context) => {
      await mw(ctx, async () => {
        await handler(ctx, NOOP_NEXT);
      });
    };
  }

  // FAST PATH: Two middleware (very common)
  if (len === 2) {
    const mw0 = middleware[0];
    const mw1 = middleware[1];
    if (mw0 === undefined || mw1 === undefined) throw new Error('middleware length mismatch');
    return async (ctx: Context) => {
      await mw0(ctx, async () => {
        await mw1(ctx, async () => {
          await handler(ctx, NOOP_NEXT);
        });
      });
    };
  }

  // General case: Build recursive dispatch
  // Note: This closure is created ONCE at registration, not per request
  return async (ctx: Context): Promise<void> => {
    let index = 0;

    const dispatch = async (): Promise<void> => {
      if (index < len) {
        const mw = middleware[index++];
        if (mw === undefined) throw new Error('middleware length mismatch');
        await mw(ctx, dispatch);
      } else {
        await handler(ctx, NOOP_NEXT);
      }
    };

    await dispatch();
  };
}

/**
 * Create a new radix node
 */
export function createNode(segment: string, type: NodeType = NodeType.STATIC): RadixNode {
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
