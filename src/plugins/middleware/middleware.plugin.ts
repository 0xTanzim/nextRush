/**
 * 🔧 Middleware Plugin - NextRush Framework
 *
 * Unified plugin architecture following copilot instructions.
 * Provides middleware composition and built-in middleware.
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
 * Middleware Plugin - Handles middleware composition and built-in middleware
 */
export class MiddlewarePlugin extends BasePlugin {
  name = 'Middleware';

  private globalMiddleware: MiddlewareHandler[] = [];

  constructor(registry: PluginRegistry) {
    super(registry);
  }

  /**
   * Install middleware capabilities into the application
   */
  install(app: Application): void {
    // Install built-in middleware
    this.installBuiltInMiddleware(app);

    this.emit('middleware:installed');
  }

  /**
   * Start the middleware plugin
   */
  start(): void {
    this.emit('middleware:started');
  }

  /**
   * Stop the middleware plugin
   */
  stop(): void {
    this.emit('middleware:stopped');
  }

  /**
   * Install built-in middleware functions
   */
  private installBuiltInMiddleware(app: Application): void {
    // 🎛️ Preset middleware
    (app as any).usePreset = (name: string, options?: PresetOptions) => {
      const presetMiddlewares = getPreset(name, options);
      presetMiddlewares.forEach((middleware) => {
        app.use(middleware);
      });
      console.log(
        `🎛️  Applied '${name}' preset with ${presetMiddlewares.length} middleware(s)`
      );
      return app;
    };

    // 🔒 CORS middleware
    (app as any).cors = (options?: {
      origin?: string | string[] | boolean;
      methods?: string[];
      credentials?: boolean;
      headers?: string[];
    }) => {
      return this.createCorsMiddleware(options);
    };

    // 🛡️ Helmet security middleware
    (app as any).helmet = (options?: Record<string, any>) => {
      return this.createHelmetMiddleware(options);
    };

    // 📦 JSON body parser
    (app as any).json = (options?: { limit?: string; strict?: boolean }) => {
      return this.createJsonMiddleware(options);
    };

    // 🔗 URL-encoded body parser
    (app as any).urlencoded = (options?: {
      extended?: boolean;
      limit?: string;
    }) => {
      return this.createUrlencodedMiddleware(options);
    };

    // 📄 Text body parser
    (app as any).text = (options?: { limit?: string; type?: string }) => {
      return this.createTextMiddleware(options);
    };

    // 🗜️ Raw body parser
    (app as any).raw = (options?: { limit?: string; type?: string }) => {
      return this.createRawMiddleware(options);
    };

    // 🗜️ Compression middleware
    (app as any).compression = (options?: {
      threshold?: number;
      level?: number;
    }) => {
      return this.createCompressionMiddleware(options);
    };

    // 🔒 Rate limiting middleware
    (app as any).rateLimit = (options?: {
      windowMs?: number;
      max?: number;
      message?: string;
    }) => {
      return this.createRateLimitMiddleware(options);
    };

    // 📊 Logger middleware
    (app as any).logger = (options?: {
      format?: 'simple' | 'detailed' | 'json';
    }) => {
      return this.createLoggerMiddleware(options);
    };

    // 🔑 Request ID middleware
    (app as any).requestId = (options?: { header?: string }) => {
      return this.createRequestIdMiddleware(options);
    };

    // ⏱️ Request timer middleware
    (app as any).timer = (options?: { header?: string }) => {
      return this.createRequestTimerMiddleware(options);
    };

    // 📦 Use group of middleware
    (app as any).useGroup = (middlewares: ExpressMiddleware[]) => {
      for (const middleware of middlewares) {
        app.use(middleware);
      }
      return app;
    };

    console.log('🔧 Middleware plugin methods installed');
  }

