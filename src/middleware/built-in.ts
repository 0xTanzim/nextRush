/**
 * Built-in middleware for NextRush
 */

import * as crypto from 'crypto';
import {
  ExpressMiddleware,
  NextRushRequest,
  NextRushResponse,
} from '../types/express';

export interface CorsOptions {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string | string[];
  allowedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
}

/**
 * CORS middleware
 */
export function cors(options: CorsOptions = {}): ExpressMiddleware {
  const {
    origin = '*',
    methods = 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders = '*',
    credentials = false,
    maxAge = 86400,
  } = options;

  return (
    req: NextRushRequest,
    res: NextRushResponse,
    next: () => void
  ): void => {
    if (typeof origin === 'string') {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (Array.isArray(origin)) {
      const requestOrigin = req.headers.origin;
      if (requestOrigin && origin.includes(requestOrigin)) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      }
    } else if (typeof origin === 'function') {
      const requestOrigin = req.headers.origin;
      if (requestOrigin && origin(requestOrigin)) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      }
    }

    const methodsStr = Array.isArray(methods) ? methods.join(',') : methods;
    res.setHeader('Access-Control-Allow-Methods', methodsStr);

    const headersStr = Array.isArray(allowedHeaders)
      ? allowedHeaders.join(',')
      : allowedHeaders;
    res.setHeader('Access-Control-Allow-Headers', headersStr);

    if (credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Max-Age', maxAge.toString());
      res.status(204).end();
      return;
    }

    next();
  };
}

export interface HelmetOptions {
  contentSecurityPolicy?: boolean | object;
  crossOriginEmbedderPolicy?: boolean;
  crossOriginOpenerPolicy?: boolean;
  crossOriginResourcePolicy?: boolean;
  frameguard?: boolean | { action: string };
  hidePoweredBy?: boolean;
  hsts?: boolean | object;
  noSniff?: boolean;
  originAgentCluster?: boolean;
  permittedCrossDomainPolicies?: boolean;
  referrerPolicy?: boolean | object;
  xssFilter?: boolean;
}

/**
 * Helmet middleware for security headers
 */
export function helmet(options: HelmetOptions = {}): ExpressMiddleware {
  const defaults = {
    contentSecurityPolicy: true,
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: true,
    frameguard: true,
    hidePoweredBy: true,
    hsts: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: true,
    referrerPolicy: true,
    xssFilter: true,
    ...options,
  };

  return (
    _req: NextRushRequest,
    res: NextRushResponse,
    next: () => void
  ): void => {
    if (defaults.contentSecurityPolicy) {
      res.setHeader('Content-Security-Policy', "default-src 'self'");
    }

    if (defaults.crossOriginEmbedderPolicy) {
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    }

    if (defaults.crossOriginOpenerPolicy) {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    }

    if (defaults.crossOriginResourcePolicy) {
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    }

    if (defaults.frameguard) {
      res.setHeader('X-Frame-Options', 'DENY');
    }

    if (defaults.hidePoweredBy) {
      res.removeHeader('X-Powered-By');
    }

    if (defaults.hsts) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
    }

    if (defaults.noSniff) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    if (defaults.originAgentCluster) {
      res.setHeader('Origin-Agent-Cluster', '?1');
    }

    if (defaults.permittedCrossDomainPolicies) {
      res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    }

    if (defaults.referrerPolicy) {
      res.setHeader('Referrer-Policy', 'no-referrer');
    }

    if (defaults.xssFilter) {
      res.setHeader('X-XSS-Protection', '0');
    }

    next();
  };
}

export interface CompressionOptions {
  threshold?: number;
  level?: number;
  filter?: (req: NextRushRequest, res: NextRushResponse) => boolean;
}

/**
 * Compression middleware
 */
export function compression(
  options: CompressionOptions = {}
): ExpressMiddleware {
  const { filter } = options;

  return (
    req: NextRushRequest,
    res: NextRushResponse,
    next: () => void
  ): void => {
    const acceptEncoding = req.headers['accept-encoding'] || '';

    if (
      !acceptEncoding.includes('gzip') &&
      !acceptEncoding.includes('deflate')
    ) {
      return next();
    }

    if (filter && !filter(req, res)) {
      return next();
    }

    if (acceptEncoding.includes('gzip')) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
    }

    next();
  };
}

