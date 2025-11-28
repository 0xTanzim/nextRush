/**
 * URL Parser Utility for NextRush v2
 *
 * Fast URL parsing utilities optimized for HTTP request handling.
 * Avoids expensive URL constructor when possible.
 *
 * @packageDocumentation
 */

import type { IncomingHttpHeaders } from 'node:http';
import { DEFAULT_HOSTNAME } from '../constants';

/**
 * Parsed URL components
 */
export interface ParsedURLComponents {
  /** Full URL path including query string */
  readonly url: string;

  /** Path without query string */
  readonly path: string;

  /** Query string including '?' prefix */
  readonly search: string;

  /** Query string without '?' prefix */
  readonly queryString: string;

  /** Protocol (http or https) */
  readonly protocol: string;

  /** Hostname without port */
  readonly hostname: string;

  /** Host with port */
  readonly host: string;

  /** Full origin (protocol://host) */
  readonly origin: string;

  /** Full href (origin + url) */
  readonly href: string;

  /** Whether connection is secure */
  readonly secure: boolean;
}

/**
 * Options for URL parsing
 */
export interface URLParseOptions {
  /** Default protocol if not detected */
  readonly defaultProtocol?: 'http' | 'https';

  /** Trust X-Forwarded headers for protocol detection */
  readonly trustProxy?: boolean;
}

/**
 * Fast URL path extraction
 *
 * Extracts path from URL without query string.
 * Optimized for hot path - avoids regex and URL constructor.
 *
 * @param url - Full URL or path string
 * @returns Path without query string
 *
 * @example
 * ```typescript
 * extractPath('/users?page=1'); // '/users'
 * extractPath('/api/v1/data');  // '/api/v1/data'
 * ```
 */
export function extractPath(url: string): string {
  if (!url) return '/';

  const queryIndex = url.indexOf('?');
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

/**
 * Fast query string extraction
 *
 * @param url - Full URL or path string
 * @returns Query string including '?' or empty string
 *
 * @example
 * ```typescript
 * extractSearch('/users?page=1'); // '?page=1'
 * extractSearch('/api/v1/data');  // ''
 * ```
 */
export function extractSearch(url: string): string {
  if (!url) return '';

  const queryIndex = url.indexOf('?');
  return queryIndex === -1 ? '' : url.slice(queryIndex);
}

/**
 * Extract hostname from Host header
 *
 * @param host - Host header value
 * @returns Hostname without port
 *
 * @example
 * ```typescript
 * extractHostname('example.com:3000'); // 'example.com'
 * extractHostname('localhost');        // 'localhost'
 * ```
 */
export function extractHostname(host: string | undefined): string {
  if (!host) return DEFAULT_HOSTNAME;

  const colonIndex = host.indexOf(':');
  return colonIndex === -1 ? host : host.slice(0, colonIndex);
}

/**
 * Detect protocol from headers
 *
 * @param headers - HTTP request headers
 * @param encrypted - Whether socket is encrypted
 * @param options - Parse options
 * @returns Detected protocol
 */
export function detectProtocol(
  headers: IncomingHttpHeaders,
  encrypted: boolean = false,
  options: URLParseOptions = {}
): 'http' | 'https' {
  const { trustProxy = true, defaultProtocol = 'http' } = options;

  if (trustProxy) {
    const forwardedProto = headers['x-forwarded-proto'];
    if (forwardedProto === 'https') {
      return 'https';
    }
  }

  return encrypted ? 'https' : defaultProtocol;
}

/**
 * Parse URL components from request
 *
 * Fast parsing optimized for HTTP request handling.
 * Avoids expensive URL constructor.
 *
 * @param url - Request URL
 * @param headers - Request headers
 * @param encrypted - Whether socket is encrypted
 * @param options - Parse options
 * @returns Parsed URL components
 *
 * @example
 * ```typescript
 * const parsed = parseURLComponents('/users?page=1', req.headers);
 * console.log(parsed.path);     // '/users'
 * console.log(parsed.hostname); // 'localhost'
 * console.log(parsed.href);     // 'http://localhost/users?page=1'
 * ```
 */
export function parseURLComponents(
  url: string = '/',
  headers: IncomingHttpHeaders = {},
  encrypted: boolean = false,
  options: URLParseOptions = {}
): ParsedURLComponents {
  const path = extractPath(url);
  const search = extractSearch(url);
  const queryString = search ? search.slice(1) : '';

  const host = (headers.host as string) || DEFAULT_HOSTNAME;
  const hostname = extractHostname(host);
  const protocol = detectProtocol(headers, encrypted, options);
  const secure = protocol === 'https';

  const origin = `${protocol}://${host}`;
  const href = `${origin}${url}`;

  return {
    url,
    path,
    search,
    queryString,
    protocol,
    hostname,
    host,
    origin,
    href,
    secure,
  };
}

/**
 * Build URL from components
 *
 * @param path - URL path
 * @param query - Query parameters
 * @param origin - Origin (protocol://host)
 * @returns Complete URL string
 *
 * @example
 * ```typescript
 * buildURL('/users', { page: '1' }, 'http://localhost');
 * // 'http://localhost/users?page=1'
 * ```
 */
export function buildURL(
  path: string,
  query?: Record<string, string | string[] | undefined>,
  origin?: string
): string {
  let url = path || '/';

  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v));
        } else {
          params.append(key, value);
        }
      }
    }
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  return origin ? `${origin}${url}` : url;
}

/**
 * Normalize URL path
 *
 * Removes double slashes, trailing slashes (except root),
 * and decodes URI components.
 *
 * @param path - URL path to normalize
 * @returns Normalized path
 *
 * @example
 * ```typescript
 * normalizePath('//users//'); // '/users'
 * normalizePath('/');         // '/'
 * ```
 */
export function normalizePath(path: string): string {
  if (!path || path === '/') return '/';

  // Remove consecutive slashes
  let normalized = path.replace(/\/+/g, '/');

  // Remove trailing slash (except for root)
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  // Ensure leading slash
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  return normalized;
}

/**
 * Join URL path segments
 *
 * @param segments - Path segments to join
 * @returns Joined and normalized path
 *
 * @example
 * ```typescript
 * joinPaths('/api', 'v1', 'users'); // '/api/v1/users'
 * joinPaths('/api/', '/v1/', '/users'); // '/api/v1/users'
 * ```
 */
export function joinPaths(...segments: string[]): string {
  const joined = segments
    .filter(Boolean)
    .map(s => s.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');

  return '/' + joined;
}

/**
 * Check if URL matches a pattern with parameters
 *
 * @param pattern - Route pattern (e.g., '/users/:id')
 * @param url - URL to match
 * @returns True if matches
 */
export function matchesPattern(pattern: string, url: string): boolean {
  const patternParts = pattern.split('/').filter(Boolean);
  const urlParts = extractPath(url).split('/').filter(Boolean);

  if (patternParts.length !== urlParts.length) {
    return false;
  }

  return patternParts.every((part, i) => {
    return part.startsWith(':') || part === urlParts[i];
  });
}
