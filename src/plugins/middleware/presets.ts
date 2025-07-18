/**
 * 🎛️ NextRush Middleware Presets - Unified Plugin Architecture
 *
 * Pre-configured middleware stacks for common use cases.
 * Following copilot instructions - everything is now plugin-based.
 */

import { ExpressMiddleware } from '../../types/express';

export interface PresetOptions {
  cors?: boolean | any;
  helmet?: boolean | any;
  logger?: boolean | any;
  bodyParser?: boolean | any;
  [key: string]: any;
}

/**
 * Development preset - Perfect for learning and debugging
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

  // Basic CORS for development
  if (options.cors !== false) {
    middlewares.push((req, res, next) => {
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
 * Get preset by name
 */
export function getPreset(
  name: string,
  options: PresetOptions = {}
): ExpressMiddleware[] {
  switch (name.toLowerCase()) {
    case 'development':
    case 'dev':
      return developmentPreset(options);

    case 'production':
    case 'prod':
      return productionPreset(options);

    case 'api':
      return apiPreset(options);

    case 'minimal':
      return minimalPreset(options);

    case 'security':
      return securityPreset(options);

    default:
      throw new Error(
        `Unknown preset: ${name}. Available: development, production, api, minimal, security`
      );
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
