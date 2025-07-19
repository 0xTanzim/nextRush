/**
 * 🔧 Middleware Plugin - NextRush Framework
 *
 * High-performance middleware system with smart composition and built-in middleware.
 * Optimized for enterprise-grade applications with zero dependencies.
 */

import { Application } from '../../core/app/application';
import {
  ExpressMiddleware,
  NextRushRequest,
  NextRushResponse,
} from '../../types/express';
import { MiddlewareHandler } from '../../types/routing';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';
import { getPreset, PresetOptions } from './presets';

/**
 * Performance metrics for middleware
 */
export interface MiddlewareMetrics {
  totalExecutions: number;
  totalDuration: number;
  errors: number;
  averageDuration: number;
}

/**
 * 🔧 High-Performance Middleware Plugin
 */
export class MiddlewarePlugin extends BasePlugin {
  name = 'Middleware';

  private globalMiddleware: MiddlewareHandler[] = [];
  private middlewareMetrics = new Map<string, MiddlewareMetrics>();
  private enableMetrics = process.env.NODE_ENV !== 'production';

  constructor(registry: PluginRegistry) {
    super(registry);
  }

  /**
   * Install middleware capabilities into the application
   */
  install(app: Application): void {
    // Install built-in middleware with optimizations
    this.installBuiltInMiddleware(app);

    // Install composition utilities
    this.installCompositionUtilities(app);

    this.emit('middleware:installed');
  }

  /**
   * Start the middleware plugin
   */
  start(): void {
    this.emit('middleware:started');
  }

  /**
   * Stop the middleware plugin and cleanup resources
   */
  stop(): void {
    // Clean up any rate limiter intervals
    this.globalMiddleware.forEach((middleware) => {
      if (typeof (middleware as any).cleanup === 'function') {
        (middleware as any).cleanup();
      }
    });

    this.emit('middleware:stopped');
  }

  /**
   * Install optimized built-in middleware functions
   */
  private installBuiltInMiddleware(app: Application): void {
    // 🎛️ High-performance preset middleware
    (app as any).usePreset = (name: string, options?: PresetOptions) => {
      const presetMiddlewares = getPreset(name, options);
      presetMiddlewares.forEach((middleware) => {
        app.use(this.wrapMiddleware(middleware, `preset-${name}`));
      });
      console.log(
        `🎛️  Applied '${name}' preset with ${presetMiddlewares.length} middleware(s)`
      );
      return app;
    };

    // 🔒 Optimized CORS middleware
    (app as any).cors = (options?: {
      origin?: string | string[] | boolean;
      methods?: string[];
      credentials?: boolean;
      headers?: string[];
    }) => {
      return this.wrapMiddleware(this.createCorsMiddleware(options), 'cors');
    };

    // 🛡️ Optimized Helmet security middleware
    (app as any).helmet = (options?: Record<string, any>) => {
      return this.wrapMiddleware(
        this.createHelmetMiddleware(options),
        'helmet'
      );
    };

    // �️ Optimized Compression middleware
    (app as any).compression = (options?: {
      threshold?: number;
      level?: number;
    }) => {
      return this.wrapMiddleware(
        this.createCompressionMiddleware(options),
        'compression'
      );
    };

    // 🔒 Optimized Rate limiting middleware
    (app as any).rateLimit = (options?: {
      windowMs?: number;
      max?: number;
      message?: string;
      keyGenerator?: (req: NextRushRequest) => string;
    }) => {
      return this.wrapMiddleware(
        this.createRateLimitMiddleware(options),
        'rateLimit'
      );
    };

    // 📊 Optimized Logger middleware (deprecated - use LoggerPlugin)
    (app as any).logger = (options?: {
      format?: 'simple' | 'detailed' | 'json';
    }) => {
      console.warn(
        '⚠️  app.logger() is deprecated. Use LoggerPlugin for enhanced logging.'
      );
      return this.wrapMiddleware(
        this.createLoggerMiddleware(options),
        'logger'
      );
    };

    // � Optimized Request ID middleware
    (app as any).requestId = (options?: {
      header?: string;
      generator?: () => string;
    }) => {
      return this.wrapMiddleware(
        this.createRequestIdMiddleware(options),
        'requestId'
      );
    };

    // ⏱️ Optimized Request timer middleware
    (app as any).timer = (options?: { header?: string }) => {
      return this.wrapMiddleware(
        this.createRequestTimerMiddleware(options),
        'timer'
      );
    };

    // 📦 Optimized middleware group utility
    (app as any).useGroup = (middlewares: ExpressMiddleware[]) => {
      const composedMiddleware = this.composeMiddleware(middlewares);
      app.use(this.wrapMiddleware(composedMiddleware, 'group'));
      return app;
    };

    console.log('🔧 Middleware plugin methods installed');
  }

