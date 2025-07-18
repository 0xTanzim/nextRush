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
    // Preset middleware
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

    // CORS middleware
    (app as any).cors = (options?: {
      origin?: string | string[] | boolean;
      methods?: string[];
      credentials?: boolean;
      headers?: string[];
    }) => {
      return this.createCorsMiddleware(options);
    };

    // Helmet security middleware
    (app as any).helmet = (options?: Record<string, any>) => {
      return this.createHelmetMiddleware(options);
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
