/**
 * 🛡️ NextRush Built-in Middleware
 * Core middleware implementations using proper NextRush types
 */

import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { NextRushRequest, NextRushResponse } from '../types/express';
import {
  CompressionOptions,
  CookieParserOptions,
  CorsOptions,
  HelmetOptions,
  JsonOptions,
  LoggerOptions,
  Middleware,
  RateLimitOptions,
  RequestIdOptions,
  RequestTimerOptions,
} from './types';

/**
 * 🌐 CORS Middleware
 * Cross-Origin Resource Sharing with full NextRush type support
 */
export function cors(options: CorsOptions = {}): Middleware {
  const {
    origin = '*',
    methods = 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders = 'Content-Type,Authorization',
    exposedHeaders,
    credentials = false,
    maxAge,
    preflightContinue = false,
    optionsSuccessStatus = 204,
  } = options;

  return (req: NextRushRequest, res: NextRushResponse, next) => {
    // Handle origin
    let allowOrigin: string;
    if (typeof origin === 'boolean') {
      allowOrigin = origin ? (req.headers.origin as string) || '*' : 'false';
    } else if (typeof origin === 'function') {
      allowOrigin = origin(req.headers.origin as string, req)
        ? (req.headers.origin as string) || '*'
        : 'false';
    } else if (Array.isArray(origin)) {
      const requestOrigin = req.headers.origin as string;
      allowOrigin = origin.includes(requestOrigin) ? requestOrigin : 'false';
    } else {
      allowOrigin = origin;
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);

    if (credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (exposedHeaders) {
      res.setHeader(
        'Access-Control-Expose-Headers',
        Array.isArray(exposedHeaders)
          ? exposedHeaders.join(',')
          : exposedHeaders
      );
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.setHeader(
        'Access-Control-Allow-Methods',
        Array.isArray(methods) ? methods.join(',') : methods
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        Array.isArray(allowedHeaders)
          ? allowedHeaders.join(',')
          : allowedHeaders
      );

      if (maxAge) {
        res.setHeader('Access-Control-Max-Age', maxAge.toString());
      }

      if (!preflightContinue) {
        res.statusCode = optionsSuccessStatus;
        res.end();
        return;
      }
    }

    next();
  };
}

/**
 * 🛡️ Helmet Security Middleware
 * Security headers using NextRush types
 */
export function helmet(options: HelmetOptions = {}): Middleware {
  const {
    contentSecurityPolicy = true,
    crossOriginEmbedderPolicy = false,
    crossOriginOpenerPolicy = false,
    crossOriginResourcePolicy = false,
    frameguard = true,
    hidePoweredBy = true,
    hsts = true,
    noSniff = true,
    originAgentCluster = false,
    permittedCrossDomainPolicies = false,
    referrerPolicy = true,
    xssFilter = true,
  } = options;

  return (req: NextRushRequest, res: NextRushResponse, next) => {
    // Hide X-Powered-By header
    if (hidePoweredBy) {
      res.removeHeader('X-Powered-By');
    }

    // Content Security Policy
    if (contentSecurityPolicy) {
      const cspDirectives =
        typeof contentSecurityPolicy === 'object' &&
        contentSecurityPolicy.directives
          ? contentSecurityPolicy.directives
          : {
              'default-src': ["'self'"],
              'script-src': ["'self'"],
              'style-src': ["'self'", "'unsafe-inline'"],
              'img-src': ["'self'", 'data:', 'https:'],
            };

      const cspValue = Object.entries(cspDirectives)
        .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
        .join('; ');

      res.setHeader('Content-Security-Policy', cspValue);
    }

    // Frame Options
    if (frameguard) {
      const frameOptions =
        typeof frameguard === 'object'
          ? frameguard.action === 'allow-from'
            ? `ALLOW-FROM ${frameguard.domain}`
            : frameguard.action.toUpperCase()
          : 'DENY';
      res.setHeader('X-Frame-Options', frameOptions);
    }

    // HSTS
    if (hsts) {
      const hstsValue =
        typeof hsts === 'object'
          ? `max-age=${hsts.maxAge || 31536000}${
              hsts.includeSubDomains ? '; includeSubDomains' : ''
            }${hsts.preload ? '; preload' : ''}`
          : 'max-age=31536000; includeSubDomains';
      res.setHeader('Strict-Transport-Security', hstsValue);
    }

    // Additional security headers
    if (noSniff) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    if (xssFilter) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    if (referrerPolicy) {
      const policy =
        typeof referrerPolicy === 'object'
          ? Array.isArray(referrerPolicy.policy)
            ? referrerPolicy.policy.join(',')
            : referrerPolicy.policy
          : 'strict-origin-when-cross-origin';
      res.setHeader('Referrer-Policy', policy);
    }

    next();
  };
}

/**
 * 🗜️ Compression Middleware
 * Gzip/Deflate compression using NextRush types
 */
export function compression(options: CompressionOptions = {}): Middleware {
  const { threshold = 1024, level = 6, filter, brotli = false } = options;

  return (req: NextRushRequest, res: NextRushResponse, next) => {
    // Check if compression should be applied
    if (filter && !filter(req, res)) {
      return next();
    }

    // Check Accept-Encoding header
    const acceptEncoding = (req.headers['accept-encoding'] as string) || '';

    // Store original methods
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    let chunks: Buffer[] = [];
    let encoding: string | null = null;

    // Determine compression method
    if (brotli && acceptEncoding.includes('br')) {
      encoding = 'br';
    } else if (acceptEncoding.includes('gzip')) {
      encoding = 'gzip';
    } else if (acceptEncoding.includes('deflate')) {
      encoding = 'deflate';
    }

    if (!encoding) {
      return next();
    }

    // Override write method
    res.write = function (chunk: any, ...args: any[]) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return true;
    } as any;

    // Override end method
    res.end = function (chunk?: any, ...args: any[]): any {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const buffer = Buffer.concat(chunks);

      // Only compress if above threshold
      if (buffer.length < threshold) {
        res.write = originalWrite;
        res.end = originalEnd;
        if (chunks.length > 0) {
          res.write(buffer);
        }
        return res.end();
      }

      // Apply compression
      res.setHeader('Content-Encoding', encoding);
      res.removeHeader('Content-Length');

      try {
        let compressed: Buffer;
        switch (encoding) {
          case 'gzip':
            compressed = zlib.gzipSync(buffer, { level });
            break;
          case 'deflate':
            compressed = zlib.deflateSync(buffer, { level });
            break;
          case 'br':
            compressed = zlib.brotliCompressSync(buffer);
            break;
          default:
            compressed = buffer;
        }

        res.write = originalWrite;
        res.end = originalEnd;
        res.write(compressed);
        return res.end();
      } catch (err) {
        res.write = originalWrite;
        res.end = originalEnd;
        res.write(buffer);
        return res.end();
      }
    } as any;

    next();
  };
}

