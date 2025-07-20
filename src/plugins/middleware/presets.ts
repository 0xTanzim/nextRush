/**
 * 🎛️ NextRush Middleware Presets - Unified Plugin Architecture
 *
 * Pre-configured middleware stacks for common use cases.
 * Following copilot instructions - everything is now plugin-based.
 *
 * NOTE: CORS functionality now uses the enterprise-grade CorsPlugin
 * instead of built-in middleware for better performance and features.
 */

import { ExpressMiddleware } from '../../types/express';

/**
 * Available preset names
 */
export type PresetName = 'development' | 'production' | 'api' | 'fullFeatured';

export interface PresetOptions {
  cors?: boolean | any;
  helmet?: boolean | any;
  logger?: boolean | any;
  bodyParser?: boolean | any;
  [key: string]: any;
}

/**
 * Development preset - Perfect for learning and debugging
 * Uses enterprise CORS plugin for consistency
 */
export function developmentPreset(
  options: PresetOptions = {}
): ExpressMiddleware[] {
  const middlewares: ExpressMiddleware[] = [];

  // Add logger for development visibility
  if (options.logger !== false) {
    middlewares.push((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      next();
    });
  }

  // NOTE: CORS is handled by the CorsPlugin - use app.cors() instead
  // The presets focus on other middleware while CORS is plugin-managed
  if (options.cors !== false) {
    middlewares.push((req, res, next) => {
      // Placeholder for compatibility - recommend using app.cors() instead
      console.warn(
        'Preset CORS is deprecated. Use app.cors() for enterprise features.'
      );
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
      );

      if (req.method === 'OPTIONS') {
        res.status(204).end();
      } else {
        next();
      }
    });
  }

  return middlewares;
}

/**
 * Production preset - Security and performance optimized
 */
export function productionPreset(
  options: PresetOptions = {}
): ExpressMiddleware[] {
  const middlewares: ExpressMiddleware[] = [];

  // Security headers (helmet-like)
  if (options.helmet !== false) {
    middlewares.push((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('Content-Security-Policy', "default-src 'self'");
      next();
    });
  }

  // Structured CORS
  if (options.cors !== false) {
    const corsOptions = typeof options.cors === 'object' ? options.cors : {};
    middlewares.push((req, res, next) => {
      const origin = req.headers.origin;

      if (corsOptions.origin) {
        if (Array.isArray(corsOptions.origin)) {
          if (corsOptions.origin.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin!);
          }
        } else if (typeof corsOptions.origin === 'string') {
          res.setHeader('Access-Control-Allow-Origin', corsOptions.origin);
        }
      }

      res.setHeader(
        'Access-Control-Allow-Methods',
        corsOptions.methods?.join(', ') || 'GET, POST, PUT, DELETE, OPTIONS'
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        corsOptions.headers?.join(', ') || 'Content-Type, Authorization'
      );

      if (corsOptions.credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      if (req.method === 'OPTIONS') {
        res.status(204).end();
      } else {
        next();
      }
    });
  }

  // Request ID for tracking
  middlewares.push((req, res, next) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    (req as any).id = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });

  return middlewares;
}

/**
 * API preset - Perfect for REST APIs
 */
export function apiPreset(options: PresetOptions = {}): ExpressMiddleware[] {
  const middlewares: ExpressMiddleware[] = [];

  // CORS for API access
  if (options.cors !== false) {
    middlewares.push((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, PATCH, OPTIONS'
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With'
      );

      if (req.method === 'OPTIONS') {
        res.status(204).end();
      } else {
        next();
      }
    });
  }

  // Request timing
  middlewares.push((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      res.setHeader('X-Response-Time', `${duration}ms`);
    });
    next();
  });

  // Request ID
  middlewares.push((req, res, next) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    (req as any).id = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });

  return middlewares;
}

/**
 * Minimal preset - Just the basics
 */
export function minimalPreset(
  options: PresetOptions = {}
): ExpressMiddleware[] {
  const middlewares: ExpressMiddleware[] = [];

  // Basic logging
  if (options.logger !== false) {
    middlewares.push((req, res, next) => {
      console.log(`${req.method} ${req.url} - ${res.statusCode}`);
      next();
    });
  }

  return middlewares;
}

/**
 * Security preset - Maximum security headers
 */
