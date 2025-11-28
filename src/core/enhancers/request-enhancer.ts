/**
 * Request Enhancer for NextRush v2
 *
 * Enhances Node.js IncomingMessage with Express-like features.
 * Uses extracted modules for better maintainability.
 *
 * @packageDocumentation
 */

import { detectClientIP } from '@/core/utils/ip-detector';
import { extractPath } from '@/core/utils/url-parser';
import {
  parseCookies,
  PARSED_COOKIES_SYMBOL,
  type CookieParseResult,
} from '@/utils/cookies';
import type { IncomingMessage } from 'node:http';
import type { ParsedUrlQuery } from 'node:querystring';

// Import extracted modules
import {
  acceptsType,
  isContentType,
} from './request/content-negotiator';
import {
  generateFingerprint,
  getDefaultRateLimitInfo,
  getRequestTiming
} from './request/fingerprint';
import {
  isBot,
  isMobile,
  parseBrowser,
  parseDevice,
  parseOS,
  parseUserAgent
} from './request/user-agent-parser';
import {
  isValidEmail,
  isValidUrl,
  sanitize,
  sanitizeObject,
  validate,
  type SanitizeOptions,
  type ValidationRule
} from './request/validation-engine';

/**
 * Enhanced request interface with Express-like properties and methods
 */
export interface EnhancedRequest extends IncomingMessage {
  // Express-like properties
  params: Record<string, string>;
  query: ParsedUrlQuery;
  body: unknown;
  pathname: string;
  originalUrl: string;
  path: string;
  files: Record<string, unknown>;
  cookies: Record<string, string>;
  session: Record<string, unknown>;
  locals: Record<string, unknown>;
  startTime: number;
  fresh: boolean;
  stale: boolean;
  middlewareStack?: string[];

  // Basic helper methods
  param(name: string): string | undefined;
  header(name: string): string | undefined;
  get(name: string): string | undefined;
  sanitizeObject(obj: unknown, options?: unknown): unknown;
  getRequestTiming(): unknown;

  // Enhanced request properties
  ip: string;
  secure: boolean;
  protocol: string;
  hostname(): string;
  fullUrl(): string;
  is(type: string): boolean;
  accepts(types: string | string[]): string | false;

  // Cookie methods
  parseCookies(): Record<string, string>;

  // Validation and sanitization
  validate(rules: unknown): unknown;
  sanitize(value: unknown, options?: unknown): unknown;
  isValidEmail(email: string): boolean;
  isValidUrl(url: string): boolean;
  sanitizeValue(value: unknown, rule: unknown): unknown;

  // Security and analytics
  fingerprint(): string;
  userAgent(): {
    raw: string;
    browser: string;
    os: string;
    device: string;
    isMobile: boolean;
    isBot: boolean;
  };
  timing(): { start: number; duration: number; timestamp: string };
  rateLimit(): {
    limit: number;
    remaining: number;
    reset: number;
    retryAfter: number;
  };

  // User agent parsing methods
  parseBrowser(ua: string): string;
  parseOS(ua: string): string;
  parseDevice(ua: string): string;
  isBot(ua: string): boolean;
  isMobile(ua: string): boolean;
}

/**
 * Request Enhancer class for NextRush v2
 *
 * @example
 * ```typescript
 * import { RequestEnhancer } from '@/core/enhancers/request-enhancer';
 *
 * const enhancedReq = RequestEnhancer.enhance(req);
 * console.log(enhancedReq.ip()); // Client IP
 * console.log(enhancedReq.userAgent()); // User agent info
 * ```
 */
