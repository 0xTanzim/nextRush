/**
 * Request Enhancer for NextRush v2
 *
 * @packageDocumentation
 */

import type { IncomingMessage } from 'node:http';
import type { ParsedUrlQuery } from 'node:querystring';
import { URL } from 'node:url';

/**
 * Validation rule interface
 */
interface ValidationRule {
  required?: boolean;
  type?: 'email' | 'url' | 'number';
  minLength?: number;
  maxLength?: number;
  message?: string;
  custom?: (value: unknown) => boolean;
  sanitize?: Record<string, unknown>;
}

/**
 * Sanitize options interface
 */
interface SanitizeOptions {
  trim?: boolean;
  lowercase?: boolean;
  uppercase?: boolean;
  removeHtml?: boolean;
  escape?: boolean;
  removeSpecialChars?: boolean;
}

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
    enhanced.pathname = req.url?.split('?')[0] || '/';
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

    // Enhanced IP detection with proxy support
    if (!enhanced.ip) {
      const xForwardedFor = enhanced.headers['x-forwarded-for'] as string;
      const xRealIp = enhanced.headers['x-real-ip'] as string;
      const connectionRemoteAddress = (enhanced.socket as any)?.remoteAddress;

      if (xForwardedFor) {
        // X-Forwarded-For can contain multiple IPs, take the first one
        enhanced.ip = xForwardedFor.split(',')[0]?.trim() || '127.0.0.1';
      } else if (xRealIp) {
        enhanced.ip = xRealIp;
      } else {
        enhanced.ip = connectionRemoteAddress || '127.0.0.1';
      }
    }

    // Security helpers
    if (!Object.prototype.hasOwnProperty.call(enhanced, 'secure') || enhanced.secure === undefined) {
      const proto = enhanced.headers['x-forwarded-proto'] as string;
      const connection = enhanced.connection || enhanced.socket;
      const isSecure = proto === 'https' || (connection as any)?.encrypted === true;
      
      Object.defineProperty(enhanced, 'secure', {
        value: isSecure,
        writable: true,
        enumerable: true,
        configurable: true
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

    // Content type checking
    if (!enhanced.is) {
      enhanced.is = (type: string) => {
        const contentType = (enhanced.headers['content-type'] as string) || '';

        const typeMap: Record<string, string> = {
          json: 'application/json',
          html: 'text/html',
          xml: 'application/xml',
          text: 'text/plain',
          form: 'application/x-www-form-urlencoded',
          multipart: 'multipart/form-data',
        };

        const checkType = typeMap[type] || type;
        return contentType.toLowerCase().includes(checkType.toLowerCase());
      };
    }

    // Accept header parsing
    if (!enhanced.accepts) {
      enhanced.accepts = (types: string | string[]) => {
        const acceptHeader = (enhanced.headers.accept as string) || '*/*';
        const typeArray = Array.isArray(types) ? types : [types];

        for (const type of typeArray) {
          const typeMap: Record<string, string> = {
            json: 'application/json',
            html: 'text/html',
            xml: 'application/xml',
            text: 'text/plain',
          };

          const checkType = typeMap[type] || type;
          if (
            acceptHeader.includes(checkType) ||
            acceptHeader.includes('*/*')
          ) {
            return type;
          }
        }

        return false;
      };
    }

    // Cookie parsing
    if (!enhanced.parseCookies) {
      enhanced.parseCookies = () => {
        const cookies: Record<string, string> = {};
        const cookieHeader = enhanced.headers.cookie as string;

        if (cookieHeader) {
          cookieHeader.split(';').forEach(cookie => {
            const [name, ...valueParts] = cookie.trim().split('=');
            if (name && valueParts.length > 0) {
              const value = valueParts.join('=');
              try {
                cookies[name] = decodeURIComponent(value);
              } catch {
                cookies[name] = value;
              }
            }
          });
        }

        return cookies;
      };
    }

    // Auto-parse cookies
    if (!enhanced.cookies || Object.keys(enhanced.cookies).length === 0) {
      enhanced.cookies = enhanced.parseCookies();
    }

    // Validation framework
    if (!enhanced.validate) {
      enhanced.validate = (rules: Record<string, ValidationRule>) => {
        const errors: Record<string, string[]> = {};
        const sanitized: Record<string, unknown> = {};

        for (const [field, rule] of Object.entries(rules)) {
          const value =
            (enhanced.body as Record<string, unknown>)?.[field] ||
            enhanced.query[field] ||
            enhanced.params[field];
          const fieldErrors: string[] = [];

          // Required validation
          if (
            rule.required &&
            (value === undefined || value === null || value === '')
          ) {
            fieldErrors.push(rule.message || `${field} is required`);
            continue;
          }

          // Only process validation if value exists and is not empty
          if (value !== undefined && value !== null && value !== '') {
            // Type validation
            if (rule.type) {
              if (
                rule.type === 'email' &&
                !enhanced.isValidEmail(String(value))
              ) {
                fieldErrors.push(
                  rule.message || `${field} must be a valid email`
                );
              } else if (
                rule.type === 'url' &&
                !enhanced.isValidUrl(String(value))
              ) {
                fieldErrors.push(
                  rule.message || `${field} must be a valid URL`
                );
              } else if (rule.type === 'number' && isNaN(Number(value))) {
                fieldErrors.push(rule.message || `${field} must be a number`);
              }
            }

            // Length validation
            if (rule.minLength && String(value).length < rule.minLength) {
              fieldErrors.push(
                rule.message ||
                  `${field} must be at least ${rule.minLength} characters`
              );
            }
            if (rule.maxLength && String(value).length > rule.maxLength) {
              fieldErrors.push(
                rule.message ||
                  `${field} must be no more than ${rule.maxLength} characters`
              );
            }

            // Custom validation
            if (
              rule.custom &&
              typeof rule.custom === 'function' &&
              !rule.custom(value)
            ) {
              fieldErrors.push(
                rule.message || `${field} failed custom validation`
              );
            }

            // Sanitize value
            let sanitizedValue: unknown = value;
            if (rule.sanitize) {
              sanitizedValue = enhanced.sanitize(
                value,
                rule.sanitize as SanitizeOptions
              );
            }

            (sanitized as Record<string, unknown>)[field] = sanitizedValue;
          }

          if (fieldErrors.length > 0) {
            errors[field] = fieldErrors;
          }
        }

        return {
          isValid: Object.keys(errors).length === 0,
          errors,
          sanitized,
        };
      };
    }

    // Data sanitization
    if (!enhanced.sanitize) {
      enhanced.sanitize = (value: unknown, options: SanitizeOptions = {}) => {
        if (typeof value !== 'string') return value;

        let sanitized = value as string;

        if (options.trim) {
          sanitized = sanitized.trim();
        }

        if (options.lowercase) {
          sanitized = sanitized.toLowerCase();
        }

        if (options.uppercase) {
          sanitized = sanitized.toUpperCase();
        }

        if (options.removeHtml) {
          sanitized = sanitized.replace(/<[^>]*>/g, '');
        }

        if (options.escape) {
          sanitized = sanitized
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
        }

        if (options.removeSpecialChars) {
          sanitized = sanitized.replace(/[^a-zA-Z0-9\s]/g, '');
        }

        return sanitized;
      };
    }

    // Email validation
    if (!enhanced.isValidEmail) {
      enhanced.isValidEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      };
    }

    // URL validation
    if (!enhanced.isValidUrl) {
      enhanced.isValidUrl = (url: string) => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      };
    }

    // Request fingerprinting
    if (!enhanced.fingerprint) {
      enhanced.fingerprint = () => {
        const userAgent = enhanced.headers['user-agent'] || '';
        const accept = enhanced.headers.accept || '';
        const acceptLanguage = enhanced.headers['accept-language'] || '';
        const ip = enhanced.ip;

        const fingerprint = `${ip}-${userAgent}-${accept}-${acceptLanguage}`;
        return Buffer.from(fingerprint).toString('base64').substring(0, 16);
      };
    }

    // User agent parsing
    if (!enhanced.userAgent) {
      enhanced.userAgent = () => {
        const ua = (enhanced.headers['user-agent'] as string) || '';

        const isMobile = /Mobile|Android|iPhone|iPad|iPhone OS/.test(ua);
        const isBot = /bot|crawler|spider|crawling/i.test(ua);

        let browser = 'Unknown';
        if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
        else if (ua.includes('Firefox')) browser = 'Firefox';
        else if (ua.includes('Safari') && !ua.includes('Chrome'))
          browser = 'Safari';
        else if (ua.includes('Edge')) browser = 'Edge';
        else if (ua.includes('AppleWebKit')) browser = 'Chrome'; // Fallback for Chrome

        let os = 'Unknown';
        if (ua.includes('Windows')) os = 'Windows';
        else if (ua.includes('Mac')) os = 'macOS';
        else if (ua.includes('Linux')) os = 'Linux';
        else if (ua.includes('Android')) os = 'Android';
        else if (ua.includes('iOS') || ua.includes('iPhone OS')) os = 'iOS';

        let device = 'Desktop';
        if (isMobile) device = 'Mobile';
        if (ua.includes('Tablet') || ua.includes('iPad')) device = 'Tablet';

        return {
          raw: ua,
          browser,
          os,
          device,
          isMobile,
          isBot,
        };
      };
    }

    // Request timing
    if (!enhanced.timing) {
      enhanced.timing = () => ({
        start: enhanced.startTime,
        duration: Date.now() - enhanced.startTime,
        timestamp: new Date().toISOString(),
      });
    }

    // Rate limit info (placeholder)
    if (!enhanced.rateLimit) {
      enhanced.rateLimit = () => ({
        limit: 100,
        remaining: 99,
        reset: Date.now() + 3600000,
        retryAfter: 0,
      });
    }

    // Helper for sanitizing objects
    if (!enhanced.sanitizeObject) {
      enhanced.sanitizeObject = (obj: unknown, options: any = {}) => {
        if (typeof obj !== 'object' || obj === null) return obj;

        const sanitized: any = {};
        for (const [key, value] of Object.entries(
          obj as Record<string, unknown>
        )) {
          if (typeof value === 'string') {
            sanitized[key] = enhanced.sanitize(value, options);
          } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = enhanced.sanitizeObject(value, options);
          } else {
            sanitized[key] = value;
          }
        }
        return sanitized;
      };
    }

    // Helper for request timing
    if (!enhanced.getRequestTiming) {
      enhanced.getRequestTiming = () => enhanced.timing();
    }

    // User agent parsing methods
    if (!enhanced.sanitizeValue) {
      enhanced.sanitizeValue = (value: unknown, rule: any) =>
        enhanced.sanitize(value, rule?.sanitize);
    }

    if (!enhanced.parseBrowser) {
      enhanced.parseBrowser = (ua: string) => {
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Safari')) return 'Safari';
        if (ua.includes('Edge')) return 'Edge';
        return 'Unknown';
      };
    }

    if (!enhanced.parseOS) {
      enhanced.parseOS = (ua: string) => {
        if (ua.includes('Windows')) return 'Windows';
        if (ua.includes('Mac')) return 'macOS';
        if (ua.includes('Linux')) return 'Linux';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('iOS')) return 'iOS';
        return 'Unknown';
      };
    }

    if (!enhanced.parseDevice) {
      enhanced.parseDevice = (ua: string) => {
        if (ua.includes('Mobile')) return 'Mobile';
        if (ua.includes('Tablet')) return 'Tablet';
        return 'Desktop';
      };
    }

    if (!enhanced.isBot) {
      enhanced.isBot = (ua: string) => /bot|crawler|spider|crawling/i.test(ua);
    }

    if (!enhanced.isMobile) {
      enhanced.isMobile = (ua: string) => /Mobile|Android|iPhone|iPad/.test(ua);
    }

    return enhanced;
  }
}
