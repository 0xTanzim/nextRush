/**
 * Request enhancer - converts Node.js IncomingMessage to Express-style request
 * Enhanced with comprehensive request handling capabilities
 */
import { IncomingMessage } from 'http';
import { parse as parseUrl } from 'url';
import * as crypto from 'crypto';
import { NextRushRequest } from '../../types/express';

export class RequestEnhancer {
  static enhance(req: IncomingMessage): NextRushRequest {
    const enhanced = req as NextRushRequest;

    // Parse URL
    const parsed = parseUrl(enhanced.url || '', true);
    enhanced.query = parsed.query;
    enhanced.pathname = parsed.pathname || '/';
    enhanced.path = enhanced.pathname;
    enhanced.originalUrl = enhanced.url || '';

    // Initialize params and body
    enhanced.params = {};
    enhanced.body = null;

    // 🚀 NEW: Initialize enhanced properties
    enhanced.files = {};
    enhanced.cookies = {};
    enhanced.session = {};
    enhanced.locals = {};

    // Basic helper methods
    enhanced.param = function (name: string): string | undefined {
      return this.params[name];
    };

    enhanced.header = enhanced.get = function (
      name: string
    ): string | undefined {
      const key = name.toLowerCase();
      const headers = this.headers;
      return headers[key] as string | undefined;
    };

    // 🚀 NEW: Enhanced request methods

    // Get request IP address with proxy support
    enhanced.ip = function (): string {
      return (
        this.header('x-forwarded-for')?.split(',')[0] ||
        this.header('x-real-ip') ||
        this.connection.remoteAddress ||
        this.socket.remoteAddress ||
        '127.0.0.1'
      );
    };

    // Check if request is secure (HTTPS)
    enhanced.secure = function (): boolean {
      return (
        (this.connection as any).encrypted ||
        this.header('x-forwarded-proto') === 'https'
      );
    };

    // Get protocol (http/https)
    enhanced.protocol = function (): string {
      return this.secure() ? 'https' : 'http';
    };

    // Get hostname
    enhanced.hostname = function (): string {
      return this.header('host')?.split(':')[0] || 'localhost';
    };

    // Get full URL
    enhanced.fullUrl = function (): string {
      return `${this.protocol()}://${this.header('host')}${this.originalUrl}`;
    };

    // Check request type
    enhanced.is = function (type: string): boolean {
      const contentType = this.header('content-type') || '';
      const typeMap: Record<string, string[]> = {
        json: ['application/json'],
        xml: ['application/xml', 'text/xml'],
        html: ['text/html'],
        text: ['text/plain'],
        form: ['application/x-www-form-urlencoded'],
        multipart: ['multipart/form-data']
      };

      const types = typeMap[type.toLowerCase()] || [type.toLowerCase()];
      return types.some(t => contentType.toLowerCase().includes(t));
    };

    // Check if request accepts certain content types
    enhanced.accepts = function (types: string | string[]): string | false {
      const acceptHeader = this.header('accept') || '*/*';
      const typeArray = Array.isArray(types) ? types : [types];
      
      for (const type of typeArray) {
        if (acceptHeader.includes(type) || acceptHeader.includes('*/*')) {
          return type;
        }
      }
      return false;
    };

    // 🚀 NEW: Cookie parsing
    enhanced.parseCookies = function (): Record<string, string> {
      const cookieHeader = this.header('cookie');
      if (!cookieHeader) return {};

      const cookies: Record<string, string> = {};
      cookieHeader.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          cookies[name] = decodeURIComponent(value);
        }
      });

      return cookies;
    };

    // Parse cookies automatically
    enhanced.cookies = enhanced.parseCookies();

    // 🚀 NEW: Input validation helpers
    enhanced.validate = function (rules: Record<string, ValidationRule>): ValidationResult {
      const errors: Record<string, string[]> = {};
      const sanitized: Record<string, any> = {};

      for (const [field, rule] of Object.entries(rules)) {
        const value = this.body?.[field] || this.query[field];
        const fieldErrors: string[] = [];

        // Required validation
        if (rule.required && (value === undefined || value === null || value === '')) {
          fieldErrors.push(`${field} is required`);
        }

        if (value !== undefined && value !== null && value !== '') {
          // Type validation
          if (rule.type) {
            if (rule.type === 'email' && !this.isValidEmail(value)) {
              fieldErrors.push(`${field} must be a valid email`);
            }
            if (rule.type === 'number' && isNaN(Number(value))) {
              fieldErrors.push(`${field} must be a number`);
            }
            if (rule.type === 'url' && !this.isValidUrl(value)) {
              fieldErrors.push(`${field} must be a valid URL`);
            }
          }

          // Length validation
          if (rule.minLength && value.length < rule.minLength) {
            fieldErrors.push(`${field} must be at least ${rule.minLength} characters`);
          }
          if (rule.maxLength && value.length > rule.maxLength) {
            fieldErrors.push(`${field} must not exceed ${rule.maxLength} characters`);
          }

          // Custom validation
          if (rule.custom && !rule.custom(value)) {
            fieldErrors.push(rule.message || `${field} is invalid`);
          }

          // Sanitize value
          sanitized[field] = this.sanitizeValue(value, rule);
        }

        if (fieldErrors.length > 0) {
          errors[field] = fieldErrors;
        }
      }

      return {
        isValid: Object.keys(errors).length === 0,
        errors,
        sanitized
      };
    };

    // 🚀 NEW: Input sanitization
    enhanced.sanitize = function (value: any, options: SanitizeOptions = {}): any {
      if (typeof value !== 'string') return value;

      let sanitized = value;

      if (options.trim !== false) {
        sanitized = sanitized.trim();
      }

      if (options.escape) {
        sanitized = sanitized
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;');
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

      if (options.removeSpecialChars) {
        sanitized = sanitized.replace(/[^a-zA-Z0-9\s]/g, '');
      }

      return sanitized;
    };

    // 🚀 NEW: Rate limiting info
    enhanced.rateLimit = function (): RateLimitInfo {
      return {
        limit: parseInt(this.header('x-ratelimit-limit') || '0'),
        remaining: parseInt(this.header('x-ratelimit-remaining') || '0'),
        reset: parseInt(this.header('x-ratelimit-reset') || '0'),
        retryAfter: parseInt(this.header('retry-after') || '0')
      };
    };

    // 🚀 NEW: Request fingerprinting
    enhanced.fingerprint = function (): string {
      const data = [
        this.ip(),
        this.header('user-agent') || '',
        this.header('accept-language') || '',
        this.header('accept-encoding') || ''
      ].join('|');

      return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
    };

    // 🚀 NEW: User agent parsing
    enhanced.userAgent = function (): UserAgentInfo {
      const ua = this.header('user-agent') || '';
      
      return {
        raw: ua,
        browser: this.parseBrowser(ua),
        os: this.parseOS(ua),
        device: this.parseDevice(ua),
        isBot: this.isBot(ua),
        isMobile: this.isMobile(ua)
      };
    };

    // 🚀 NEW: Request timing
    enhanced.startTime = Date.now();
    enhanced.timing = function (): RequestTiming {
      return {
        start: this.startTime,
        duration: Date.now() - this.startTime,
        timestamp: new Date().toISOString()
      };
    };

    // Helper methods for validation
    enhanced.isValidEmail = function (email: string): boolean {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    enhanced.isValidUrl = function (url: string): boolean {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };

    enhanced.sanitizeValue = function (value: any, rule: ValidationRule): any {
      if (rule.sanitize) {
        return this.sanitize(value, rule.sanitize);
      }
      return value;
    };

    // User agent parsing helpers
    enhanced.parseBrowser = function (ua: string): string {
      if (ua.includes('Chrome')) return 'Chrome';
      if (ua.includes('Firefox')) return 'Firefox';
      if (ua.includes('Safari')) return 'Safari';
      if (ua.includes('Edge')) return 'Edge';
      return 'Unknown';
    };

    enhanced.parseOS = function (ua: string): string {
      if (ua.includes('Windows')) return 'Windows';
      if (ua.includes('Mac OS')) return 'macOS';
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
      return botPatterns.some(pattern => ua.toLowerCase().includes(pattern));
    };

    enhanced.isMobile = function (ua: string): boolean {
      return /Mobile|Android|iPhone|iPad/.test(ua);
    };

    return enhanced;
  }
}

// 🚀 NEW: Type definitions for enhanced request features
export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'email' | 'url' | 'boolean';
  minLength?: number;
  maxLength?: number;
  custom?: (value: any) => boolean;
  message?: string;
  sanitize?: SanitizeOptions;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
  sanitized: Record<string, any>;
}

export interface SanitizeOptions {
  trim?: boolean;
  escape?: boolean;
  lowercase?: boolean;
  uppercase?: boolean;
  removeHtml?: boolean;
  removeSpecialChars?: boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter: number;
}

export interface UserAgentInfo {
  raw: string;
  browser: string;
  os: string;
  device: string;
  isBot: boolean;
  isMobile: boolean;
}

export interface RequestTiming {
  start: number;
  duration: number;
  timestamp: string;
}
