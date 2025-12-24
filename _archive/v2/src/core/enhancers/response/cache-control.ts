/**
 * Cache Control Utilities for NextRush v2
 *
 * Provides cache control and security header management.
 *
 * @packageDocumentation
 */

import type { ServerResponse } from 'node:http';

/**
 * Cache control options
 */
export interface CacheOptions {
  /** Max age in seconds */
  maxAge?: number;
  /** Whether the cache is public */
  public?: boolean;
  /** Whether to add immutable directive */
  immutable?: boolean;
  /** Must revalidate */
  mustRevalidate?: boolean;
  /** No cache */
  noCache?: boolean;
  /** No store */
  noStore?: boolean;
  /** Private */
  private?: boolean;
  /** stale-while-revalidate in seconds */
  staleWhileRevalidate?: number;
  /** stale-if-error in seconds */
  staleIfError?: number;
}

/**
 * Security header options
 */
export interface SecurityOptions {
  /** X-Content-Type-Options value */
  contentTypeOptions?: 'nosniff' | false;
  /** X-Frame-Options value */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false;
  /** X-XSS-Protection value */
  xssProtection?: boolean;
  /** Referrer-Policy value */
  referrerPolicy?: string | false;
  /** Content-Security-Policy value */
  contentSecurityPolicy?: string | false;
  /** Strict-Transport-Security options */
  hsts?: {
    maxAge: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  } | false;
}

/**
 * Set cache control headers
 *
 * @param res - Server response object
 * @param options - Cache control options
 *
 * @example
 * ```typescript
 * setCacheControl(res, { maxAge: 3600, public: true });
 * setCacheControl(res, { noCache: true, noStore: true });
 * ```
 */
export function setCacheControl(res: ServerResponse, options: CacheOptions): void {
  const directives: string[] = [];

  if (options.noCache) {
    directives.push('no-cache');
  }
  if (options.noStore) {
    directives.push('no-store');
  }
  if (options.mustRevalidate) {
    directives.push('must-revalidate');
  }
  if (options.public) {
    directives.push('public');
  }
  if (options.private) {
    directives.push('private');
  }
  if (options.maxAge !== undefined) {
    directives.push(`max-age=${options.maxAge}`);
  }
  if (options.immutable) {
    directives.push('immutable');
  }
  if (options.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }
  if (options.staleIfError !== undefined) {
    directives.push(`stale-if-error=${options.staleIfError}`);
  }

  if (directives.length > 0) {
    res.setHeader('Cache-Control', directives.join(', '));
  }
}

/**
 * Set cache headers for a specific duration
 *
 * @param res - Server response object
 * @param seconds - Cache duration in seconds
 *
 * @example
 * ```typescript
 * setCache(res, 3600); // Cache for 1 hour
 * ```
 */
export function setCache(res: ServerResponse, seconds: number): void {
  setCacheControl(res, { maxAge: seconds, public: true });
}

/**
 * Set no-cache headers
 *
 * @param res - Server response object
 *
 * @example
 * ```typescript
 * setNoCache(res);
 * ```
 */
export function setNoCache(res: ServerResponse): void {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

/**
 * Set security headers
 *
 * @param res - Server response object
 * @param options - Security header options
 *
 * @example
 * ```typescript
 * setSecurityHeaders(res); // Set default security headers
 * setSecurityHeaders(res, { frameOptions: 'SAMEORIGIN' });
 * ```
 */
export function setSecurityHeaders(
  res: ServerResponse,
  options: SecurityOptions = {}
): void {
  // X-Content-Type-Options
  if (options.contentTypeOptions !== false) {
    res.setHeader('X-Content-Type-Options', options.contentTypeOptions || 'nosniff');
  }

  // X-Frame-Options
  if (options.frameOptions !== false) {
    res.setHeader('X-Frame-Options', options.frameOptions || 'DENY');
  }

  // X-XSS-Protection
  if (options.xssProtection !== false) {
    res.setHeader('X-XSS-Protection', '1; mode=block');
  }

  // Referrer-Policy
  if (options.referrerPolicy !== false) {
    res.setHeader(
      'Referrer-Policy',
      options.referrerPolicy || 'strict-origin-when-cross-origin'
    );
  }

  // Content-Security-Policy
  if (options.contentSecurityPolicy) {
    res.setHeader('Content-Security-Policy', options.contentSecurityPolicy);
  }

  // Strict-Transport-Security
  if (options.hsts) {
    const hstsDirectives = [`max-age=${options.hsts.maxAge}`];
    if (options.hsts.includeSubDomains) {
      hstsDirectives.push('includeSubDomains');
    }
    if (options.hsts.preload) {
      hstsDirectives.push('preload');
    }
    res.setHeader('Strict-Transport-Security', hstsDirectives.join('; '));
  }
}

/**
 * Set CORS headers
 *
 * @param res - Server response object
 * @param origin - Allowed origin (default: '*')
 * @param methods - Allowed methods
 * @param headers - Allowed headers
 *
 * @example
 * ```typescript
 * setCorsHeaders(res, 'https://example.com');
 * setCorsHeaders(res, '*', ['GET', 'POST'], ['Content-Type', 'Authorization']);
 * ```
 */
export function setCorsHeaders(
  res: ServerResponse,
  origin: string = '*',
  methods: string[] = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  headers: string[] = ['Content-Type', 'Authorization']
): void {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', headers.join(', '));
}

/**
 * Set ETag header
 *
 * @param res - Server response object
 * @param etag - ETag value
 */
export function setETag(res: ServerResponse, etag: string): void {
  res.setHeader('ETag', etag);
}

/**
 * Set Last-Modified header
 *
 * @param res - Server response object
 * @param date - Last modified date
 */
export function setLastModified(res: ServerResponse, date: Date): void {
  res.setHeader('Last-Modified', date.toUTCString());
}

/**
 * Set Content-Type header
 *
 * @param res - Server response object
 * @param type - Content type
 */
export function setContentType(res: ServerResponse, type: string): void {
  res.setHeader('Content-Type', type);
}

/**
 * Set Content-Length header
 *
 * @param res - Server response object
 * @param length - Content length in bytes
 */
export function setContentLength(res: ServerResponse, length: number): void {
  res.setHeader('Content-Length', length.toString());
}
