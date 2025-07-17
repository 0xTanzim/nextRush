/**
 * Request Enhancer - NextRush-compatible request enhancement
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

  // Middleware debugging support
  middlewareStack?: string[];

  // Basic helper methods
  param(name: string): string | undefined;
  header(name: string): string | undefined;
  get(name: string): string | undefined;

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

  // Utility methods
  rateLimit(): any;
  fingerprint(): string;
  userAgent(): any;
  timing(): any;
}

export class RequestEnhancer {
  static enhance(req: IncomingMessage): EnhancedRequest {
    const enhanced = req as EnhancedRequest;

    // Initialize properties
    enhanced.params = enhanced.params || {};
    enhanced.query = enhanced.query || {};
    enhanced.body = enhanced.body || {};
    enhanced.pathname = req.url?.split('?')[0] || '/';
    enhanced.originalUrl = req.url || '/';
    enhanced.path = enhanced.pathname;
    enhanced.files = enhanced.files || {};
    enhanced.cookies = enhanced.cookies || {};
    enhanced.session = enhanced.session || {};
    enhanced.locals = enhanced.locals || {};
    enhanced.startTime = enhanced.startTime || Date.now();

    // Add helper methods
    if (!enhanced.param) {
      enhanced.param = (name: string) => enhanced.params[name];
    }
    if (!enhanced.header) {
      enhanced.header = (name: string) => enhanced.headers[name] as string;
    }
    if (!enhanced.get) {
      enhanced.get = (name: string) => enhanced.header(name);
    }

    if (!enhanced.ip) {
      enhanced.ip = () =>
        (enhanced.headers['x-forwarded-for'] as string) || '127.0.0.1';
    }
    if (!enhanced.secure) {
      enhanced.secure = () => enhanced.headers['x-forwarded-proto'] === 'https';
    }
    if (!enhanced.protocol) {
      enhanced.protocol = () => (enhanced.secure() ? 'https' : 'http');
    }
    if (!enhanced.hostname) {
      enhanced.hostname = () => enhanced.headers.host || 'localhost';
    }
    if (!enhanced.fullUrl) {
      enhanced.fullUrl = () =>
        `${enhanced.protocol()}://${enhanced.hostname()}${
          enhanced.originalUrl
        }`;
    }
    if (!enhanced.is) {
      enhanced.is = (type: string) => false;
    }
    if (!enhanced.accepts) {
      enhanced.accepts = (types: any) => false;
    }

    if (!enhanced.parseCookies) {
      enhanced.parseCookies = () => enhanced.cookies;
    }
    if (!enhanced.validate) {
      enhanced.validate = (rules: any) => ({
        isValid: true,
        errors: [],
        sanitized: {},
      });
    }
    if (!enhanced.sanitize) {
      enhanced.sanitize = (value: any) => value;
    }
    if (!enhanced.rateLimit) {
      enhanced.rateLimit = () => ({
        limit: 100,
        remaining: 99,
        reset: 0,
        retryAfter: 0,
      });
    }
    if (!enhanced.fingerprint) {
      enhanced.fingerprint = () => 'default';
    }
    if (!enhanced.userAgent) {
      enhanced.userAgent = () => ({
        raw: '',
        browser: '',
        os: '',
        device: '',
        isBot: false,
        isMobile: false,
      });
    }
    if (!enhanced.timing) {
      enhanced.timing = () => ({
        start: enhanced.startTime,
        duration: 0,
        timestamp: new Date().toISOString(),
      });
    }

    return enhanced;
  }
}