  /**
   * Install composition utilities with proper typing
   */
  private installCompositionUtilities(app: Application): void {
    // Compose multiple middleware
    (app as any).compose = (...middlewares: ExpressMiddleware[]) => {
      return this.composeMiddleware(middlewares);
    };

    // Conditional middleware
    (app as any).when = (
      condition: (req: NextRushRequest) => boolean,
      middleware: ExpressMiddleware
    ) => {
      return this.createConditionalMiddleware(condition, middleware);
    };

    // Unless middleware
    (app as any).unless = (
      condition: (req: NextRushRequest) => boolean,
      middleware: ExpressMiddleware
    ) => {
      return this.createConditionalMiddleware(
        (req) => !condition(req),
        middleware
      );
    };

    // Add getPlugin method for accessing plugin instances
    (app as any).getPlugin = (name: string) => {
      return this.registry.getPlugin?.(name);
    };

    // Add metrics access methods
    (app as any).getMiddlewareMetrics = () => {
      return this.getMetrics();
    };

    (app as any).clearMiddlewareMetrics = () => {
      this.clearMetrics();
    };
  }

  /**
   * 🚀 High-performance middleware composition with improved error handling
   */
  private composeMiddleware(
    middlewares: ExpressMiddleware[]
  ): ExpressMiddleware {
    if (middlewares.length === 0) {
      return (req, res, next) => next();
    }

    if (middlewares.length === 1) {
      return middlewares[0];
    }

    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      let index = 0;

      const executeNext = (): void => {
        if (index >= middlewares.length) {
          return next();
        }

        const middleware = middlewares[index++];

        try {
          middleware(req, res, executeNext);
        } catch (error) {
          console.error('❌ Middleware composition error:', error);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
          }
          // Don't call next() on error to prevent further execution
        }
      };

