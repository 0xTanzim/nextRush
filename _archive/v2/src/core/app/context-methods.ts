/**
 * Context Methods for NextRush v2
 *
 * Shared context method implementations to avoid per-context function recreation.
 * These functions are bound to the context object once during context creation.
 *
 * @packageDocumentation
 */

import { IDEMPOTENT_METHODS } from '@/core/constants';
import type { Context } from '@/types/context';

/**
 * Throw an HTTP error from the context
 *
 * @param ctx - Context object
 * @param status - HTTP status code
 * @param message - Error message
 * @throws Error with status property
 */
export function ctxThrow(
  ctx: Context,
  status: number,
  message?: string
): never {
  const error = new Error(message || 'HTTP Error');
  (error as any).status = status;
  (error as any).statusCode = status;
  throw error;
}

/**
 * Assert a condition, throwing if falsy
 *
 * @param ctx - Context object
 * @param condition - Condition to check
 * @param status - HTTP status code if assertion fails
 * @param message - Error message if assertion fails
 */
export function ctxAssert(
  ctx: Context,
  condition: unknown,
  status: number,
  message?: string
): asserts condition {
  if (!condition) {
    ctxThrow(ctx, status, message);
  }
}

/**
 * Check if the response can be considered "fresh" (cacheable)
 *
 * Based on HTTP caching semantics:
 * - Only GET/HEAD requests can be fresh
 * - Status must be 2xx or 304
 *
 * @param ctx - Context object
 * @returns true if response is fresh
 */
export function ctxFresh(ctx: Context): boolean {
  const { method, status } = ctx;

  // Only GET and HEAD can be fresh
  if (method !== 'GET' && method !== 'HEAD') return false;

  // 2xx responses are fresh
  if (status >= 200 && status < 300) return true;

  // 304 Not Modified is fresh
  if (status === 304) return true;

  return false;
}

/**
 * Check if the response is stale (not fresh)
 *
 * @param ctx - Context object
 * @returns true if response is stale
 */
export function ctxStale(ctx: Context): boolean {
  return !ctxFresh(ctx);
}

/**
 * Check if the request method is idempotent
 *
 * Idempotent methods: GET, HEAD, PUT, DELETE, OPTIONS, TRACE
 * These methods should produce the same result regardless of how many times called.
 *
 * @param ctx - Context object
 * @returns true if request is idempotent
 */
export function ctxIdempotent(ctx: Context): boolean {
  return (IDEMPOTENT_METHODS as readonly string[]).includes(ctx.method);
}

/**
 * Check if the response is cacheable
 *
 * A response is cacheable if:
 * - Request method is GET
 * - Response status is 200 OK
 *
 * @param ctx - Context object
 * @returns true if response is cacheable
 */
export function ctxCacheable(ctx: Context): boolean {
  return ctx.method === 'GET' && ctx.status === 200;
}

/**
 * Set a response header
 *
 * @param ctx - Context object
 * @param enhancedRes - Enhanced response object
 * @param name - Header name
 * @param value - Header value
 */
export function ctxSet(
  ctx: Context,
  enhancedRes: any,
  name: string,
  value: string | number | string[]
): void {
  enhancedRes.setHeader(name, value);
  ctx.responseHeaders[name] = value;
}

/**
 * Bind context methods to a context object
 *
 * Creates bound method wrappers that capture the context and enhanced response.
 * This is more efficient than creating new functions for each context.
 *
 * @param ctx - Context object to bind methods to
 * @param enhancedRes - Enhanced response object for header operations
 */
export function bindContextMethods(ctx: Context, enhancedRes: any): void {
  // Koa-style methods - bound to avoid 'this' issues
  ctx.throw = function (status: number, message?: string): never {
    return ctxThrow(ctx, status, message);
  };

  ctx.assert = function (
    condition: unknown,
    status: number,
    message?: string
  ): asserts condition {
    return ctxAssert(ctx, condition, status, message);
  };

  ctx.fresh = function (): boolean {
    return ctxFresh(ctx);
  };

  ctx.stale = function (): boolean {
    return ctxStale(ctx);
  };

  ctx.idempotent = function (): boolean {
    return ctxIdempotent(ctx);
  };

  ctx.cacheable = function (): boolean {
    return ctxCacheable(ctx);
  };

  ctx.set = function (name: string, value: string | number | string[]): void {
    return ctxSet(ctx, enhancedRes, name, value);
  };
}

/**
 * Bind convenience methods to a context object
 *
 * These delegate to the enhanced response object for common operations.
 *
 * @param ctx - Context object to bind methods to
 * @param enhancedRes - Enhanced response object
 */
export function bindConvenienceMethods(ctx: Context, enhancedRes: any): void {
  // ctx.json() - most used method (99% of APIs)
  (ctx as any).json = function (data: unknown): void {
    enhancedRes.json(data);
  };

  // ctx.send() - second most used
  (ctx as any).send = function (data: string | Buffer | object): void {
    enhancedRes.send(data);
  };

  // ctx.redirect() - common for redirects
  (ctx as any).redirect = function (url: string, statusCode?: number): void {
    enhancedRes.redirect(url, statusCode);
  };

  // ctx.cookie() - common for session management
  (ctx as any).cookie = function (
    name: string,
    value: string,
    options?: any
  ): any {
    return enhancedRes.cookie(name, value, options);
  };

  // ctx.sendFile() - file serving
  (ctx as any).sendFile = function (
    path: string,
    options?: { root?: string; etag?: boolean }
  ): void {
    enhancedRes.sendFile(path, options);
  };
}
