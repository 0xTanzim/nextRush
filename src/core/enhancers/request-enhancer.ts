/**
 * Request Enhancer - NextRush-c    // Enhanced request methods
    ip(): string;
    secure(): boolean;
    protocol(): string;
    hostname(): string;
    fullUrl(): string;
    is(type: string): boolean;
    accepts(types: string | string[]): string | false;

    // Cookie methods
    parseCookies(): Record<string, string>;

    // Validation and sanitization
    validate(rules: any): any;
    sanitize(value: any, options?: any): any;
    isValidEmail(email: string): boolean;
    isValidUrl(url: string): boolean; enhancement
 */

import { IncomingMessage } from 'http';
import { ParsedUrlQuery } from 'querystring';

export interface EnhancedRequest extends IncomingMessage {
  params: Record<string, string>;
  query: ParsedUrlQuery;
  body: any;
  pathname: string;
  originalUrl: string;
  path: string;

  // Enhanced request properties to match NextRushRequest
  files: Record<string, any>;
  cookies: Record<string, string>;
  session: Record<string, any>;
  locals: Record<string, any>;
  startTime: number;

  // Fresh/stale properties
  fresh: boolean;
  stale: boolean;

  // Middleware debugging support
  middlewareStack?: string[];

  // Basic helper methods
  param(name: string): string | undefined;
  header(name: string): string | undefined;
  get(name: string): string | undefined;
  sanitizeObject(obj: any, options?: any): any;
  getRequestTiming(): any;

  // Enhanced request methods
  ip(): string;
  secure(): boolean;
  protocol(): string;
  hostname(): string;
  fullUrl(): string;
  is(type: string): boolean;
  accepts(types: string | string[]): string | false;

  // Cookie methods
  parseCookies(): Record<string, string>;

