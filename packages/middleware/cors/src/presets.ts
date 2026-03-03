/**
 * @nextrush/cors - Preset configurations
 *
 * Pre-configured CORS middleware for common use cases.
 * Provides secure defaults while maintaining ease of use.
 *
 * @packageDocumentation
 */

import type { Middleware } from '@nextrush/types';
import { DEFAULT_MAX_AGE, DEFAULT_METHODS } from './constants.js';
import { cors } from './middleware.js';
import { securityWarning } from './security.js';
import type { CorsOptions, OriginValidator } from './types.js';

/**
 * Permissive CORS preset for development or public APIs.
 *
 * @warning DO NOT use in production with sensitive data.
 * Allows any origin with all standard methods.
 *
 * @returns Middleware function
 *
 * @security This preset:
 * - Allows any origin (`*`)
 * - Does NOT allow credentials
 * - Blocks null origins
 * - Is suitable only for truly public APIs
 *
 * @example
 * ```typescript
 * // Development server
 * if (process.env.NODE_ENV === 'development') {
 *   app.use(simpleCors());
 * }
 *
 * // Public API with no auth
 * app.use('/public', simpleCors());
 * ```
 */
export function simpleCors(): Middleware {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    securityWarning(
      'simpleCors() is not recommended for production. ' +
        'Consider using cors() with explicit origin configuration.'
    );
  }

  return cors({
    origin: '*',
    methods: DEFAULT_METHODS,
    credentials: false,
    blockNullOrigin: true,
  });
}

/**
 * Strict CORS preset for authenticated APIs.
 *
 * Requires explicit origin configuration and enables credentials.
 * Use for APIs that handle user sessions or sensitive data.
 *
 * @param origin - Allowed origin(s) - REQUIRED
 * @param options - Additional CORS options
 * @returns Middleware function
 *
 * @security This preset:
 * - Requires explicit origin (no wildcards)
 * - Enables credentials by default
 * - Always blocks null origins
 * - Caches preflight for 24 hours by default
 *
 * @example
 * ```typescript
 * // Single origin
 * app.use(strictCors('https://app.example.com'));
 *
 * // Multiple origins
 * app.use(strictCors([
 *   'https://app.example.com',
 *   'https://admin.example.com'
 * ]));
 *
 * // With additional options
 * app.use(strictCors('https://app.example.com', {
 *   exposedHeaders: ['X-Request-Id'],
 *   maxAge: 86400
 * }));
 * ```
 */
export function strictCors(
  origin: string | string[] | OriginValidator,
  options: Omit<CorsOptions, 'origin' | 'credentials'> = {}
): Middleware {
  if (!origin) {
    throw new Error(
      '[@nextrush/cors] strictCors requires an explicit origin. ' +
        'Use cors() for custom configuration or simpleCors() for development.'
    );
  }

  // Validate that origin is not wildcard
  if (origin === '*') {
    throw new Error(
      '[@nextrush/cors] strictCors cannot use wildcard origin with credentials. ' +
        'Provide specific origin(s) or use simpleCors() for public APIs.'
    );
  }

  return cors({
    ...options,
    origin,
    credentials: true,
    blockNullOrigin: true, // Always block null in strict mode
    maxAge: options.maxAge ?? DEFAULT_MAX_AGE, // Default 24 hour cache
  });
}

/**
 * Development CORS preset with verbose logging.
 *
 * Ideal for local development - allows localhost and common dev ports.
 *
 * @param additionalOrigins - Additional origins to allow (besides localhost)
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * // Basic dev setup (allows localhost:3000-3999)
 * app.use(devCors());
 *
 * // With additional origins
 * app.use(devCors(['https://staging.example.com']));
 * ```
 */
export function devCors(additionalOrigins: string[] = []): Middleware {
  // Localhost pattern for development
  const isLocalhost = (origin: string): boolean => {
    try {
      const url = new URL(origin);
      return (
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === '::1' ||
        url.hostname.endsWith('.localhost')
      );
    } catch {
      return false;
    }
  };

  const originValidator: OriginValidator = (origin) => {
    // Allow localhost origins
    if (isLocalhost(origin)) {
      return true;
    }

    // Check additional origins
    if (additionalOrigins.includes(origin)) {
      return true;
    }

    return false;
  };

  return cors({
    origin: originValidator,
    methods: DEFAULT_METHODS,
    credentials: true,
    privateNetworkAccess: true, // Enable PNA for local dev
    blockNullOrigin: false, // Allow null in dev for file:// testing
    maxAge: 0, // No caching in dev
  });
}

/**
 * Internal/private API preset.
 *
 * Use for APIs that should only be accessed from specific internal domains.
 *
 * @param internalDomains - List of internal domain patterns
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * // Only allow internal microservices
 * app.use(internalCors([
 *   'https://service1.internal.example.com',
 *   'https://service2.internal.example.com'
 * ]));
 * ```
 */
export function internalCors(internalDomains: string[]): Middleware {
  if (!internalDomains.length) {
    throw new Error('[@nextrush/cors] internalCors requires at least one internal domain.');
  }

  return cors({
    origin: internalDomains,
    methods: DEFAULT_METHODS,
    credentials: true,
    blockNullOrigin: true,
    maxAge: DEFAULT_MAX_AGE,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Correlation-Id',
      'X-Internal-Token',
    ],
    exposedHeaders: ['X-Request-Id', 'X-Correlation-Id'],
  });
}

/**
 * CDN/Static asset preset.
 *
 * Optimized for serving static assets with long cache times.
 *
 * @param origins - Allowed origins for asset requests
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * // Allow specific domains to fetch assets
 * app.use(staticAssetsCors(['https://example.com', 'https://cdn.example.com']));
 * ```
 */
export function staticAssetsCors(origins: string | string[] = '*'): Middleware {
  return cors({
    origin: origins,
    methods: ['GET', 'HEAD', 'OPTIONS'],
    credentials: false,
    maxAge: 86400 * 7, // 7 days cache
    blockNullOrigin: false, // Allow embedded assets
    exposedHeaders: [
      'Content-Length',
      'Content-Type',
      'Content-Encoding',
      'ETag',
      'Last-Modified',
      'Cache-Control',
    ],
  });
}