/**
 * 📝 JSON Body Parser Middleware
 * Parse JSON request bodies using NextRush types
 */
export function json(options: JsonOptions = {}): Middleware {
  const { limit = '1mb', strict = true, type = 'application/json' } = options;

  return (req: NextRushRequest, res: NextRushResponse, next) => {
    const contentType = req.headers['content-type'] || '';

    // Check if content type matches
    if (typeof type === 'string' && !contentType.includes(type)) {
      return next();
    }

    if (typeof type === 'function' && !type(req)) {
      return next();
    }

    let body = '';
    let length = 0;
    const maxLength = parseLimit(limit);

    req.setEncoding('utf8');

    req.on('data', (chunk: string) => {
      length += Buffer.byteLength(chunk);

      if (length > maxLength) {
        const error = new Error('Request entity too large');
        (error as any).status = 413;
        return next(error);
      }

      body += chunk;
    });

    req.on('end', () => {
      try {
        req.body = body ? JSON.parse(body) : {};
        next();
      } catch (err) {
        const error = new Error('Invalid JSON');
        (error as any).status = 400;
        next(error);
      }
    });

    req.on('error', next);
  };
}

/**
 * 📊 Request Logger Middleware
 * HTTP request logging using NextRush types
 */
export function logger(options: LoggerOptions = {}): Middleware {
  const { format = 'combined', immediate = false } = options;

  return (req: NextRushRequest, res: NextRushResponse, next) => {
    const start = Date.now();

    const log = () => {
      const duration = Date.now() - start;
      const logEntry = formatLogEntry(req, res, duration, format);
      console.log(logEntry);
    };

    if (immediate) {
      log();
    } else {
      res.on('finish', log);
    }

    next();
  };
}

/**
 * ⚡ Rate Limiting Middleware
 * Request rate limiting using NextRush types
 */
