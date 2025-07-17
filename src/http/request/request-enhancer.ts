/**
 * Request enhancer - converts Node.js IncomingMessage to Express-style request
 * Enhanced with comprehensive request handling capabilities
 */

import { IncomingMessage } from 'http';
import { parse as parseUrl } from 'url';
import { NextRushRequest } from '../../types/express';

export class RequestEnhancer {
  static enhance(req: IncomingMessage): NextRushRequest {
    const enhanced = req as NextRushRequest;

    // Parse URL
    const parsed = parseUrl(enhanced.url || '', true);
    enhanced.query = parsed.query;
    enhanced.pathname = parsed.pathname || '/';
    enhanced.path = enhanced.pathname;
    enhanced.originalUrl = enhanced.url || '/';

    // Initialize empty params if not set
    if (!enhanced.params) {
      enhanced.params = {};
    }

    // Add utility methods
    enhanced.param = function (name: string): string | undefined {
      return this.params?.[name];
    };

    enhanced.header = function (name: string): string | undefined {
      return this.headers[name.toLowerCase()] as string;
    };

    enhanced.get = enhanced.header; // Alias

    enhanced.ip = function (): string {
      return (
        (this.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        this.connection?.remoteAddress ||
        this.socket?.remoteAddress ||
        'unknown'
      );
    };

    enhanced.secure = function (): boolean {
      return (
        this.headers['x-forwarded-proto'] === 'https' ||
        (this.connection as any)?.encrypted === true
      );
    };

    enhanced.protocol = function (): string {
      return this.secure() ? 'https' : 'http';
    };

    enhanced.hostname = function (): string {
      return (this.headers.host as string)?.split(':')[0] || 'localhost';
    };

    enhanced.fullUrl = function (): string {
      return `${this.protocol()}://${this.headers.host}${this.originalUrl}`;
    };

    // 🚀 NEW: Advanced features
    enhanced.is = function (type: string): boolean {
      const contentType = this.headers['content-type'] as string;
      if (!contentType) return false;

      const types: Record<string, string[]> = {
        json: ['application/json'],
        form: ['application/x-www-form-urlencoded'],
        text: ['text/plain'],
        html: ['text/html'],
        xml: ['application/xml', 'text/xml'],
        multipart: ['multipart/form-data'],
      };

      const matchTypes = types[type] || [type];
      return matchTypes.some((t) => contentType.includes(t));
    };

    enhanced.accepts = function (types: string | string[]): string | false {
      const accept = this.headers.accept as string;
      if (!accept) return false;

      const typeArray = Array.isArray(types) ? types : [types];
      for (const type of typeArray) {
        if (accept.includes(type)) {
          return type;
        }
      }
      return false;
    };

    // Add fresh/stale as properties using getters
    Object.defineProperty(enhanced, 'fresh', {
      get: function () {
        const method = this.method;
        const status = (this as any).res?.statusCode;

        // GET or HEAD for success responses
        if (method !== 'GET' && method !== 'HEAD') return false;
        if ((status >= 200 && status < 300) || status === 304) {
          return (
            this.headers['if-none-match'] === (this as any).res?.getHeader('etag')
          );
        }
        return false;
      },
      configurable: true
    });

    Object.defineProperty(enhanced, 'stale', {
      get: function () {
        return !this.fresh;
      },
      configurable: true
    });

    // 🚀 NEW: Validation methods
    enhanced.validate = function (rules: Record<string, any>): {
      isValid: boolean;
      errors: Record<string, string[]>;
      sanitized: Record<string, any>;
    } {
      const errors: Record<string, string[]> = {};
      const sanitized: Record<string, any> = {};

      for (const [field, rule] of Object.entries(rules)) {
        const value = this.body?.[field];
        const fieldErrors: string[] = [];

        if (
          rule.required &&
          (value === undefined || value === null || value === '')
        ) {
          fieldErrors.push(`${field} is required`);
        }

        if (value && rule.type) {
          switch (rule.type) {
            case 'email':
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                fieldErrors.push(`${field} must be a valid email`);
              }
              break;
            case 'number':
              if (isNaN(Number(value))) {
                fieldErrors.push(`${field} must be a number`);
              }
              break;
            case 'string':
              if (typeof value !== 'string') {
                fieldErrors.push(`${field} must be a string`);
              }
              break;
          }
        }

        if (value && rule.minLength && value.length < rule.minLength) {
          fieldErrors.push(`${field} must be at least ${rule.minLength} characters`);
        }

        if (value && rule.maxLength && value.length > rule.maxLength) {
          fieldErrors.push(`${field} must be at most ${rule.maxLength} characters`);
        }

        if (fieldErrors.length > 0) {
          errors[field] = fieldErrors;
        }

        // Add to sanitized data
        if (value !== undefined) {
          sanitized[field] = value;
        }
      }

      return { 
        isValid: Object.keys(errors).length === 0, 
        errors,
        sanitized
      };
    };

    // 🚀 NEW: Sanitization methods
    enhanced.sanitize = function (options: any = {}): void {
      if (this.body && typeof this.body === 'object') {
        this.body = this.sanitizeObject(this.body, options);
      }
    };

    enhanced.sanitizeObject = function (obj: any, options: any = {}): any {
      if (!obj || typeof obj !== 'object') return obj;
      
      const sanitized: any = Array.isArray(obj) ? [] : {};
      
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          // Basic sanitization
          sanitized[key] = value
            .replace(/[<>]/g, '') // Remove potential HTML
            .trim(); // Trim whitespace
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeObject(value, options);
        } else {
          sanitized[key] = value;
        }
      }
      
