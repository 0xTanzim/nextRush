/**
 * Context Factory Service for NextRush v2
 * 
 * @packageDocumentation
 */

import { injectable, inject } from 'tsyringe';
import { RequestEnhancer } from '@/core/enhancers/request-enhancer';
import { ResponseEnhancer } from '@/core/enhancers/response-enhancer';
import type { Context, NextRushResponse } from '@/types/context';
import type { ApplicationOptions, NextRushRequest } from '@/types/http';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';

/**
 * Immutable context properties
 */
export interface ImmutableContextProperties {
  readonly id: string;
  readonly method: string;
  readonly url: string;
  readonly path: string;
  readonly headers: IncomingMessage['headers'];
  readonly query: Record<string, string>;
  readonly ip: string;
  readonly secure: boolean;
  readonly protocol: string;
  readonly hostname: string;
  readonly host: string;
  readonly origin: string;
  readonly href: string;
  readonly search: string;
  readonly searchParams: URLSearchParams;
  readonly startTime: number;
}

/**
 * Mutable context properties
 */
export interface MutableContextProperties {
  body: unknown;
  params: Record<string, string>;
  state: Record<string, unknown>;
  responseHeaders: Record<string, string | number | string[]>;
}

/**
 * Context Factory Service
 * Creates immutable context objects with enhanced type safety
 */
@injectable()
export class ContextFactory {
  private static readonly MAX_POOL_SIZE = 100;
  private static pool: Partial<Context>[] = [];

  constructor() {
    // Initialize context pool
    this.initializePool();
  }

  /**
   * Initialize the context pool
   */
  private initializePool(): void {
    for (let i = 0; i < ContextFactory.MAX_POOL_SIZE; i++) {
      ContextFactory.pool.push({});
    }
  }

  /**
   * Create a new context with immutable properties
   */
  public createContext(
    req: IncomingMessage | NextRushRequest,
    res: ServerResponse | NextRushResponse,
    options: Required<ApplicationOptions>
  ): Context {
    // Get context from pool or create new one
    const ctx = ContextFactory.pool.pop() || {};

    // Create immutable properties
    const immutableProps = this.createImmutableProperties(req, options);

    // Create mutable properties
    const mutableProps: MutableContextProperties = {
      body: undefined,
      params: {},
      state: {},
      responseHeaders: {},
    };

    // Enhance request and response
    const enhancedReq = this.enhanceRequest(req);
    const enhancedRes = this.enhanceResponse(res);

    // Combine all properties
    const context: Context = {
      ...immutableProps,
      ...mutableProps,
      req: enhancedReq,
      res: enhancedRes,
    };

    // Add context methods
    this.addContextMethods(context);

    return context;
  }

  /**
   * Create immutable context properties
   */
  private createImmutableProperties(
    req: IncomingMessage | NextRushRequest,
    options: Required<ApplicationOptions>
  ): ImmutableContextProperties {
    const method = req.method || 'GET';
    const host = req.headers.host || 'localhost';
    const protocol = this.determineProtocol(req);
    const url = new URL(req.url || '/', `${protocol}://${host}`);
    const ip = this.determineIP(req);
    const secure = this.determineSecure(req);
    const hostname = this.determineHostname(req);

    return {
      id: randomUUID(),
      method,
      url: req.url || '/',
      path: url.pathname,
      headers: req.headers,
      query: Object.fromEntries(url.searchParams),
      ip,
      secure,
      protocol,
      hostname,
      host: url.host,
      origin: url.origin,
      href: url.href,
      search: url.search,
      searchParams: url.searchParams,
      startTime: Date.now(),
    };
  }

  /**
   * Determine the protocol (http/https)
   */
  private determineProtocol(req: IncomingMessage | NextRushRequest): string {
    return req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  }

  /**
   * Determine the client IP
   */
  private determineIP(req: IncomingMessage | NextRushRequest): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      (req.socket as any)?.remoteAddress ||
      '127.0.0.1'
    );
  }

  /**
   * Determine if the request is secure
   */
  private determineSecure(req: IncomingMessage | NextRushRequest): boolean {
    return (
      req.headers['x-forwarded-proto'] === 'https' ||
      (req.socket as any)?.encrypted === true
    );
  }

  /**
   * Determine the hostname
   */
  private determineHostname(req: IncomingMessage | NextRushRequest): string {
    return req.headers.host?.split(':')[0] || 'localhost';
  }

  /**
   * Enhance request with NextRushRequest methods
   */
  private enhanceRequest(req: IncomingMessage | NextRushRequest): NextRushRequest {
    const isEnhanced = typeof (req as any).originalUrl === 'string' ||
      typeof (req as any).params === 'object';

    return isEnhanced ? req : RequestEnhancer.enhance(req);
  }

  /**
   * Enhance response with NextRushResponse methods
   */
  private enhanceResponse(res: ServerResponse | NextRushResponse): NextRushResponse {
    const isEnhanced = typeof (res as any).json === 'function';

    return isEnhanced ? res : ResponseEnhancer.enhance(res);
  }

  /**
   * Add context methods (Koa-style)
   */
  private addContextMethods(ctx: Context): void {
    // Throw method
    ctx.throw = function (status: number, message?: string): never {
      const error = new Error(message || 'HTTP Error');
      (error as any).status = status;
      throw error;
    };

    // Assert method
    ctx.assert = function (
      condition: unknown,
      status: number,
      message?: string
    ): asserts condition {
      if (!condition) {
        this.throw(status, message);
      }
    };

    // Fresh method
    ctx.fresh = function (): boolean {
      const method = this.method;
      const status = this.status;

      if (method !== 'GET' && method !== 'HEAD') return false;
      if (status >= 200 && status < 300) return true;
      if (status === 304) return true;
      return false;
    };

    // Stale method
    ctx.stale = function (): boolean {
      return !this.fresh();
    };

    // Idempotent method
    ctx.idempotent = function (): boolean {
      return ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'TRACE'].includes(
        this.method
      );
    };

    // Cacheable method
    ctx.cacheable = function (): boolean {
      return this.method === 'GET' && this.status === 200;
    };

    // Set response header method
    ctx.set = function (name: string, value: string | number | string[]): void {
      (this.res as any).setHeader(name, value);
      this.responseHeaders[name] = value;
    };

    // Define status getter/setter
    Object.defineProperty(ctx, 'status', {
      get(): number {
        return (ctx.res as any).statusCode || 200;
      },
      set(code: number) {
        (ctx.res as any).statusCode = code;
      },
      enumerable: true,
      configurable: true,
    });
  }

  /**
   * Release context back to pool
   */
  public releaseContext(ctx: Context): void {
    if (ContextFactory.pool.length < ContextFactory.MAX_POOL_SIZE) {
      // Clear the context for reuse
      Object.keys(ctx).forEach(key => {
        delete (ctx as any)[key];
      });
      ContextFactory.pool.push(ctx);
    }
  }

  /**
   * Clear the context pool
   */
  public clearPool(): void {
    ContextFactory.pool.length = 0;
    this.initializePool();
  }

  /**
   * Get pool statistics
   */
  public getPoolStats(): { size: number; maxSize: number } {
    return {
      size: ContextFactory.pool.length,
      maxSize: ContextFactory.MAX_POOL_SIZE,
    };
  }
} 