  // Validation and sanitization
  validate(rules: any): any;
  sanitize(value: any, options?: any): any;
  isValidEmail(email: string): boolean;
  isValidUrl(url: string): boolean;
  sanitizeValue(value: any, rule: any): any;

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

export class RequestEnhancer {
  static enhance(req: IncomingMessage): EnhancedRequest {
    const enhanced = req as EnhancedRequest;

    // Initialize properties
    enhanced.params = enhanced.params || {};
    enhanced.query = enhanced.query || {};
    // 🚨 FIXED: Don't initialize body - let MegaUltimateParser handle it
    // enhanced.body = enhanced.body || {}; // REMOVED - causes conflicts with body parser
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

    // 🚀 Enhanced IP detection with proxy support
    if (!enhanced.ip) {
      enhanced.ip = () => {
        const xForwardedFor = enhanced.headers['x-forwarded-for'] as string;
        const xRealIp = enhanced.headers['x-real-ip'] as string;
        const connectionRemoteAddress = (enhanced.socket as any)?.remoteAddress;

        if (xForwardedFor) {
          // X-Forwarded-For can contain multiple IPs, take the first one
          return xForwardedFor.split(',')[0].trim();
        }

        return xRealIp || connectionRemoteAddress || '127.0.0.1';
      };
    }

    // 🔒 Security helpers
    if (!enhanced.secure) {
      enhanced.secure = () => {
        const proto = enhanced.headers['x-forwarded-proto'] as string;
        const connection = enhanced.connection || enhanced.socket;
        return proto === 'https' || (connection as any)?.encrypted === true;
      };
    }

    if (!enhanced.protocol) {
      enhanced.protocol = () => (enhanced.secure() ? 'https' : 'http');
    }

    if (!enhanced.hostname) {
      enhanced.hostname = () => {
        const host = enhanced.headers.host as string;
        if (host) {
          // Remove port if present
          return host.split(':')[0];
        }
        return 'localhost';
      };
    }

    if (!enhanced.fullUrl) {
      enhanced.fullUrl = () =>
        `${enhanced.protocol()}://${enhanced.headers.host || 'localhost'}${
          enhanced.originalUrl
        }`;
    }

    // 🎯 Content type checking
    if (!enhanced.is) {
      enhanced.is = (type: string) => {
        const contentType = (enhanced.headers['content-type'] as string) || '';

        // Handle common type shortcuts
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

    // 🎯 Accept header parsing
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

    // 🍪 Cookie parsing
    if (!enhanced.parseCookies) {
      enhanced.parseCookies = () => {
        const cookies: Record<string, string> = {};
        const cookieHeader = enhanced.headers.cookie as string;

        if (cookieHeader) {
          cookieHeader.split(';').forEach((cookie) => {
            const [name, ...valueParts] = cookie.trim().split('=');
            if (name && valueParts.length > 0) {
              const value = valueParts.join('='); // Handle = in cookie values
              try {
                cookies[name] = decodeURIComponent(value);
              } catch {
                cookies[name] = value; // Fallback if decoding fails
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

    // 🛡️ Validation framework
    if (!enhanced.validate) {
      enhanced.validate = (rules: Record<string, any>) => {
        const errors: Record<string, string[]> = {};
        const sanitized: Record<string, any> = {};

        for (const [field, rule] of Object.entries(rules)) {
          const value =
            enhanced.body?.[field] ||
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

          if (value !== undefined && value !== null && value !== '') {
            // Type validation
            if (rule.type) {
              if (rule.type === 'email' && !enhanced.isValidEmail(value)) {
                fieldErrors.push(
                  rule.message || `${field} must be a valid email`
                );
              } else if (rule.type === 'url' && !enhanced.isValidUrl(value)) {
                fieldErrors.push(
                  rule.message || `${field} must be a valid URL`
                );
              } else if (rule.type === 'number' && isNaN(Number(value))) {
                fieldErrors.push(rule.message || `${field} must be a number`);
              }
            }

            // Length validation
            if (rule.minLength && value.length < rule.minLength) {
              fieldErrors.push(
                rule.message ||
                  `${field} must be at least ${rule.minLength} characters`
              );
            }
            if (rule.maxLength && value.length > rule.maxLength) {
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
            let sanitizedValue = value;
            if (rule.sanitize) {
              sanitizedValue = enhanced.sanitize(value, rule.sanitize);
            }

            sanitized[field] = sanitizedValue;
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

    // 🧼 Data sanitization
    if (!enhanced.sanitize) {
      enhanced.sanitize = (value: any, options: any = {}) => {
        if (typeof value !== 'string') return value;

        let sanitized = value;

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

    // 📧 Email validation
    if (!enhanced.isValidEmail) {
      enhanced.isValidEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      };
    }

    // 🔗 URL validation
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

    // 🔍 Request fingerprinting
    if (!enhanced.fingerprint) {
      enhanced.fingerprint = () => {
        const userAgent = enhanced.headers['user-agent'] || '';
        const accept = enhanced.headers.accept || '';
        const acceptLanguage = enhanced.headers['accept-language'] || '';
        const ip = enhanced.ip();

        const fingerprint = `${ip}-${userAgent}-${accept}-${acceptLanguage}`;
        return Buffer.from(fingerprint).toString('base64').substring(0, 16);
      };
    }

    // 🕵️ User agent parsing
    if (!enhanced.userAgent) {
      enhanced.userAgent = () => {
        const ua = (enhanced.headers['user-agent'] as string) || '';

        const isMobile = /Mobile|Android|iPhone|iPad/.test(ua);
        const isBot = /bot|crawler|spider|crawling/i.test(ua);

        let browser = 'Unknown';
        if (ua.includes('Chrome')) browser = 'Chrome';
        else if (ua.includes('Firefox')) browser = 'Firefox';
        else if (ua.includes('Safari')) browser = 'Safari';
        else if (ua.includes('Edge')) browser = 'Edge';

        let os = 'Unknown';
        if (ua.includes('Windows')) os = 'Windows';
        else if (ua.includes('Mac')) os = 'macOS';
        else if (ua.includes('Linux')) os = 'Linux';
        else if (ua.includes('Android')) os = 'Android';
        else if (ua.includes('iOS')) os = 'iOS';

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

    // ⏱️ Request timing
    if (!enhanced.timing) {
      enhanced.timing = () => ({
        start: enhanced.startTime,
        duration: Date.now() - enhanced.startTime,
        timestamp: new Date().toISOString(),
      });
    }

    // 🚦 Rate limit info (placeholder - would be populated by rate limiting middleware)
    if (!enhanced.rateLimit) {
      enhanced.rateLimit = () => ({
        limit: 100,
        remaining: 99,
        reset: Date.now() + 3600000, // 1 hour from now
        retryAfter: 0,
      });
    }

    // Helper for sanitizing objects
    if (!enhanced.sanitizeObject) {
      enhanced.sanitizeObject = (obj: any, options: any = {}) => {
        if (typeof obj !== 'object' || obj === null) return obj;

        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
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

    // Helper validation methods
    if (!enhanced.isValidEmail) {
      enhanced.isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email);
    }
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

    // User agent parsing methods
    if (!enhanced.sanitizeValue) {
      enhanced.sanitizeValue = (value: any, rule: any) =>
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
