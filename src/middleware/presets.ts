/**
 * 🎛️ NextRush Middleware Presets
 * Pre-configured middleware stacks for common use cases
 */

import {
  compression,
  cors,
  helmet,
  json,
  logger,
  rateLimit,
  requestId,
  requestTimer,
} from './built-in';
import { compose } from './nextcompose';

export interface PresetOptions {
  cors?: boolean | any;
  helmet?: boolean | any;
  compression?: boolean | any;
  json?: boolean | any;
  logger?: boolean | any;
  requestId?: boolean | any;
  requestTimer?: boolean | any;
  rateLimit?: boolean | any;
  [key: string]: any;
}

/**
 * 🚀 Development Preset
 * Optimized for development with detailed logging and relaxed security
 */
export function development(options: PresetOptions = {}) {
  const middlewares: any[] = [];

  // Request ID for tracking
  if (options.requestId !== false) {
    middlewares.push(requestId(options.requestId || {}));
  }

  // Response time tracking
  if (options.requestTimer !== false) {
    middlewares.push(requestTimer(options.requestTimer || {}));
  }

  // Detailed logging for development
  if (options.logger !== false) {
    middlewares.push(
      logger({
        format: 'dev',
        ...options.logger,
      })
    );
  }

  // Permissive CORS for development
  if (options.cors !== false) {
    middlewares.push(
      cors({
        origin: true,
        credentials: true,
        ...options.cors,
      })
    );
  }

  // Basic helmet for development
  if (options.helmet !== false) {
    middlewares.push(
      helmet({
        contentSecurityPolicy: false, // Relaxed for development
        ...options.helmet,
      })
    );
  }

  // JSON parsing
  if (options.json !== false) {
    middlewares.push(
      json({
        limit: '10mb', // Generous limit for development
        ...options.json,
      })
    );
  }

  // Light compression
  if (options.compression !== false) {
    middlewares.push(
      compression({
        threshold: 0, // Compress everything for testing
        ...options.compression,
      })
    );
  }

  return compose(...middlewares);
}

/**
 * 🏭 Production Preset
 * Optimized for production with security and performance
 */
export function production(options: PresetOptions = {}) {
  const middlewares: any[] = [];

  // Request ID for tracking
  if (options.requestId !== false) {
    middlewares.push(requestId(options.requestId || {}));
  }

  // Response time tracking
  if (options.requestTimer !== false) {
    middlewares.push(requestTimer(options.requestTimer || {}));
  }

  // Structured logging for production
  if (options.logger !== false) {
    middlewares.push(
      logger({
        format: 'json',
        skip: (req: any, res: any) => res.statusCode < 400, // Only log errors
        ...options.logger,
      })
    );
  }

  // Rate limiting
  if (options.rateLimit !== false) {
    middlewares.push(
      rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        ...options.rateLimit,
      })
    );
  }

  // Strict CORS
  if (options.cors !== false) {
    middlewares.push(
      cors({
        origin: false, // Must be explicitly configured
        credentials: false,
        ...options.cors,
      })
    );
  }

  // Full security headers
  if (options.helmet !== false) {
    middlewares.push(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
        ...options.helmet,
      })
    );
  }

  // JSON parsing with strict limits
  if (options.json !== false) {
    middlewares.push(
      json({
        limit: '1mb', // Strict limit for production
        strict: true,
        ...options.json,
      })
    );
  }

  // Aggressive compression
  if (options.compression !== false) {
    middlewares.push(
      compression({
        threshold: 1024, // 1KB threshold
        level: 6, // Good compression
        ...options.compression,
      })
    );
  }

  return compose(...middlewares);
}

/**
 * 🌐 API Preset
 * Optimized for REST/GraphQL APIs
 */
export function api(options: PresetOptions = {}) {
  const middlewares: any[] = [];

  // Request ID for API tracing
  if (options.requestId !== false) {
    middlewares.push(requestId(options.requestId || {}));
  }

  // Response time for API monitoring
  if (options.requestTimer !== false) {
    middlewares.push(requestTimer(options.requestTimer || {}));
  }

  // API-focused logging
  if (options.logger !== false) {
    middlewares.push(
      logger({
        format: 'json',
        tokens: {
          'api-version': (req: any) => req.headers['api-version'] || 'v1',
          'user-id': (req: any) => req.user?.id || 'anonymous',
        },
        ...options.logger,
      })
    );
  }

  // API-friendly CORS
  if (options.cors !== false) {
    middlewares.push(
      cors({
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Requested-With',
          'API-Version',
        ],
        exposedHeaders: [
          'X-Request-ID',
          'X-Response-Time',
          'X-RateLimit-Remaining',
        ],
        credentials: true,
        ...options.cors,
      })
    );
  }

  // API security headers
  if (options.helmet !== false) {
    middlewares.push(
      helmet({
        contentSecurityPolicy: false, // Not needed for APIs
        crossOriginEmbedderPolicy: false,
        ...options.helmet,
      })
    );
  }

  // Rate limiting for APIs
  if (options.rateLimit !== false) {
    middlewares.push(
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 1000, // Higher limit for APIs
        keyGenerator: (req: any) => {
          return req.user?.id || req.ip; // Rate limit per user or IP
        },
        ...options.rateLimit,
      })
    );
  }

  // JSON parsing optimized for APIs
  if (options.json !== false) {
    middlewares.push(
      json({
        limit: '5mb', // Generous for API payloads
        strict: true,
        type: ['application/json', 'application/*+json'],
        ...options.json,
      })
    );
  }

  // Compression for API responses
  if (options.compression !== false) {
    middlewares.push(
      compression({
        threshold: 512, // Compress smaller responses
        filter: (req: any, res: any) => {
          const contentType = res.getHeader('Content-Type') || '';
          return /json|text/.test(contentType);
        },
        ...options.compression,
      })
    );
  }

  return compose(...middlewares);
}

