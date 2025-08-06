/**
 * Context factory for NextRush v2
 *
 * @packageDocumentation
 */

import { RequestEnhancer } from '@/core/enhancers/request-enhancer';
import { ResponseEnhancer } from '@/core/enhancers/response-enhancer';
import type { Context, NextRushResponse } from '@/types/context';
import type { ApplicationOptions, NextRushRequest } from '@/types/http';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';

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

  // Optimized URL parsing - parse once and reuse
  const method = req.method || 'GET';
  const host = req.headers.host || 'localhost';
  const protocol =
    req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const url = new URL(req.url || '/', `${protocol}://${host}`);

  // Optimized IP detection - calculate once
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    (req.socket as any)?.remoteAddress ||
    '127.0.0.1';

  // Optimized security detection - calculate once
  const secure =
    req.headers['x-forwarded-proto'] === 'https' ||
    (req.socket as any)?.encrypted === true;

  // Optimized hostname detection - calculate once
  const hostname = req.headers.host?.split(':')[0] || 'localhost';

  // Use context pool for better performance
  const ctx = ContextPool.acquire() as Context;

  // Set optimized properties
  ctx.req = enhancedReq as any;
  ctx.res = enhancedRes as any;
  ctx.body = undefined; // Will be set by body parser middleware
  ctx.method = method;
  ctx.url = req.url || '/';
  ctx.path = url.pathname;
  ctx.headers = req.headers;
  ctx.query = Object.fromEntries(url.searchParams);
  ctx.params = {};
  ctx.id = randomUUID();
  ctx.state = {};
  ctx.startTime = Date.now();
  ctx.ip = ip;
  ctx.secure = secure;
  ctx.protocol = protocol;
  ctx.hostname = hostname;
  ctx.host = url.host;
  ctx.origin = url.origin;
  ctx.href = url.href;
  ctx.search = url.search;
  ctx.searchParams = url.searchParams;
  ctx.responseHeaders = {}; // To track headers set via ctx.set

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