      return sanitized;
    };

    // 🚀 NEW: Rate limiting info
    enhanced.rateLimit = function (): any {
      return {
        limit: parseInt(this.headers['x-ratelimit-limit'] as string) || 0,
        remaining:
          parseInt(this.headers['x-ratelimit-remaining'] as string) || 0,
        reset: parseInt(this.headers['x-ratelimit-reset'] as string) || 0,
      };
    };

    // 🚀 NEW: User agent parsing
    enhanced.userAgent = function (): any {
      const ua = (this.headers['user-agent'] as string) || '';

      return {
        raw: ua,
        browser: this.parseBrowser(ua),
        os: this.parseOS(ua),
        device: this.parseDevice(ua),
        isBot: this.isBot(ua),
        isMobile: this.isMobile(ua),
      };
    };

    enhanced.parseBrowser = function (ua: string): string {
      if (ua.includes('Chrome')) return 'Chrome';
      if (ua.includes('Firefox')) return 'Firefox';
      if (ua.includes('Safari')) return 'Safari';
      if (ua.includes('Edge')) return 'Edge';
      return 'Unknown';
    };

    enhanced.parseOS = function (ua: string): string {
      if (ua.includes('Windows')) return 'Windows';
      if (ua.includes('Mac')) return 'macOS';
      if (ua.includes('Linux')) return 'Linux';
      if (ua.includes('Android')) return 'Android';
      if (ua.includes('iOS')) return 'iOS';
      return 'Unknown';
    };

    enhanced.parseDevice = function (ua: string): string {
      if (ua.includes('Mobile')) return 'Mobile';
      if (ua.includes('Tablet')) return 'Tablet';
      return 'Desktop';
    };

    enhanced.isBot = function (ua: string): boolean {
      const botPatterns = ['bot', 'crawler', 'spider', 'scraper'];
      return botPatterns.some((pattern) => ua.toLowerCase().includes(pattern));
    };

    enhanced.isMobile = function (ua: string): boolean {
      return /Mobile|Android|iPhone|iPad/.test(ua);
    };

    // 🚀 NEW: Request timing
    enhanced.getRequestTiming = function (): any {
      return {
        startTime: (this as any)._startTime || Date.now(),
        duration: Date.now() - ((this as any)._startTime || Date.now())
      };
    };

    // Set start time
    (enhanced as any)._startTime = Date.now();

    return enhanced;
  }
}