/**
 * 🔒 Security Preset
 * Maximum security middleware stack
 */
export function security(options: PresetOptions = {}) {
  const middlewares: any[] = [];

  // Request tracking for security
  if (options.requestId !== false) {
    middlewares.push(requestId(options.requestId || {}));
  }

  // Aggressive rate limiting
  if (options.rateLimit !== false) {
    middlewares.push(
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 50, // Very strict
        message: {
          error: 'Too many requests',
          retryAfter: '15 minutes',
        },
        ...options.rateLimit,
      })
    );
  }

  // Strict CORS
  if (options.cors !== false) {
    middlewares.push(
      cors({
        origin: false, // No CORS by default
        credentials: false,
        ...options.cors,
      })
    );
  }

  // Maximum security headers
  if (options.helmet !== false) {
    middlewares.push(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'none'"],
            baseUri: ["'self'"],
            fontSrc: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
            imgSrc: ["'self'", 'data:'],
            objectSrc: ["'none'"],
            scriptSrc: ["'self'"],
            scriptSrcAttr: ["'none'"],
            styleSrc: ["'self'"],
            upgradeInsecureRequests: [],
          },
          useDefaults: false,
        },
        crossOriginEmbedderPolicy: { policy: 'require-corp' },
        crossOriginOpenerPolicy: { policy: 'same-origin' },
        crossOriginResourcePolicy: { policy: 'same-origin' },
        frameguard: { action: 'deny' },
        hsts: {
          maxAge: 63072000, // 2 years
          includeSubDomains: true,
          preload: true,
        },
        referrerPolicy: { policy: 'no-referrer' },
        ...options.helmet,
      })
    );
  }

  // Strict JSON parsing
  if (options.json !== false) {
    middlewares.push(
      json({
        limit: '100kb', // Very strict limit
        strict: true,
        verify: (req: any, res: any, body: Buffer) => {
          // Additional security verification can be added here
          if (body.length === 0) return;

          // Check for potential security issues in JSON
          const str = body.toString();
          if (str.includes('__proto__') || str.includes('constructor')) {
            throw new Error('Potentially malicious JSON detected');
          }
        },
        ...options.json,
      })
    );
  }

  // Security-focused logging
  if (options.logger !== false) {
    middlewares.push(
      logger({
        format: 'json',
        tokens: {
          'security-level': () => 'high',
          'threat-score': (req: any) => {
            // Simple threat scoring based on request characteristics
            let score = 0;
            if (req.headers['user-agent']?.includes('bot')) score += 1;
            if (req.method === 'POST' && !req.headers['content-type'])
              score += 2;
            if (req.url?.includes('..')) score += 3;
            return score.toString();
          },
        },
        ...options.logger,
      })
    );
  }

  return compose(...middlewares);
}

/**
 * ⚡ Minimal Preset
 * Lightweight middleware for maximum performance
 */
export function minimal(options: PresetOptions = {}) {
  const middlewares: any[] = [];

  // Only essential middleware

  // Basic CORS if needed
  if (options.cors) {
    middlewares.push(cors(options.cors));
  }

  // Basic JSON parsing
  if (options.json !== false) {
    middlewares.push(
      json({
        limit: '1mb',
        ...options.json,
      })
    );
  }

  // Basic compression
  if (options.compression) {
    middlewares.push(
      compression({
        threshold: 2048, // Only compress larger responses
        ...options.compression,
      })
    );
  }

  return compose(...middlewares);
}

/**
 * 🎯 Custom Preset Builder
 * Create custom presets with fluent interface
 */
export class PresetBuilder {
  private middlewares: any[] = [];

  withRequestId(options?: any) {
    this.middlewares.push(requestId(options));
    return this;
  }

  withTimer(options?: any) {
    this.middlewares.push(requestTimer(options));
    return this;
  }

  withLogger(options?: any) {
    this.middlewares.push(logger(options));
    return this;
  }

  withCors(options?: any) {
    this.middlewares.push(cors(options));
    return this;
  }

  withHelmet(options?: any) {
    this.middlewares.push(helmet(options));
    return this;
  }

  withRateLimit(options?: any) {
    this.middlewares.push(rateLimit(options));
    return this;
  }

  withJson(options?: any) {
    this.middlewares.push(json(options));
    return this;
  }

  withCompression(options?: any) {
    this.middlewares.push(compression(options));
    return this;
  }

  withCustom(middleware: any) {
    this.middlewares.push(middleware);
    return this;
  }

  build() {
    return compose(...this.middlewares);
  }
}

/**
 * 🏗️ Create Custom Preset
 * Factory function for custom preset builder
 */
export function createPreset(): PresetBuilder {
  return new PresetBuilder();
}

// Export all presets
export const presets = {
  development,
  production,
  api,
  security,
  minimal,
  createPreset,
};

export default presets;
