/**
 * Context factory for NextRush v2
 *
 * @packageDocumentation
 */

import {
  RequestEnhancer,
  type EnhancedRequest,
} from '@/core/enhancers/request-enhancer';
import {
  ResponseEnhancer,
  type EnhancedResponse,
} from '@/core/enhancers/response-enhancer';
import { parseQueryString } from '@/core/middleware/body-parser/utils';
import type { Context, NextRushResponse } from '@/types/context';
import type { ApplicationOptions, NextRushRequest } from '@/types/http';
import type { CookieOptions } from '@/utils/cookies';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Context pool for performance optimization
 */
class ContextPool {
  private static pool: Partial<Context>[] = [];
  private static readonly MAX_POOL_SIZE = 100;

  static acquire(): Partial<Context> {
    return this.pool.pop() || {};
  }

  static release(ctx: Partial<Context>): void {
    if (this.pool.length < this.MAX_POOL_SIZE) {
      // Clear the context for reuse
      Object.keys(ctx).forEach(key => {
        delete (ctx as any)[key];
      });
      this.pool.push(ctx);
    }
  }

  static clear(): void {
    this.pool.length = 0;
  }
}

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

  // Fast path extraction
  const pathEnd = url.indexOf('?');
  const path = pathEnd === -1 ? url : url.slice(0, pathEnd);

  // Fast IP detection - avoid string operations
  const forwardedFor = req.headers['x-forwarded-for'] as string;
  const ip = forwardedFor
    ? forwardedFor.split(',')[0]?.trim() || '127.0.0.1'
    : (req.headers['x-real-ip'] as string) ||
      (req.socket as any)?.remoteAddress ||
      '127.0.0.1';

  // Fast security detection
  const secure =
    req.headers['x-forwarded-proto'] === 'https' ||
    (req.socket as any)?.encrypted === true;

  // Fast hostname detection
  const hostname = host.split(':')[0] || 'localhost';

  // Use context pool for better performance
  const ctx = ContextPool.acquire() as Context;

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
  // Generate ID only if not in production mode (for development/debugging)
  ctx.id =
    process.env['NODE_ENV'] === 'production'
      ? undefined
      : `ctx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  ctx.state = {};
  ctx.startTime = Date.now();
  ctx.ip = ip;
  ctx.secure = secure;
  ctx.protocol = protocol;
  ctx.hostname = hostname;
  ctx.host = host;
  ctx.origin = `${protocol}://${host}`;
  ctx.href = `${protocol}://${host}${url}`;
  ctx.search = pathEnd === -1 ? '' : url.slice(pathEnd);
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

  // Add context methods (Koa-style)
  ctx.throw = function (status: number, message?: string): never {
    const error = new Error(message || 'HTTP Error');
    (error as any).status = status;
    throw error;
  };

  ctx.assert = function (
    condition: unknown,
    status: number,
    message?: string
  ): asserts condition {
    if (!condition) {
      this.throw(status, message);
    }
  };

  ctx.fresh = function (): boolean {
    const method = this.method;
    const status = this.status;

    if (method !== 'GET' && method !== 'HEAD') return false;
    if (status >= 200 && status < 300) return true;
    if (status === 304) return true;
    return false;
  };

  ctx.stale = function (): boolean {
    return !this.fresh();
  };

  ctx.idempotent = function (): boolean {
    return ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'TRACE'].includes(
      this.method
    );
  };

  ctx.cacheable = function (): boolean {
    return this.method === 'GET' && this.status === 200;
  };

  // Set response header (Koa-style)
  ctx.set = function (name: string, value: string | number | string[]): void {
    (enhancedRes as any).setHeader(name, value);
    this.responseHeaders[name] = value;
  };

  // Convenience: ctx.sendFile delegates to enhanced response
  (ctx as any).sendFile = function (
    path: string,
    options?: { root?: string; etag?: boolean }
  ): void {
    (enhancedRes as any).sendFile(path, options);
  };

  // Convenience methods for better DX - most popular response methods

  // ctx.json() - most used method (99% of APIs)
  (ctx as any).json = function (data: unknown): void {
    (enhancedRes as EnhancedResponse).json(data);
  };

  // ctx.send() - second most used
  (ctx as any).send = function (data: string | Buffer | object): void {
    (enhancedRes as EnhancedResponse).send(data);
  };

  // ctx.redirect() - common for redirects
  (ctx as any).redirect = function (url: string, statusCode?: number): void {
    (enhancedRes as EnhancedResponse).redirect(url, statusCode);
  };

  // ctx.cookie() - common for session management
  (ctx as any).cookie = function (
    name: string,
    value: string,
    options?: CookieOptions
  ): EnhancedResponse {
    return (enhancedRes as EnhancedResponse).cookie(name, value, options);
  };

  return ctx;
}

/**
 * Release context back to pool for reuse
 * Call this when the request is complete
 */
export function releaseContext(ctx: Context): void {
  ContextPool.release(ctx);
}

/**
 * Clear the context pool
 * Call this during application shutdown
 */
export function clearContextPool(): void {
  ContextPool.clear();
}