/**
 * JSON body parser middleware
 */
export function json(
  options: { limit?: string; strict?: boolean } = {}
): ExpressMiddleware {
  const { limit = '100kb', strict = true } = options;
  const limitBytes = parseLimit(limit);

  return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
    const contentType = req.headers['content-type'];

    if (!contentType || !contentType.includes('application/json')) {
      return next();
    }

    let body = '';
    let length = 0;

    req.on('data', (chunk: Buffer) => {
      length += chunk.length;

      if (length > limitBytes) {
        return res.status(413).json({
          error: 'Request entity too large',
          limit: limit,
        });
      }

      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        req.body = body ? JSON.parse(body) : {};
        next();
      } catch (error) {
        res.status(400).json({
          error: 'Invalid JSON',
          details: strict ? (error as Error).message : undefined,
        });
      }
    });

    req.on('error', (error) => {
      res.status(400).json({
        error: 'Request error',
        details: error.message,
      });
    });
  };
}

/**
 * Request ID middleware
 */
export function requestId(
  options: { header?: string; generator?: () => string } = {}
): ExpressMiddleware {
  const { header = 'X-Request-ID', generator = () => crypto.randomUUID() } =
    options;

  return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
    const id = (req.headers[header.toLowerCase()] as string) || generator();

    (req as any).id = id;
    res.setHeader(header, id);

    next();
  };
}

/**
 * Request timer middleware
 */
export function requestTimer(): ExpressMiddleware {
  return (
    req: NextRushRequest,
    res: NextRushResponse,
    next: () => void
  ): void => {
    const startTime = Date.now();
    (req as any).startTime = startTime;

    const originalEnd = res.end.bind(res);
    res.end = function (chunk?: any, encoding?: any, cb?: any): any {
      const duration = Date.now() - startTime;
      res.setHeader('X-Response-Time', `${duration}ms`);
      return originalEnd.call(res, chunk, encoding, cb);
    };

    next();
  };
}

export interface LoggerOptions {
  format?: 'simple' | 'detailed' | 'json' | 'combined';
  skip?: (req: NextRushRequest, res: NextRushResponse) => boolean;
}

/**
 * Logger middleware
 */
export function logger(options: LoggerOptions = {}): ExpressMiddleware {
  const { format = 'simple', skip } = options;

  return (
    req: NextRushRequest,
    res: NextRushResponse,
    next: () => void
  ): void => {
    if (skip && skip(req, res)) {
      return next();
    }

    const startTime = Date.now();
    const originalEnd = res.end.bind(res);

    res.end = function (chunk?: any, encoding?: any, cb?: any): any {
      const duration = Date.now() - startTime;
      const timestamp = new Date().toISOString();

      switch (format) {
        case 'simple':
          console.log(
            `${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`
          );
          break;

        case 'detailed':
          console.log(
            `[${timestamp}] ${req.method} ${req.url} - ${
              res.statusCode
            } - ${duration}ms - ${req.headers['user-agent'] || 'Unknown'}`
          );
          break;

        case 'json':
          console.log(
            JSON.stringify({
              timestamp,
              method: req.method,
              url: req.url,
              statusCode: res.statusCode,
              duration,
              userAgent: req.headers['user-agent'],
              ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
            })
          );
          break;

        case 'combined':
          console.log(
            `${req.socket?.remoteAddress} - - [${timestamp}] "${req.method} ${
              req.url
            }" ${res.statusCode} - "${req.headers.referer || '-'}" "${
              req.headers['user-agent'] || '-'
            }" ${duration}ms`
          );
          break;
      }

      return originalEnd.call(res, chunk, encoding, cb);
    };

    next();
  };
}

function parseLimit(limit: string): number {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = limit.match(/^(\d+)(b|kb|mb|gb)?$/i);
  if (!match) return 100 * 1024;

  const value = parseInt(match[1]);
  const unit = (match[2] || 'b').toLowerCase();

  return value * (units[unit] || 1);
}
