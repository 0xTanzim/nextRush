/**
 * @nextrush/cors - Header utilities
 *
 * Utilities for manipulating CORS-related HTTP headers.
 * Handles header normalization, Vary management, and header construction.
 *
 * @packageDocumentation
 */

import type { Context } from '@nextrush/types';
import { VARY_HEADER } from './constants.js';

/**
 * Normalize header list to comma-separated string.
 *
 * @param headers - Header(s) to normalize
 * @returns Comma-separated string or undefined
 *
 * @example
 * ```typescript
 * normalizeHeaders(['Content-Type', 'Authorization']) // 'Content-Type,Authorization'
 * normalizeHeaders('Content-Type') // 'Content-Type'
 * normalizeHeaders(undefined) // undefined
 * ```
 */
export function normalizeHeaders(headers: string | string[] | undefined): string | undefined {
  if (!headers) return undefined;
  return Array.isArray(headers) ? headers.join(',') : headers;
}

/**
 * Append value to Vary header without duplicates.
 *
 * The Vary header tells caches which request headers affect the response.
 * For CORS, we typically add "Origin" and sometimes "Access-Control-Request-*" headers.
 *
 * @param ctx - Request context
 * @param header - Header name to add to Vary
 *
 * @example
 * ```typescript
 * appendVary(ctx, 'Origin');
 * appendVary(ctx, 'Access-Control-Request-Method');
 * // Vary: Origin, Access-Control-Request-Method
 * ```
 */
export function appendVary(ctx: Context, header: string): void {
  const existing = ctx.get(VARY_HEADER);

  if (!existing) {
    ctx.set(VARY_HEADER, header);
    return;
  }

  // If already set to wildcard, no need to add more
  if (existing === '*') {
    return;
  }

  // Check if header is already in the list
  const headers = existing.split(',').map((h) => h.trim().toLowerCase());
  if (headers.includes(header.toLowerCase())) {
    return;
  }

  // Append the new header
  ctx.set(VARY_HEADER, `${existing}, ${header}`);
}

/**
 * Set multiple Vary headers at once.
 *
 * @param ctx - Request context
 * @param headers - Array of header names to add
 *
 * @example
 * ```typescript
 * setVaryHeaders(ctx, ['Origin', 'Access-Control-Request-Method']);
 * ```
 */
export function setVaryHeaders(ctx: Context, headers: string[]): void {
  for (const header of headers) {
    appendVary(ctx, header);
  }
}

/**
 * Build a method list string from array or string.
 *
 * @param methods - HTTP methods
 * @returns Comma-separated uppercase method string
 *
 * @example
 * ```typescript
 * buildMethodList(['get', 'post']) // 'GET,POST'
 * buildMethodList('GET,POST,PUT') // 'GET,POST,PUT'
 * ```
 */
export function buildMethodList(methods: string | string[]): string {
  if (typeof methods === 'string') {
    return methods;
  }
  return methods.map((m) => m.toUpperCase()).join(',');
}

/**
 * Parse a header list into an array.
 *
 * @param header - Comma-separated header value
 * @returns Array of trimmed header names
 *
 * @example
 * ```typescript
 * parseHeaderList('Content-Type, Authorization') // ['Content-Type', 'Authorization']
 * ```
 */
export function parseHeaderList(header: string | undefined): string[] {
  if (!header) return [];
  return header.split(',').map((h) => h.trim()).filter(Boolean);
}

/**
 * Check if a header value contains a specific item (case-insensitive).
 *
 * @param headerValue - Comma-separated header value
 * @param item - Item to search for
 * @returns True if item is in the header value
 *
 * @example
 * ```typescript
 * headerContains('GET, POST, PUT', 'post') // true
 * headerContains('Origin', 'Referer') // false
 * ```
 */
export function headerContains(headerValue: string | undefined, item: string): boolean {
  if (!headerValue) return false;
  const items = headerValue.split(',').map((h) => h.trim().toLowerCase());
  return items.includes(item.toLowerCase());
}