export function rateLimit(options: RateLimitOptions = {}): Middleware {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    message = 'Too many requests, please try again later.',
    statusCode = 429,
  } = options;

  const keyGenerator: (req: NextRushRequest) => string =
    options.keyGenerator ||
    ((req: NextRushRequest) =>
      req.ip() || req.socket.remoteAddress || 'unknown');
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: NextRushRequest, res: NextRushResponse, next) => {
    const key = keyGenerator(req);
    const now = Date.now();

    // Clean up old entries
    for (const [ip, data] of requests.entries()) {
      if (data.resetTime < now) {
        requests.delete(ip);
      }
    }

    // Get or create request data
    let requestData = requests.get(key);
    if (!requestData || requestData.resetTime < now) {
      requestData = { count: 0, resetTime: now + windowMs };
      requests.set(key, requestData);
    }

    requestData.count++;

    // Resolve max value
    const maxRequests = typeof max === 'function' ? max(req) : max;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader(
      'X-RateLimit-Remaining',
      Math.max(0, maxRequests - requestData.count).toString()
    );
    res.setHeader(
      'X-RateLimit-Reset',
      new Date(requestData.resetTime).toISOString()
    );

    // Check if limit exceeded
    if (requestData.count > maxRequests) {
      res.status(statusCode).json({ error: message });
      return;
    }

    next();
  };
}

/**
 * 🆔 Request ID Middleware
 * Generate unique request IDs using NextRush types
 */
export function requestId(options: RequestIdOptions = {}): Middleware {
  const { header = 'X-Request-ID', generator = () => crypto.randomUUID() } =
    options;

  return (req: NextRushRequest, res: NextRushResponse, next) => {
    const id = (req.headers[header.toLowerCase()] as string) || generator();
    req.id = id;
    res.setHeader(header, id);
    next();
  };
}

/**
 * ⏱️ Request Timer Middleware
 * Measure request processing time using NextRush types
 */
export function requestTimer(options: RequestTimerOptions = {}): Middleware {
  const { header = 'X-Response-Time', digits = 3 } = options;

  return (req: NextRushRequest, res: NextRushResponse, next) => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds
      res.setHeader(header, `${duration.toFixed(digits)}ms`);
    });

    next();
  };
}

/**
 * 🍪 Cookie Parser Middleware
 * Parse cookies using NextRush types
 */
export function cookieParser(options: CookieParserOptions = {}): Middleware {
  const { secret } = options;

  return (req: NextRushRequest, res: NextRushResponse, next) => {
    const cookieHeader = req.headers.cookie;
    req.cookies = {};
    req.signedCookies = {};

    if (!cookieHeader) {
      return next();
    }

    // Parse cookies
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [name, ...rest] = cookie.trim().split('=');
      if (name && rest.length > 0) {
        const value = rest.join('=');

        // Handle signed cookies
        if (secret && value.startsWith('s:')) {
          try {
            const unsigned = unsignCookie(
              value.slice(2),
              Array.isArray(secret) ? secret[0] : secret
            );
            if (unsigned !== false) {
              req.signedCookies![name] = unsigned;
            }
          } catch (err) {
            // Invalid signature, ignore
          }
        } else {
          acc[name] = decodeURIComponent(value);
        }
      }
      return acc;
    }, {} as Record<string, string>);

    req.cookies = cookies;
    next();
  };
}

// Helper functions
function parseLimit(limit: string | number): number {
  if (typeof limit === 'number') return limit;

  const match = limit.match(/^(\d+(?:\.\d+)?)\s*(kb|mb|gb)?$/i);
  if (!match) return 1024 * 1024; // 1MB default

  const value = parseFloat(match[1]);
  const unit = (match[2] || '').toLowerCase();

  switch (unit) {
    case 'kb':
      return value * 1024;
    case 'mb':
      return value * 1024 * 1024;
    case 'gb':
      return value * 1024 * 1024 * 1024;
    default:
      return value;
  }
}

function formatLogEntry(
  req: NextRushRequest,
  res: NextRushResponse,
  duration: number,
  format: string
): string {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const status = res.statusCode;
  const userAgent = req.headers['user-agent'] || '-';
  const ip = req.ip || req.socket.remoteAddress || '-';

  switch (format) {
    case 'combined':
      return `${ip} - - [${timestamp}] "${method} ${url} HTTP/1.1" ${status} - "${userAgent}" ${duration}ms`;
    case 'common':
      return `${ip} - - [${timestamp}] "${method} ${url} HTTP/1.1" ${status} -`;
    case 'short':
      return `${method} ${url} ${status} ${duration}ms`;
    case 'tiny':
      return `${method} ${url} ${status}`;
    default:
      return `${timestamp} ${method} ${url} ${status} ${duration}ms`;
  }
}

function unsignCookie(value: string, secret: string): string | false {
  try {
    const mac = value.slice(-27);
    const data = value.slice(0, -27);
    const expected = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('base64')
      .replace(/=/g, '');

    return mac === expected ? data : false;
  } catch (err) {
    return false;
  }
}

// Export all middleware as a collection
export const middleware = {
  cors,
  helmet,
  compression,
  json,
  logger,
  rateLimit,
  requestId,
  requestTimer,
  cookieParser,
};

export default middleware;
