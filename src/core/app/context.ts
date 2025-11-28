/**
 * Context factory for NextRush v2
 *
 * @packageDocumentation
 */

import { bindContextMethods, bindConvenienceMethods } from '@/core/app/context-methods';
import { acquireContext, clearPool, releaseToPool } from '@/core/app/context-pool';
import {
  RequestEnhancer,
  type EnhancedRequest,
} from '@/core/enhancers/request-enhancer';
import {
  ResponseEnhancer,
} from '@/core/enhancers/response-enhancer';
import { parseQueryString } from '@/core/middleware/body-parser/utils';
import { detectClientIP } from '@/core/utils/ip-detector';
import { extractHostname, extractPath, extractSearch } from '@/core/utils/url-parser';
import type { Context, NextRushResponse } from '@/types/context';
import type { ApplicationOptions, NextRushRequest } from '@/types/http';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Create a Koa-style context object with Express-like design
 *
 * @param req - HTTP request object
 * @param res - HTTP response object
 * @param options - Application options
 * @returns Enhanced context object
 *
 * @example
 * ```typescript
 * import { createContext } from '@/core/context';
 *
 * const ctx = createContext(req, res, options);
 * console.log(ctx.req.ip()); // Client IP
 * ctx.res.json({ message: 'Hello' });
 * ```
 */
export function createContext(
  req: IncomingMessage | NextRushRequest,
  res: ServerResponse | NextRushResponse,
  _options: Required<ApplicationOptions>
): Context {
  // Optimized enhancement check - avoid double enhancement
  const isEnhancedReq =
    typeof (req as any).originalUrl === 'string' ||
    typeof (req as any).params === 'object';
  const isEnhancedRes = typeof (res as any).json === 'function';

  const enhancedReq = isEnhancedReq ? req : RequestEnhancer.enhance(req);
  const enhancedRes = isEnhancedRes ? res : ResponseEnhancer.enhance(res);

  // Fast path parsing - avoid expensive URL constructor
  const method = req.method || 'GET';
  const url = req.url || '/';
  const host = req.headers.host || 'localhost';
  const protocol =
    req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';

  // Use shared utilities for consistent parsing across codebase
  const path = extractPath(url);
  const search = extractSearch(url);

  // Use shared IP detection utility (eliminates duplicate code)
  const ip = detectClientIP(req.headers, (req.socket as any)?.remoteAddress);

  // Fast security detection
  const secure =
    req.headers['x-forwarded-proto'] === 'https' ||
    (req.socket as any)?.encrypted === true;

  // Use shared hostname utility
  const hostname = extractHostname(host);

  // Use context pool for better performance
  const ctx = acquireContext() as Context;

  // Set optimized properties
  ctx.req = enhancedReq as any;
  ctx.res = enhancedRes as any;

  // Ensure ctx.body and ctx.req.body are synchronized
  (ctx as any).body = (enhancedReq as EnhancedRequest).body; // Reference the same body from enhanced request

  ctx.method = method;
  ctx.url = url;
  ctx.path = path;
  ctx.headers = req.headers;
  ctx.params = {};

  // ⚡ Optimized: Skip ID generation in production (zero overhead)
  if (process.env['NODE_ENV'] !== 'production') {
    ctx.id = `ctx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  ctx.state = {};
  ctx.startTime = Date.now();
  ctx.ip = ip;
  ctx.secure = secure;
  ctx.protocol = protocol;
  ctx.hostname = hostname;
  ctx.host = host;
  ctx.origin = `${protocol}://${host}`;
  ctx.href = `${protocol}://${host}${url}`;
  ctx.search = search;
  ctx.responseHeaders = {}; // To track headers set via ctx.set

  // Lazy load expensive properties only when accessed
  let _query: Record<string, string | string[]> = {};
  let _searchParams: URLSearchParams | undefined;

  Object.defineProperty(ctx, 'query', {
    get() {
      if (Object.keys(_query).length === 0 && ctx.search) {
        _query = parseQueryString(ctx.search.slice(1));
        // Freeze once to ensure read-only semantics for consumers
        Object.freeze(_query);
      }
      return _query;
    },
    set(value) {
      _query = value;
      // Keep consistent behavior: if value is an object, freeze it to enforce immutability-by-design
      if (value && typeof value === 'object') {
        Object.freeze(_query);
      }
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(ctx, 'searchParams', {
    get() {
      if (!_searchParams && ctx.search) {
        _searchParams = new URLSearchParams(ctx.search.slice(1));
      }
      return _searchParams || new URLSearchParams();
    },
    set(value) {
      _searchParams = value;
    },
    enumerable: true,
    configurable: true,
  });

  // Define getter/setter for status to avoid property creation overhead
  Object.defineProperty(ctx, 'status', {
    get(): number {
      return (enhancedRes as any).statusCode || 200;
    },
    set(code: number) {
      (enhancedRes as any).statusCode = code;
    },
    enumerable: true,
    configurable: true,
  });

  // Bind Koa-style context methods (extracted to context-methods.ts)
  bindContextMethods(ctx, enhancedRes);

  // Bind convenience methods for better DX (extracted to context-methods.ts)
  bindConvenienceMethods(ctx, enhancedRes);

  return ctx;
}

/**
 * Release context back to pool for reuse
 * Call this when the request is complete
 */
export function releaseContext(ctx: Context): void {
  releaseToPool(ctx);
}

/**
 * Clear the context pool
 * Call this during application shutdown
 */
export function clearContextPool(): void {
  clearPool();
}
