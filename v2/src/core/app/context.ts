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
  // Enhance mocks for tests - ensure all properties/methods are present
  const enhancedReq =
    typeof (req as any).originalUrl === 'string' ||
    typeof (req as any).params === 'object'
      ? req
      : RequestEnhancer.enhance(req);
  const enhancedRes =
    typeof (res as any).json === 'function'
      ? res
      : ResponseEnhancer.enhance(res);

  // For raw requests, we need to calculate basic properties
  const method = req.method || 'GET';
  const host = req.headers.host || 'localhost';
  const protocol =
    req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const url = new URL(req.url || '/', `${protocol}://${host}`);
  const path = url.pathname;
  const query = Object.fromEntries(url.searchParams);

  const ctx: Context = {
    req: enhancedReq as any,
    res: enhancedRes as any,
    body: undefined, // Will be set by body parser middleware
    method,
    url: req.url || '/',
    path, // Add the missing path property
    headers: req.headers,
    query,
    params: {},
    id: randomUUID(),
    state: {},
    startTime: Date.now(),
    ip:
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      (req.socket as any)?.remoteAddress ||
      '127.0.0.1',
    secure:
      req.headers['x-forwarded-proto'] === 'https' ||
      (req.socket as any)?.encrypted === true,
    protocol: req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http',
    hostname: req.headers.host?.split(':')[0] || 'localhost',
    host: url.host,
    origin: url.origin,
    href: url.href,
    search: url.search,
    searchParams: url.searchParams,
    status: 200, // Default status
    responseHeaders: {}, // To track headers set via ctx.set

    // Context methods (Koa-style)
    throw(status: number, message?: string): never {
      const error = new Error(message || 'HTTP Error');
      (error as any).status = status;
      throw error;
    },

    assert(
      condition: unknown,
      status: number,
      message?: string
    ): asserts condition {
      if (!condition) {
        this.throw(status, message);
      }
    },

    fresh(): boolean {
      const method = this.method;
      const status = this.status;

      if (method !== 'GET' && method !== 'HEAD') return false;
      if (status >= 200 && status < 300) return true;
      if (status === 304) return true;
      return false;
    },

    stale(): boolean {
      return !this.fresh();
    },

    idempotent(): boolean {
      return ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'TRACE'].includes(
        this.method
      );
    },

    cacheable(): boolean {
      return this.method === 'GET' && this.status === 200;
    },
  };

  return ctx;
}