export class RequestEnhancer {
  /**
   * Enhance a Node.js IncomingMessage with NextRush v2 features
   *
   * @param req - The original HTTP request
   * @returns Enhanced request with additional properties and methods
   */
  static enhance(req: IncomingMessage): EnhancedRequest {
    const enhanced = req as EnhancedRequest;

    // Initialize properties
    enhanced.params = enhanced.params || {};
    enhanced.query = enhanced.query || {};
    enhanced.body = enhanced.body || undefined; // Initialize body property
    enhanced.pathname = extractPath(req.url || '/');
    enhanced.originalUrl = req.url || '/';
    enhanced.path = enhanced.pathname;
    enhanced.files = enhanced.files || {};
    enhanced.cookies = enhanced.cookies || {};
    enhanced.session = enhanced.session || {};
    enhanced.locals = enhanced.locals || {};
    enhanced.startTime = enhanced.startTime || Date.now();

    // Basic helper methods
    if (!enhanced.param) {
      enhanced.param = (name: string) => enhanced.params[name];
    }

    if (!enhanced.header) {
      enhanced.header = (name: string) => enhanced.headers[name] as string;
    }

    if (!enhanced.get) {
      enhanced.get = (name: string) => enhanced.header(name);
    }

    // Enhanced IP detection with proxy support (using shared utility)
    if (!enhanced.ip) {
      enhanced.ip = detectClientIP(
        enhanced.headers,
        (enhanced.socket as any)?.remoteAddress
      );
    }

    // Security helpers
    if (
      !Object.prototype.hasOwnProperty.call(enhanced, 'secure') ||
      enhanced.secure === undefined
    ) {
      const proto = enhanced.headers['x-forwarded-proto'] as string;
      const connection = enhanced.connection || enhanced.socket;
      const isSecure =
        proto === 'https' || (connection as any)?.encrypted === true;

      Object.defineProperty(enhanced, 'secure', {
        value: isSecure,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }

    if (!enhanced.protocol) {
      enhanced.protocol = enhanced.secure ? 'https' : 'http';
    }

    if (!enhanced.hostname) {
      enhanced.hostname = () => {
        const host = enhanced.headers.host as string;
        if (host) {
          // Remove port if present
          return host.split(':')[0] || 'localhost';
        }
        return 'localhost';
      };
    }

    if (!enhanced.fullUrl) {
      enhanced.fullUrl = () =>
        `${enhanced.protocol}://${enhanced.headers.host || 'localhost'}${
          enhanced.originalUrl
        }`;
    }

    // Content type checking - delegates to extracted module
    if (!enhanced.is) {
      enhanced.is = (type: string) => isContentType(enhanced.headers, type);
    }

    // Accept header parsing - delegates to extracted module
    if (!enhanced.accepts) {
      enhanced.accepts = (types: string | string[]) => acceptsType(enhanced.headers, types);
    }

    // Cookie parsing with performance optimization and caching
    if (!enhanced.parseCookies) {
      enhanced.parseCookies = () => {
        // Check if cookies are already cached
        if ((enhanced as any)[PARSED_COOKIES_SYMBOL]) {
          return (enhanced as any)[PARSED_COOKIES_SYMBOL] as CookieParseResult;
        }

        // Use optimized cookie parser
        const cookieHeader = enhanced.headers.cookie as string;
        const parsed = parseCookies(cookieHeader || '');

        // Cache the result to avoid re-parsing
        (enhanced as any)[PARSED_COOKIES_SYMBOL] = parsed;

        return parsed;
      };
    }

    // Lazy cookie property with getter
    if (!enhanced.cookies || Object.keys(enhanced.cookies).length === 0) {
      // Use lazy evaluation - only parse when first accessed
      Object.defineProperty(enhanced, 'cookies', {
        get() {
          if (!(enhanced as any)[PARSED_COOKIES_SYMBOL]) {
            (enhanced as any)[PARSED_COOKIES_SYMBOL] = enhanced.parseCookies();
          }
          return (enhanced as any)[PARSED_COOKIES_SYMBOL];
        },
        configurable: true,
        enumerable: true,
      });
    }

    // Validation framework - delegates to extracted module
    if (!enhanced.validate) {
      enhanced.validate = (rules: Record<string, ValidationRule>) => {
        // Merge body, query, and params into a single data object
        const data = {
          ...(enhanced.body as Record<string, unknown> || {}),
          ...(enhanced.query as Record<string, unknown>),
          ...enhanced.params,
        };
        return validate(data, rules);
      };
    }

    // Data sanitization - delegates to extracted module
    if (!enhanced.sanitize) {
      enhanced.sanitize = (value: unknown, options: SanitizeOptions = {}) => {
        return sanitize(value, options);
      };
    }

    // Email validation - delegates to extracted module
    if (!enhanced.isValidEmail) {
      enhanced.isValidEmail = isValidEmail;
    }

    // URL validation - delegates to extracted module
    if (!enhanced.isValidUrl) {
      enhanced.isValidUrl = isValidUrl;
    }

    // Request fingerprinting - delegates to extracted module
    if (!enhanced.fingerprint) {
      enhanced.fingerprint = () => generateFingerprint(enhanced.headers, enhanced.ip);
    }

    // User agent parsing - delegates to extracted module
    if (!enhanced.userAgent) {
      enhanced.userAgent = () => parseUserAgent(enhanced.headers['user-agent'] as string);
    }

    // Request timing - delegates to extracted module
    if (!enhanced.timing) {
      enhanced.timing = () => getRequestTiming(enhanced.startTime);
    }

    // Rate limit info - delegates to extracted module
    if (!enhanced.rateLimit) {
      enhanced.rateLimit = getDefaultRateLimitInfo;
    }

    // Helper for sanitizing objects - delegates to extracted module
    if (!enhanced.sanitizeObject) {
      enhanced.sanitizeObject = (obj: unknown, options: SanitizeOptions = {}) => {
        return sanitizeObject(obj, options);
      };
    }

    // Helper for request timing
    if (!enhanced.getRequestTiming) {
      enhanced.getRequestTiming = () => enhanced.timing();
    }

    // User agent parsing methods - delegate to extracted module
    if (!enhanced.sanitizeValue) {
      enhanced.sanitizeValue = (value: unknown, rule: any) =>
        sanitize(value, rule?.sanitize);
    }

    if (!enhanced.parseBrowser) {
      enhanced.parseBrowser = parseBrowser;
    }

    if (!enhanced.parseOS) {
      enhanced.parseOS = parseOS;
    }

    if (!enhanced.parseDevice) {
      enhanced.parseDevice = parseDevice;
    }

    if (!enhanced.isBot) {
      enhanced.isBot = isBot;
    }

    if (!enhanced.isMobile) {
      enhanced.isMobile = isMobile;
    }

    return enhanced;
  }
}