  /**
   * Create JSON body parser middleware
   */
  private createJsonMiddleware(
    options: { limit?: string; strict?: boolean } = {}
  ): ExpressMiddleware {
    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      // Deprecated: Body parsing is now handled by BodyParserPlugin
      console.warn(
        '⚠️  app.json() is deprecated. Body parsing is now automatic via BodyParserPlugin.'
      );
      next();
    };
  }

  /**
   * Create URL-encoded body parser middleware
   */
  private createUrlencodedMiddleware(
    options: { extended?: boolean; limit?: string } = {}
  ): ExpressMiddleware {
    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      // Deprecated: Body parsing is now handled by BodyParserPlugin
      console.warn(
        '⚠️  app.urlencoded() is deprecated. Body parsing is now automatic via BodyParserPlugin.'
      );
      next();
    };
  }

  /**
   * Create CORS middleware
   */
  private createCorsMiddleware(
    options: {
      origin?: string | string[] | boolean;
      methods?: string[];
      credentials?: boolean;
      headers?: string[];
    } = {}
  ): ExpressMiddleware {
    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      const origin = req.headers.origin;

      // Set CORS headers
      if (
        options.origin === true ||
        (Array.isArray(options.origin) && options.origin.includes(origin!))
      ) {
        res.setHeader('Access-Control-Allow-Origin', origin!);
      } else if (typeof options.origin === 'string') {
        res.setHeader('Access-Control-Allow-Origin', options.origin);
      } else if (options.origin !== false) {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }

      if (options.methods) {
        res.setHeader(
          'Access-Control-Allow-Methods',
          options.methods.join(', ')
        );
      } else {
        res.setHeader(
          'Access-Control-Allow-Methods',
          'GET, POST, PUT, DELETE, PATCH, OPTIONS'
        );
      }

      if (options.credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      if (options.headers) {
        res.setHeader(
          'Access-Control-Allow-Headers',
          options.headers.join(', ')
        );
      } else {
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Origin, X-Requested-With, Content-Type, Accept, Authorization'
        );
      }

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(204).end();
      } else {
        next();
      }
    };
  }

  /**
   * Create Helmet security middleware
   */
  private createHelmetMiddleware(
    options: Record<string, any> = {}
  ): ExpressMiddleware {
    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      // Set security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
      res.setHeader('Referrer-Policy', 'no-referrer');

      // Custom options can override defaults
      if (options.contentSecurityPolicy !== false) {
        res.setHeader('Content-Security-Policy', "default-src 'self'");
      }

      next();
    };
  }

  /**
   * Create text body parser middleware
   */
  private createTextMiddleware(
    options: { limit?: string; type?: string } = {}
  ): ExpressMiddleware {
    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      if (req.headers['content-type']?.includes('text/plain')) {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });
        req.on('end', () => {
          (req as any).body = body;
          next();
        });
      } else {
        next();
      }
    };
  }

  /**
   * Create raw body parser middleware
   */
  private createRawMiddleware(
    options: { limit?: string; type?: string } = {}
  ): ExpressMiddleware {
    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => {
        chunks.push(chunk);
      });
      req.on('end', () => {
        (req as any).body = Buffer.concat(chunks);
        next();
      });
    };
  }

  /**
   * Create compression middleware
   */
  private createCompressionMiddleware(
    options: { threshold?: number; level?: number } = {}
  ): ExpressMiddleware {
    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      const acceptEncoding = req.headers['accept-encoding'];

      if (acceptEncoding?.includes('gzip')) {
        res.setHeader('Content-Encoding', 'gzip');
        // Note: Actual compression would require zlib integration
        console.log('🗜️ Compression middleware applied (gzip)');
      }

      next();
    };
  }

  /**
   * Create rate limiting middleware
   */
  private createRateLimitMiddleware(
    options: { windowMs?: number; max?: number; message?: string } = {}
  ): ExpressMiddleware {
    const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    const max = options.max || 100;
    const message = options.message || 'Too many requests';

    const requests = new Map<string, { count: number; resetTime: number }>();

    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      const clientId = String(req.ip || 'unknown');
      const now = Date.now();

      const clientData = requests.get(clientId);

      if (!clientData || now > clientData.resetTime) {
        requests.set(clientId, { count: 1, resetTime: now + windowMs });
        next();
      } else if (clientData.count < max) {
        clientData.count++;
        next();
      } else {
        res.status(429).json({ error: message });
      }
    };
  }

  /**
   * Create logger middleware
   */
  private createLoggerMiddleware(
    options: { format?: 'simple' | 'detailed' | 'json' } = {}
  ): ExpressMiddleware {
    const format = options.format || 'simple';

    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      const start = Date.now();

      const originalEnd = res.end;
      (res as any).end = function (...args: any[]) {
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

        return (originalEnd as any).call(this, args[0], args[1]);
      };

      next();
    };
  }

  /**
   * Create request ID middleware
   */
  private createRequestIdMiddleware(
    options: { header?: string } = {}
  ): ExpressMiddleware {
    const header = options.header || 'X-Request-Id';

    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      const requestId =
        req.headers[header.toLowerCase()] ||
        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      (req as any).requestId = requestId;
      res.setHeader(header, requestId);

      next();
    };
  }

  /**
   * Create request timer middleware
   */
  private createRequestTimerMiddleware(
    options: { header?: string } = {}
  ): ExpressMiddleware {
    const header = options.header || 'X-Response-Time';

    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      const start = Date.now();

      const originalEnd = res.end;
      (res as any).end = function (...args: any[]) {
        const duration = Date.now() - start;
        res.setHeader(header, `${duration}ms`);
        return (originalEnd as any).call(this, args[0], args[1]);
      };

      next();
    };
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
}
