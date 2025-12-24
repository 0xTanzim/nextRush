/**
 * @nextrush/router - Radix Tree Node
 *
 * Internal radix tree implementation for high-performance route matching.
 * Uses a compressed trie structure for O(k) lookups where k is path length.
 *
 * @packageDocumentation
 * @internal
 */

import type { HttpMethod, Middleware, RouteHandler } from '@nextrush/types';

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
 * Handler entry with middleware
 */
export interface HandlerEntry {
  handler: RouteHandler;
  middleware: Middleware[];
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
 */
export function parseSegments(path: string): ParsedSegment[] {
  // Don't lowercase the original path here - case normalization happens during matching
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  if (normalized === '') return [];

  const parts = normalized.split('/');
  const segments: ParsedSegment[] = [];

  for (const part of parts) {
    if (part.startsWith(':')) {
      // Preserve the original parameter name case
      const paramName = part.slice(1);
      segments.push({
        segment: part.toLowerCase(), // Lowercase segment for matching
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
        segment: part,
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