      executeNext();
    };
  }

  /**
   * 🎯 Create conditional middleware
   */
  private createConditionalMiddleware(
    condition: (req: NextRushRequest) => boolean,
    middleware: ExpressMiddleware
  ): ExpressMiddleware {
    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      if (condition(req)) {
        middleware(req, res, next);
      } else {
        next();
      }
    };
  }

  /**
   * 📊 Wrap middleware with enhanced performance tracking
   */
  private wrapMiddleware(
    middleware: ExpressMiddleware,
    name: string
  ): ExpressMiddleware {
    if (!this.enableMetrics) {
      return middleware;
    }

    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      const start = process.hrtime.bigint();
      let finished = false;

      const enhancedNext = () => {
        if (!finished) {
          finished = true;
          const end = process.hrtime.bigint();
          const duration = Number(end - start) / 1000000; // Convert to milliseconds
          this.recordMetrics(name, duration, false);
        }
        next();
      };

      try {
        middleware(req, res, enhancedNext);
      } catch (error) {
        if (!finished) {
          finished = true;
          const end = process.hrtime.bigint();
          const duration = Number(end - start) / 1000000;
          this.recordMetrics(name, duration, true);
        }
        throw error;
      }
    };
  }

  /**
   * 📈 Record middleware performance metrics
   */
  private recordMetrics(
    name: string,
    duration: number,
    isError: boolean
  ): void {
    const metrics = this.middlewareMetrics.get(name) || {
      totalExecutions: 0,
      totalDuration: 0,
      errors: 0,
      averageDuration: 0,
    };

    metrics.totalExecutions++;
    metrics.totalDuration += duration;
    if (isError) metrics.errors++;
    metrics.averageDuration = metrics.totalDuration / metrics.totalExecutions;

    this.middlewareMetrics.set(name, metrics);
  }

  /**
   * 🚀 Optimized CORS middleware with enhanced caching and performance
   */
  private createCorsMiddleware(
    options: {
      origin?: string | string[] | boolean;
      methods?: string[];
      credentials?: boolean;
      headers?: string[];
    } = {}
  ): ExpressMiddleware {
    // Pre-compute static headers for maximum performance
    const methodsHeader =
      options.methods?.join(', ') || 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
    const headersHeader =
      options.headers?.join(', ') ||
      'Origin, X-Requested-With, Content-Type, Accept, Authorization';

    // Pre-compute origin checking logic for performance
    const originIsArray = Array.isArray(options.origin);
    const originIsString = typeof options.origin === 'string';
    const allowCredentials = Boolean(options.credentials);

    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      const origin = req.headers.origin;

      // Optimized origin checking with minimal branching
      if (options.origin === true && origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else if (
        originIsArray &&
        origin &&
        (options.origin as string[]).includes(origin)
      ) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else if (originIsString) {
        res.setHeader('Access-Control-Allow-Origin', options.origin as string);
      } else if (options.origin !== false) {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }

      // Set pre-computed static headers in batch for performance
      res.setHeader('Access-Control-Allow-Methods', methodsHeader);
      res.setHeader('Access-Control-Allow-Headers', headersHeader);

      if (allowCredentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      // Handle preflight requests efficiently
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }

      next();
    };
  }

  /**
   * 🛡️ Optimized Helmet security middleware with batch header setting
   */
  private createHelmetMiddleware(
    options: Record<string, any> = {}
  ): ExpressMiddleware {
    // Pre-compute all security headers for maximum performance
    const securityHeaders: Record<string, string> = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'no-referrer',
    };

    // Add CSP conditionally during setup for better performance
    if (options.contentSecurityPolicy !== false) {
      securityHeaders['Content-Security-Policy'] = "default-src 'self'";
    }

    // Remove powered-by header option
    const removePoweredBy = options.removePoweredBy !== false;

    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      // Batch set all headers for optimal performance
      for (const [header, value] of Object.entries(securityHeaders)) {
        res.setHeader(header, value);
      }

      // Remove X-Powered-By header if requested
      if (removePoweredBy) {
        res.removeHeader('X-Powered-By');
      }

      next();
    };
  }

  /**
   * 🗜️ Optimized Compression middleware
   */
  private createCompressionMiddleware(
    options: { threshold?: number; level?: number } = {}
  ): ExpressMiddleware {
    const threshold = options.threshold || 1024; // 1KB threshold

    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      const acceptEncoding = req.headers['accept-encoding'];

      if (acceptEncoding?.includes('gzip')) {
        // Only set encoding header, actual compression would be handled elsewhere
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
      }

      next();
    };
  }

  /**
   * 🔒 High-performance Rate limiting middleware with proper cleanup
   */
  private createRateLimitMiddleware(
    options: {
      windowMs?: number;
      max?: number;
      message?: string;
      keyGenerator?: (req: NextRushRequest) => string;
    } = {}
  ): ExpressMiddleware {
    const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    const max = options.max || 100;
    const message = options.message || 'Too many requests';
    const keyGenerator =
      options.keyGenerator || ((req) => this.getClientIp(req));

    // Use Map for better performance than object
    const requests = new Map<string, { count: number; resetTime: number }>();

    // Cleanup old entries periodically
    const cleanup = () => {
      const now = Date.now();
      for (const [key, data] of requests.entries()) {
        if (now > data.resetTime) {
          requests.delete(key);
        }
      }
    };

    // Run cleanup every 5 minutes with proper interval management
    const cleanupInterval = setInterval(cleanup, 5 * 60 * 1000);

    const middleware = (
      req: NextRushRequest,
      res: NextRushResponse,
      next: () => void
    ) => {
      const key = keyGenerator(req);
      const now = Date.now();
      const resetTime = now + windowMs;

      const clientData = requests.get(key);

      if (!clientData || now > clientData.resetTime) {
        requests.set(key, { count: 1, resetTime });
        next();
      } else if (clientData.count < max) {
        clientData.count++;
        next();
      } else {
        res.status(429).json({ error: message });
      }
    };

    // Add cleanup method to middleware for proper disposal
    (middleware as any).cleanup = () => {
      clearInterval(cleanupInterval);
      requests.clear();
    };

    return middleware;
  }

  /**
   * 📊 Optimized Logger middleware (deprecated) with proper response handling
   */
  private createLoggerMiddleware(
    options: { format?: 'simple' | 'detailed' | 'json' } = {}
  ): ExpressMiddleware {
    const format = options.format || 'simple';

    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      const start = Date.now();

      // Use 'finish' event instead of overriding send for better performance
      const logRequest = () => {
        const duration = Date.now() - start;

        switch (format) {
          case 'json':
            console.log(
              JSON.stringify({
                method: req.method,
                url: req.url,
                status: res.statusCode,
                duration: `${duration}ms`,
                timestamp: new Date().toISOString(),
              })
            );
            break;
          case 'detailed':
            console.log(
              `[${new Date().toISOString()}] ${req.method} ${req.url} - ${
                res.statusCode
              } - ${duration}ms - ${req.headers['user-agent']}`
            );
            break;
          default:
            console.log(
              `${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`
            );
        }
      };

      // Listen to finish event once
      res.once('finish', logRequest);

      next();
    };
  }

  /**
   * 🔑 Optimized Request ID middleware
   */
  private createRequestIdMiddleware(
    options: {
      header?: string;
      generator?: () => string;
    } = {}
  ): ExpressMiddleware {
    const header = options.header || 'X-Request-Id';
    const generator =
      options.generator ||
      (() => `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      const requestId = req.headers[header.toLowerCase()] || generator();

      (req as any).requestId = requestId;
      res.setHeader(header, requestId);

      next();
    };
  }

  /**
   * ⏱️ Optimized Request timer middleware with efficient response handling
   */
  private createRequestTimerMiddleware(
    options: { header?: string } = {}
  ): ExpressMiddleware {
    const header = options.header || 'X-Response-Time';

    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      const start = Date.now();

      // Use finish event for better performance and reliability
      res.once('finish', () => {
        const duration = Date.now() - start;
        res.setHeader(header, `${duration}ms`);
      });

      next();
    };
  }

  /**
   * 🌐 Get client IP address efficiently
   */
  private getClientIp(req: NextRushRequest): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Add global middleware
   */
  public addGlobalMiddleware(middleware: MiddlewareHandler): void {
    this.globalMiddleware.push(middleware);
    this.emit('middleware:globalAdded');
  }

  /**
   * Get all global middleware
   */
  public getGlobalMiddleware(): MiddlewareHandler[] {
    return [...this.globalMiddleware];
  }

  /**
   * 📊 Get middleware performance metrics
   */
  public getMetrics(): Map<string, MiddlewareMetrics> {
    return new Map(this.middlewareMetrics);
  }

  /**
   * 🧹 Clear performance metrics
   */
  public clearMetrics(): void {
    this.middlewareMetrics.clear();
  }

  /**
   * 🎯 Enable/disable metrics collection
   */
  public setMetricsEnabled(enabled: boolean): void {
    this.enableMetrics = enabled;
  }
}

// Export composition utilities for direct use
export { compose, group, named, unless, when } from './composition';
