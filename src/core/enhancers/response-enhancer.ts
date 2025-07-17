/**
 * Response Enhancer - NextRush-compatible response enhancement
 */

import { ServerResponse } from 'http';

export interface EnhancedResponse extends ServerResponse {
  locals: Record<string, any>;

  // Status
  status(code: number): EnhancedResponse;

  // Core response methods
  json(data: any): void;
  send(data: string | Buffer | object): void;
  html(data: string): void;
  text(data: string): void;
  xml(data: string): void;

  // Enhanced response methods
  csv(data: any[], filename?: string): void;
  stream(
    stream: NodeJS.ReadableStream,
    contentType?: string,
    options?: any
  ): void;

  // File operations
  sendFile(filePath: string, options?: any): void;
  download(filePath: string, filename?: string, options?: any): void;

  // Smart file operations
  getSmartContentType(filePath: string): string;
  generateETag(stats: any): string;

  // Redirect methods
  redirect(url: string, status?: number): void;
  redirectPermanent(url: string): void;
  redirectTemporary(url: string): void;

  // Header methods
  set(field: string | Record<string, string>, value?: string): EnhancedResponse;
  header(field: string, value: string): EnhancedResponse;
  removeHeader(field: string): EnhancedResponse;
  get(field: string): string | undefined;

  // Cookie methods
  cookie(name: string, value: string, options?: any): EnhancedResponse;
  clearCookie(name: string, options?: any): EnhancedResponse;

  // Template rendering
  render(template: string, data?: any): void;

  // Template helper methods
  getNestedValue(obj: any, path: string): any;
  isTruthy(value: any): boolean;

  // Cache control
  cache(seconds: number): EnhancedResponse;
  noCache(): EnhancedResponse;

  // CORS support
  cors(origin?: string): EnhancedResponse;

  // Security headers
  security(): EnhancedResponse;

  // Compression hint
  compress(): EnhancedResponse;

  // API response helpers
  success(data: any, message?: string): void;
  error(message: string, code?: number, details?: any): void;
  paginate(data: any[], page: number, limit: number, total: number): void;

  // Content type utilities
  getContentTypeFromExtension(ext: string): string;

  // Performance
  time(label?: string): EnhancedResponse;
}

export class ResponseEnhancer {
  static enhance(res: ServerResponse): EnhancedResponse {
    const enhanced = res as EnhancedResponse;

    // Initialize properties
    enhanced.locals = enhanced.locals || {};

    // Status method
    if (!enhanced.status) {
      enhanced.status = (code: number) => {
        enhanced.statusCode = code;
        return enhanced;
      };
    }

    // Core response methods
    if (!enhanced.json) {
      enhanced.json = (data: any) => {
        enhanced.setHeader('Content-Type', 'application/json');
        enhanced.end(JSON.stringify(data));
      };
    }

    if (!enhanced.send) {
      enhanced.send = (data: any) => {
        if (typeof data === 'object') {
          enhanced.json(data);
        } else {
          enhanced.end(String(data));
        }
      };
    }

    if (!enhanced.html) {
      enhanced.html = (data: string) => {
        enhanced.setHeader('Content-Type', 'text/html');
        enhanced.end(data);
      };
    }

    if (!enhanced.text) {
      enhanced.text = (data: string) => {
        enhanced.setHeader('Content-Type', 'text/plain');
        enhanced.end(data);
      };
    }

    if (!enhanced.xml) {
      enhanced.xml = (data: string) => {
        enhanced.setHeader('Content-Type', 'application/xml');
        enhanced.end(data);
      };
    }

    // Redirect method
    if (!enhanced.redirect) {
      enhanced.redirect = (url: string, status = 302) => {
        enhanced.statusCode = status;
        enhanced.setHeader('Location', url);
        enhanced.end();
      };
    }

    // Header methods
    if (!enhanced.set) {
      enhanced.set = (
        field: string | Record<string, string>,
        value?: string
      ) => {
        if (typeof field === 'object') {
          Object.entries(field).forEach(([key, val]) =>
            enhanced.setHeader(key, val)
          );
        } else if (value) {
          enhanced.setHeader(field, value);
        }
        return enhanced;
      };
    }

    if (!enhanced.header) {
      enhanced.header = (field: string, value: string) => {
        enhanced.setHeader(field, value);
        return enhanced;
      };
    }

    if (!enhanced.get) {
      enhanced.get = (field: string) => enhanced.getHeader(field) as string;
    }

    // Cookie methods
    if (!enhanced.cookie) {
      enhanced.cookie = (name: string, value: string, options: any = {}) => {
        let cookie = `${name}=${value}`;
        if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
        if (options.path) cookie += `; Path=${options.path}`;
        enhanced.setHeader('Set-Cookie', cookie);
        return enhanced;
      };
    }

    // API helpers
    if (!enhanced.success) {
      enhanced.success = (data: any, message?: string) => {
        enhanced.json({ success: true, data, message });
      };
    }

    if (!enhanced.error) {
      enhanced.error = (message: string, code = 500, details?: any) => {
        enhanced.status(code).json({ success: false, error: message, details });
      };
    }

    // Add placeholder methods for compatibility
    if (!enhanced.csv) enhanced.csv = () => {};
    if (!enhanced.stream) enhanced.stream = () => {};
    if (!enhanced.sendFile) enhanced.sendFile = () => {};
    if (!enhanced.download) enhanced.download = () => {};
    if (!enhanced.getSmartContentType)
      enhanced.getSmartContentType = () => 'text/plain';
    if (!enhanced.generateETag) enhanced.generateETag = () => '';
    if (!enhanced.redirectPermanent)
      enhanced.redirectPermanent = (url: string) => enhanced.redirect(url, 301);
    if (!enhanced.redirectTemporary)
      enhanced.redirectTemporary = (url: string) => enhanced.redirect(url, 302);
    if (!enhanced.removeHeader)
      enhanced.removeHeader = (field: string) => {
        enhanced.removeHeader(field);
        return enhanced;
      };
    if (!enhanced.clearCookie) enhanced.clearCookie = () => enhanced;
    if (!enhanced.render) enhanced.render = () => {};
    if (!enhanced.getNestedValue) enhanced.getNestedValue = () => {};
    if (!enhanced.isTruthy) enhanced.isTruthy = () => true;
    if (!enhanced.cache) enhanced.cache = () => enhanced;
    if (!enhanced.noCache) enhanced.noCache = () => enhanced;
    if (!enhanced.cors) enhanced.cors = () => enhanced;
    if (!enhanced.security) enhanced.security = () => enhanced;
    if (!enhanced.compress) enhanced.compress = () => enhanced;
    if (!enhanced.paginate) enhanced.paginate = () => {};
    if (!enhanced.time) enhanced.time = () => enhanced;

    return enhanced;
  }
}
