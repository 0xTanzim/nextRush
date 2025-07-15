/**
 * Express-style request and response interfaces
 * Making NextRush familiar and easy to use
 */
import { IncomingMessage, ServerResponse } from 'http';
import { ParsedUrlQuery } from 'querystring';

// 🚀 NEW: Enhanced request type definitions
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

// Express-style Request interface - Enhanced with comprehensive request handling
export interface NextRushRequest extends IncomingMessage {
  params: Record<string, string>;
  query: ParsedUrlQuery;
  body: any;
  pathname: string;
  originalUrl: string;
  path: string;

  // 🚀 NEW: Enhanced request properties
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

  // 🚀 NEW: Enhanced request methods
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
  validate(rules: Record<string, ValidationRule>): ValidationResult;
  sanitize(value: any, options?: SanitizeOptions): any;
  
  // Utility methods
  rateLimit(): RateLimitInfo;
  fingerprint(): string;
  userAgent(): UserAgentInfo;
  timing(): RequestTiming;
  
  // Helper validation methods
  isValidEmail(email: string): boolean;
  isValidUrl(url: string): boolean;
  sanitizeValue(value: any, rule: ValidationRule): any;
  
  // User agent parsing
  parseBrowser(ua: string): string;
  parseOS(ua: string): string;
  parseDevice(ua: string): string;
  isBot(ua: string): boolean;
  isMobile(ua: string): boolean;
}

// Express-style Response interface - Enhanced with comprehensive API
export interface NextRushResponse extends ServerResponse {
  locals: Record<string, any>;

  // Status
  status(code: number): NextRushResponse;

  // Core response methods
  json(data: any): void;
  send(data: string | Buffer | object): void;
  html(data: string): void;
  text(data: string): void;
  xml(data: string): void;

  // 🚀 NEW: Enhanced response methods
  csv(data: any[], filename?: string): void;
  stream(stream: NodeJS.ReadableStream, contentType?: string): void;
  
  // File operations
  sendFile(filePath: string, options?: {
    maxAge?: number;
    lastModified?: boolean;
    etag?: boolean;
    dotfiles?: 'allow' | 'deny' | 'ignore';
    root?: string;
  }): void;
  download(filePath: string, filename?: string, options?: any): void;

  // Redirect methods
  redirect(url: string, status?: number): void;
  redirectPermanent(url: string): void;
  redirectTemporary(url: string): void;

  // Header methods
  set(field: string, value: string): NextRushResponse;
  set(fields: Record<string, string>): NextRushResponse;
  header(field: string, value: string): NextRushResponse;
  removeHeader(field: string): NextRushResponse;
  get(field: string): string | undefined;

  // Cookie methods
  cookie(name: string, value: string, options?: {
    maxAge?: number;
    expires?: Date;
    path?: string;
    domain?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    signed?: boolean;
  }): NextRushResponse;
  clearCookie(name: string, options?: any): NextRushResponse;

  // Template rendering
  render(template: string, data?: any): void;

  // Cache control
  cache(seconds: number): NextRushResponse;
  noCache(): NextRushResponse;

  // CORS support
  cors(origin?: string): NextRushResponse;

  // Security headers
  security(): NextRushResponse;

  // Compression hint
  compress(): NextRushResponse;

  // API response helpers
  success(data: any, message?: string): void;
  error(message: string, code?: number, details?: any): void;
  paginate(data: any[], page: number, limit: number, total: number): void;

  // Performance
  time(label?: string): NextRushResponse;
}

// Express-style handler types with better inference
export type ExpressHandler = (
  req: NextRushRequest,
  res: NextRushResponse
) => void | Promise<void>;

export type ExpressMiddleware = (
  req: NextRushRequest,
  res: NextRushResponse,
  next: () => void
) => void | Promise<void>;

// Simplified aliases for better DX - no more manual typing needed!
export type RouteHandlerFn = ExpressHandler;
export type MiddlewareFn = ExpressMiddleware;

// Next function type
export type NextFunction = (error?: any) => void;
