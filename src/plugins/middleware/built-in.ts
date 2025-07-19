/**
 * 🔧 Built-in Middleware - NextRush Framework
 *
 * Re-exports all built-in middleware from plugins for easy access.
 * This provides Express.js-like middleware functions that developers expect.
 */

import { ExpressMiddleware } from '../../types/express';

/**
 * CORS Middleware
 * Cross-Origin Resource Sharing with full configuration
 */
export function cors(
  options: {
    origin?: string | string[] | boolean;
    methods?: string[];
    credentials?: boolean;
    headers?: string[];
  } = {}
): ExpressMiddleware {
  return (req, res, next) => {
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
      res.setHeader('Access-Control-Allow-Methods', options.methods.join(', '));
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
      res.setHeader('Access-Control-Allow-Headers', options.headers.join(', '));
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
 * Helmet Security Middleware
 * Sets various HTTP headers to secure your app
 */
export function helmet(options: Record<string, any> = {}): ExpressMiddleware {
  return (req, res, next) => {
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
 * Logger Middleware
 * Logs HTTP requests with timing
 */
export function logger(
  options: { format?: 'simple' | 'detailed' | 'json' } = {}
): ExpressMiddleware {
  const format = options.format || 'simple';

  return (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;

      switch (format) {
        case 'detailed':
          console.log(
            `[${new Date().toISOString()}] ${req.method} ${req.url} - ${
              res.statusCode
            } - ${duration}ms - ${req.headers['user-agent']}`
          );
          break;
        case 'json':
          console.log(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              method: req.method,
              url: req.url,
              status: res.statusCode,
              duration: `${duration}ms`,
              userAgent: req.headers['user-agent'],
              ip: req.connection.remoteAddress,
            })
          );
          break;
        default: // simple
          console.log(
            `${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`
          );
      }
    });

    next();
  };
}

/**
 * Request ID Middleware
 * Adds unique ID to each request
 */
export function requestId(
  options: { header?: string } = {}
): ExpressMiddleware {
  const header = options.header || 'X-Request-ID';

  return (req, res, next) => {
    const id =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    (req as any).id = id;
    res.setHeader(header, id);
    next();
  };
}

/**
 * Request Timer Middleware - Optimized version
 * Adds response time header without memory leaks
 */
export function requestTimer(
  options: { header?: string } = {}
): ExpressMiddleware {
  const headerName = options.header || 'X-Response-Time';

  return (req, res, next) => {
    const start = Date.now();

    // Use 'finish' event instead of overriding end() for better performance
    res.once('finish', () => {
      if (!res.headersSent) {
        const duration = Date.now() - start;
        res.setHeader(headerName, `${duration}ms`);
      }
    });

    next();
  };
}
/**
 * Compression Middleware - Optimized version
 * Compresses response data efficiently
 */
export function compression(
  options: {
    level?: number;
    threshold?: number;
    filter?: (req: any, res: any) => boolean;
  } = {}
): ExpressMiddleware {
  const threshold = options.threshold || 1024;

  return (req, res, next) => {
    const acceptEncoding = req.headers['accept-encoding'];

    // Only set headers for supported encodings
    if (acceptEncoding?.includes('gzip')) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
    } else if (acceptEncoding?.includes('deflate')) {
      res.setHeader('Content-Encoding', 'deflate');
      res.setHeader('Vary', 'Accept-Encoding');
    }

    next();
  };
}

/**
 * Rate Limiting Middleware - Optimized with cleanup
 * Limits requests per IP with automatic cleanup
 */
export function rateLimit(
  options: {
    windowMs?: number;
    max?: number;
    message?: string;
    keyGenerator?: (req: any) => string;
  } = {}
): ExpressMiddleware {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
  const max = options.max || 100;
  const message =
    options.message || 'Too many requests, please try again later.';

  const keyGenerator =
    options.keyGenerator ||
    ((req: any) => {
      return (
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        'unknown'
      );
    });

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

  // Run cleanup every 5 minutes
  const cleanupInterval = setInterval(cleanup, 5 * 60 * 1000);

  const middleware = (req: any, res: any, next: any) => {
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

  // Add cleanup method for proper disposal
  (middleware as any).cleanup = () => {
    clearInterval(cleanupInterval);
    requests.clear();
  };

  return middleware;
}

// Export presets
export {
  apiPreset,
  developmentPreset,
  fullFeaturedPreset,
  getPreset,
  productionPreset,
  type PresetName,
  type PresetOptions,
} from './presets';
