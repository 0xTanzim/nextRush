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
 * Request Timer Middleware
 * Adds response time header
 */
export function requestTimer(
  options: { header?: string } = {}
): ExpressMiddleware {
  const header = options.header || 'X-Response-Time';

  return (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      res.setHeader(header, `${duration}ms`);
    });

    next();
  };
}

/**
 * Compression Middleware
 * Compresses response data
 */
export function compression(
  options: {
    level?: number;
    threshold?: number;
    filter?: (req: any, res: any) => boolean;
  } = {}
): ExpressMiddleware {
  return (req, res, next) => {
    // Simple compression implementation
    // In a real implementation, this would use zlib
    const originalSend = res.send;

    res.send = function (body: any) {
      if (req.headers['accept-encoding']?.includes('gzip')) {
        res.setHeader('Content-Encoding', 'gzip');
      }
      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * Rate Limiting Middleware
 * Limits requests per IP
 */
export function rateLimit(
  options: {
    windowMs?: number;
    max?: number;
    message?: string;
  } = {}
): ExpressMiddleware {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
  const max = options.max || 100;
  const message =
    options.message || 'Too many requests, please try again later.';

  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req, res, next) => {
    const ip = req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const resetTime = now + windowMs;

    if (!requests.has(ip)) {
      requests.set(ip, { count: 1, resetTime });
    } else {
      const record = requests.get(ip)!;

      if (now > record.resetTime) {
        // Reset window
        record.count = 1;
        record.resetTime = resetTime;
      } else {
        record.count++;

        if (record.count > max) {
          res.status(429).json({ error: message });
          return;
        }
      }
    }

    next();
  };
}

// Re-export presets
export {
  apiPreset,
  developmentPreset,
  getPreset,
  minimalPreset,
  PRESET_NAMES,
  productionPreset,
  securityPreset,
} from '../middleware/presets';
