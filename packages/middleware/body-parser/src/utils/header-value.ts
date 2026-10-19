/**
 * Single-header lookup that does not force the whole record.
 *
 * `ctx.headers` is materialized lazily on first read; a parser that needs only
 * `content-type` or `content-length` would otherwise walk every request header.
 * `ctx.get(name)` is the platform's single-name lookup (case-insensitive), so it
 * stays cheap even when the record has not been built.
 *
 * @packageDocumentation
 */

import type { BodyParserContext } from '../types.js';

/**
 * Read one request header, preferring the context's single-name lookup.
 *
 * @param ctx - Parser context; `get` is optional so narrow test doubles still work
 * @param name - Header name, case-insensitive
 * @returns The header value, or `undefined`
 */
export function readHeader(ctx: BodyParserContext, name: string): string | undefined {
  if (ctx.get) {
    return ctx.get(name);
  }
  const value = ctx.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