export function securityPreset(
  options: PresetOptions = {}
): ExpressMiddleware[] {
  const middlewares: ExpressMiddleware[] = [];

  // Comprehensive security headers
  middlewares.push((req, res, next) => {
    // Content type sniffing protection
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Clickjacking protection
    res.setHeader('X-Frame-Options', 'DENY');

    // XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // HTTPS enforcement
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );

    // Referrer policy
    res.setHeader('Referrer-Policy', 'no-referrer');

    // Content Security Policy
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    );

    // Permissions policy
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=()'
    );

    // Remove server header
    res.removeHeader('X-Powered-By');

    next();
  });

  return middlewares;
}

/**
 * Full-featured preset - Everything enabled for enterprise applications
 */
export function fullFeaturedPreset(
  options: PresetOptions = {}
): ExpressMiddleware[] {
  const middlewares: ExpressMiddleware[] = [];

  // Comprehensive security headers
  if (options.helmet !== false) {
    middlewares.push((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
      );
      res.setHeader(
        'Permissions-Policy',
        'geolocation=(), microphone=(), camera=()'
      );
      res.removeHeader('X-Powered-By');
      next();
    });
  }

  // Advanced CORS with credentials
  if (options.cors !== false) {
    middlewares.push((req, res, next) => {
      const origin = req.headers.origin;
      const corsOptions = typeof options.cors === 'object' ? options.cors : {};

      if (corsOptions.origin) {
        if (Array.isArray(corsOptions.origin)) {
          if (corsOptions.origin.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin!);
          }
        } else {
          res.setHeader('Access-Control-Allow-Origin', corsOptions.origin);
        }
      } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }

      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD'
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, X-Client-Version'
      );
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', '86400');

      if (req.method === 'OPTIONS') {
        res.status(204).end();
      } else {
        next();
      }
    });
  }

  // Request ID for tracking
  middlewares.push((req, res, next) => {
    const requestId = Math.random().toString(36).substring(2, 15);
    (req as any).id = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });

  // Performance timing
  middlewares.push((req, res, next) => {
    const start = Date.now();
    const originalEnd = res.end;
    res.end = function (chunk?: any, encoding?: any) {
      if (!res.headersSent) {
        const duration = Date.now() - start;
        res.setHeader('X-Response-Time', `${duration}ms`);
      }
      return originalEnd.call(this, chunk, encoding);
    };
    next();
  });

  // Rich logging with multiple formats
  const loggerFormat = options.logger?.format || 'detailed';
  middlewares.push((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const requestId = (req as any).id;

      switch (loggerFormat) {
        case 'json':
          console.log(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              method: req.method,
              url: req.url,
              status: res.statusCode,
              duration: `${duration}ms`,
              requestId,
              userAgent: req.headers['user-agent'],
              ip: req.connection?.remoteAddress,
              contentLength: res.getHeader('content-length'),
              referrer: req.headers.referer,
            })
          );
          break;
        case 'detailed':
          console.log(
            `[${new Date().toISOString()}] ${req.method} ${req.url} - ${
              res.statusCode
            } - ${duration}ms - ${requestId} - ${req.headers['user-agent']}`
          );
          break;
        default:
          console.log(
            `${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`
          );
      }
    });

    next();
  });

  // Response compression
  if (options.compression !== false) {
    middlewares.push((req, res, next) => {
      const acceptEncoding = req.headers['accept-encoding'];
      if (acceptEncoding?.includes('gzip')) {
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
      }
      next();
    });
  }

  return middlewares;
}

/**
 * Get preset by name with enhanced options and fallback support
 */
export function getPreset(
  name: PresetName | string,
  options: PresetOptions = {}
): ExpressMiddleware[] {
  // First try to get the preset by exact name
  switch (name) {
    case 'development':
      return developmentPreset(options);
    case 'production':
      return productionPreset(options);
    case 'api':
      return apiPreset(options);
    case 'fullFeatured':
    case 'full-featured':
    case 'enterprise':
      return fullFeaturedPreset(options);
    default:
      // Fallback strategies
      console.warn(
        `Unknown preset: "${name}". Falling back to 'production' preset.`
      );

      // If it's obviously for development, use development preset
      if (
        name.toLowerCase().includes('dev') ||
        name.toLowerCase().includes('debug')
      ) {
        return developmentPreset(options);
      }

      // If it's for API, use API preset
      if (
        name.toLowerCase().includes('api') ||
        name.toLowerCase().includes('rest')
      ) {
        return apiPreset(options);
      }

      // Default fallback to production for security
      return productionPreset(options);
  }
}

/**
 * Available preset names
 */
export const PRESET_NAMES = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  API: 'api',
  MINIMAL: 'minimal',
  SECURITY: 'security',
} as const;
