/**
 * 🌐 CORS Plugin - NextRush Framework
 * 
 * Built-in Cross-Origin Resource Sharing (CORS) handling with smart defaults
 * and flexible configuration options.
 */

import { Application } from '../../core/app/application';
import { NextRushRequest, NextRushResponse } from '../../types/express';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';

/**
 * CORS configuration options
 */
export interface CorsOptions {
  origin?: string | string[] | boolean | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void);
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
  preflight?: boolean;
}

/**
 * Internal CORS configuration
 */
interface CorsConfig {
  origin: (origin: string | undefined) => Promise<boolean>;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge?: number;
  preflightContinue: boolean;
  optionsSuccessStatus: number;
  preflight: boolean;
}

/**
 * 🌐 CORS Plugin
 */
export class CorsPlugin extends BasePlugin {
  name = 'CORS';

  constructor(registry: PluginRegistry) {
    super(registry);
  }

  /**
   * Install CORS capabilities
   */
  install(app: Application): void {
    // Add CORS middleware method
    (app as any).cors = (options: CorsOptions = {}) => {
      const config = this.buildCorsConfig(options);
      
      return async (
        req: NextRushRequest,
        res: NextRushResponse,
        next: () => void
      ) => {
        try {
          const origin = req.headers.origin;
          const method = req.method?.toUpperCase();

          // Check if origin is allowed
          const isOriginAllowed = await config.origin(origin);
          
          // Set origin header
          if (isOriginAllowed) {
            res.setHeader('Access-Control-Allow-Origin', origin || '*');
          } else if (typeof options.origin === 'boolean' && options.origin) {
            res.setHeader('Access-Control-Allow-Origin', '*');
          }

          // Set credentials header
          if (config.credentials) {
            res.setHeader('Access-Control-Allow-Credentials', 'true');
          }

          // Set exposed headers
          if (config.exposedHeaders.length > 0) {
            res.setHeader('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
          }

          // Handle preflight requests
          if (config.preflight && method === 'OPTIONS') {
            // Set allowed methods
            res.setHeader('Access-Control-Allow-Methods', config.methods.join(', '));
            
            // Set allowed headers
            const requestHeaders = req.headers['access-control-request-headers'];
            if (requestHeaders) {
              if (config.allowedHeaders.includes('*')) {
                res.setHeader('Access-Control-Allow-Headers', requestHeaders);
              } else {
                const allowedRequestHeaders = requestHeaders
                  .split(',')
                  .map(h => h.trim())
                  .filter(h => config.allowedHeaders.includes(h.toLowerCase()) || config.allowedHeaders.includes('*'));
                
                if (allowedRequestHeaders.length > 0) {
                  res.setHeader('Access-Control-Allow-Headers', allowedRequestHeaders.join(', '));
                } else {
                  res.setHeader('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
                }
              }
            } else {
              res.setHeader('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
            }

            // Set max age
            if (config.maxAge !== undefined) {
              res.setHeader('Access-Control-Max-Age', config.maxAge.toString());
            }

            // End preflight request or continue
            if (!config.preflightContinue) {
              res.status(config.optionsSuccessStatus).end();
              return;
            }
          }

          next();
        } catch (error) {
          console.error('CORS error:', error);
          next(); // Continue on error
        }
      };
    };

    // Add global CORS enabler
    (app as any).enableCors = (options: CorsOptions = {}) => {
      (app as any).use((app as any).cors(options));
      return app;
    };

    // Add security headers method
    (app as any).enableSecurityHeaders = () => {
      return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
        // CORS-related security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        
        // HTTPS security headers (only set if HTTPS)
        const isSecure = (req as any).secure || req.headers['x-forwarded-proto'] === 'https';
        if (isSecure) {
          res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        }

        next();
      };
    };

    // Add method to enable both CORS and security headers
    (app as any).enableWebSecurity = (corsOptions: CorsOptions = {}) => {
      (app as any).use((app as any).enableSecurityHeaders());
      (app as any).use((app as any).cors(corsOptions));
      return app;
    };

    this.emit('cors:installed');
  }

  /**
   * Start the CORS plugin
   */
  start(): void {
    this.emit('cors:started');
  }

  /**
   * Stop the CORS plugin
   */
  stop(): void {
    this.emit('cors:stopped');
  }

  /**
   * Build CORS configuration from options
   */
  private buildCorsConfig(options: CorsOptions): CorsConfig {
    const config: CorsConfig = {
      origin: this.buildOriginChecker(options.origin),
      methods: this.normalizeArray(options.methods || ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE']),
      allowedHeaders: this.normalizeArray(options.allowedHeaders || ['*']),
      exposedHeaders: this.normalizeArray(options.exposedHeaders || []),
      credentials: options.credentials === true,
      preflightContinue: options.preflightContinue === true,
      optionsSuccessStatus: options.optionsSuccessStatus || 204,
      preflight: options.preflight !== false,
    };

    if (options.maxAge !== undefined) {
      config.maxAge = options.maxAge;
    }

    return config;
  }

  /**
   * Build origin checker function
   */
  private buildOriginChecker(origin: CorsOptions['origin']): (origin: string | undefined) => Promise<boolean> {
    if (origin === undefined || origin === true) {
      return async () => true;
    }

    if (origin === false) {
      return async () => false;
    }

    if (typeof origin === 'string') {
      return async (requestOrigin) => origin === requestOrigin;
    }

    if (Array.isArray(origin)) {
      return async (requestOrigin) => requestOrigin ? origin.includes(requestOrigin) : false;
    }

    if (typeof origin === 'function') {
      return (requestOrigin) => {
        return new Promise((resolve) => {
          origin(requestOrigin, (err, allow) => {
            if (err) {
              resolve(false);
            } else {
              resolve(allow === true);
            }
          });
        });
      };
    }

    return async () => false;
  }

  /**
   * Normalize string or array to array
   */
  private normalizeArray(value: string | string[] | undefined): string[] {
    if (!value) return [];
    if (typeof value === 'string') {
      return value.split(',').map(s => s.trim());
    }
    return value;
  }
}

/**
 * Predefined CORS configurations
 */
export const CorsPresets = {
  /**
   * Allow all origins - suitable for public APIs
   */
  allowAll: (): CorsOptions => ({
    origin: true,
    credentials: false,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'],
  }),

  /**
   * Strict CORS - only specified origins
   */
  strict: (allowedOrigins: string[]): CorsOptions => ({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),

  /**
   * Development-friendly CORS
   */
  development: (): CorsOptions => ({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'],
    exposedHeaders: ['X-Total-Count', 'X-Request-ID'],
  }),

  /**
   * Production-safe CORS
   */
  production: (allowedOrigins: string[]): CorsOptions => ({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400, // 24 hours
  }),

  /**
   * API-only CORS (no credentials)
   */
  apiOnly: (allowedOrigins?: string[]): CorsOptions => ({
    origin: allowedOrigins || true,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    maxAge: 3600, // 1 hour
  }),
};
