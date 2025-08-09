/**
 * Response Enhancer for NextRush v2
 *
 * @packageDocumentation
 */

import { createHash } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { extname } from 'node:path';
import { type CookieOptions, serializeCookie } from '../../utils/cookies.js';

/**
 * File options interface
 */
interface FileOptions {
  etag?: boolean;
  root?: string;
}

/**
 * Enhanced response interface with Express-like methods
 */
export interface EnhancedResponse extends ServerResponse {
  locals: Record<string, unknown>;

  // Status
  status(code: number): EnhancedResponse;

  // Core response methods
  json(data: unknown): void;
  send(data: string | Buffer | object): void;
  html(data: string): void;
  text(data: string): void;
  xml(data: string): void;

  // Enhanced response methods
  csv(data: unknown[], filename?: string): void;
  stream(stream: NodeJS.ReadableStream, contentType?: string): void;

  // File operations
  sendFile(filePath: string, options?: FileOptions): void;
  download(filePath: string, filename?: string, options?: FileOptions): void;

  // Smart file operations
  getSmartContentType(filePath: string): string;
  generateETag(stats: unknown): string;

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
  cookie(
    name: string,
    value: string,
    options?: CookieOptions
  ): EnhancedResponse;
  clearCookie(name: string, options?: CookieOptions): EnhancedResponse;

  // Template rendering
  render(template: string, data?: unknown): void;

  // Template helper methods
  getNestedValue(obj: unknown, path: string): unknown;
  isTruthy(value: unknown): boolean;

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
  success(data: unknown, message?: string): void;
  error(message: string, code?: number, details?: unknown): void;
  paginate(data: unknown[], page: number, limit: number, total: number): void;

  // Content type utilities
  getContentTypeFromExtension(ext: string): string;

  // Helper methods
  convertToCSV(data: unknown[]): string;

  // Performance
  time(label?: string): EnhancedResponse;
}

/**
 * Response Enhancer class for NextRush v2
 *
 * @example
 * ```typescript
 * import { ResponseEnhancer } from '@/core/enhancers/response-enhancer';
 *
 * const enhancedRes = ResponseEnhancer.enhance(res);
 * enhancedRes.json({ message: 'Hello World' });
 * ```
 */
export class ResponseEnhancer {
  /**
   * Enhance a Node.js ServerResponse with NextRush v2 features
   *
   * @param res - The original HTTP response
   * @returns Enhanced response with additional methods
   */
  static enhance(res: ServerResponse): EnhancedResponse {
    const enhanced = res as EnhancedResponse;

    // Initialize properties
    enhanced.locals = enhanced.locals || {};

    // Status management
    if (!enhanced.status) {
      enhanced.status = (code: number) => {
        enhanced.statusCode = code;
        return enhanced;
      };
    }

    // Core response methods
    if (!enhanced.json) {
      enhanced.json = (data: unknown) => {
        if (enhanced.headersSent || enhanced.finished) {
          return; // Don't write if response has already been sent
        }
        if (!enhanced.headersSent) {
          enhanced.setHeader('Content-Type', 'application/json');
        }
        // Ensure statusCode is set
        if (enhanced.status) {
          enhanced.statusCode =
            typeof enhanced.status === 'function'
              ? enhanced.statusCode
              : (enhanced.status as unknown as number);
        }
        enhanced.end(JSON.stringify(data));
      };
    }

    if (!enhanced.send) {
      enhanced.send = (data: string | Buffer | object) => {
        if (enhanced.headersSent || enhanced.finished) {
          return; // Don't write if response has already been sent
        }
        if (typeof data === 'object' && !Buffer.isBuffer(data)) {
          enhanced.json(data);
        } else {
          // Ensure statusCode is set
          if (enhanced.status) {
            enhanced.statusCode =
              typeof enhanced.status === 'function'
                ? enhanced.statusCode
                : (enhanced.status as unknown as number);
          }
          enhanced.end(data);
        }
      };
    }

    if (!enhanced.html) {
      enhanced.html = (data: string) => {
        if (enhanced.headersSent || enhanced.finished) {
          return; // Don't write if response has already been sent
        }
        if (!enhanced.headersSent) {
          enhanced.setHeader('Content-Type', 'text/html');
        }
        // Ensure statusCode is set
        if (enhanced.status) {
          enhanced.statusCode =
            typeof enhanced.status === 'function'
              ? enhanced.statusCode
              : (enhanced.status as unknown as number);
        }
        enhanced.end(data);
      };
    }

    if (!enhanced.text) {
      enhanced.text = (data: string) => {
        if (enhanced.headersSent || enhanced.finished) {
          return; // Don't write if response has already been sent
        }
        if (!enhanced.headersSent) {
          enhanced.setHeader('Content-Type', 'text/plain');
        }
        // Ensure statusCode is set
        if (enhanced.status) {
          enhanced.statusCode =
            typeof enhanced.status === 'function'
              ? enhanced.statusCode
              : (enhanced.status as unknown as number);
        }
        enhanced.end(data);
      };
    }

    if (!enhanced.xml) {
      enhanced.xml = (data: string) => {
        if (enhanced.headersSent || enhanced.finished) {
          return; // Don't write if response has already been sent
        }
        if (!enhanced.headersSent) {
          enhanced.setHeader('Content-Type', 'application/xml');
        }
        // Ensure statusCode is set
        if (enhanced.status) {
          enhanced.statusCode =
            typeof enhanced.status === 'function'
              ? enhanced.statusCode
              : (enhanced.status as unknown as number);
        }
        enhanced.end(data);
      };
    }

    // Enhanced response methods
    if (!enhanced.csv) {
      enhanced.csv = (data: unknown[], filename?: string) => {
        const csvContent = enhanced.convertToCSV(data);
        if (!enhanced.headersSent) {
          enhanced.setHeader('Content-Type', 'text/csv');
          if (filename) {
            enhanced.setHeader(
              'Content-Disposition',
              `attachment; filename="${filename}"`
            );
          }
        }
        // Ensure statusCode is set
        if (enhanced.status) {
          enhanced.statusCode =
            typeof enhanced.status === 'function'
              ? enhanced.statusCode
              : (enhanced.status as unknown as number);
        }
        enhanced.end(csvContent);
      };
    }

    if (!enhanced.stream) {
      enhanced.stream = (
        stream: NodeJS.ReadableStream,
        contentType?: string
      ) => {
        if (contentType && !enhanced.headersSent) {
          enhanced.setHeader('Content-Type', contentType);
        }
        stream.pipe(enhanced);
      };
    }

    // File operations
    if (!enhanced.sendFile) {
      enhanced.sendFile = (filePath: string, _options?: FileOptions) => {
        try {
          const stats = statSync(filePath);
          const contentType = enhanced.getSmartContentType(filePath);

          enhanced.setHeader('Content-Type', contentType);
          enhanced.setHeader('Content-Length', stats.size);
          enhanced.setHeader('Last-Modified', stats.mtime.toUTCString());

          if (_options?.etag !== false) {
            const etag = enhanced.generateETag(stats);
            enhanced.setHeader('ETag', etag);
          }

          const stream = createReadStream(filePath);
          stream.pipe(enhanced);
        } catch {
          enhanced.status(404).json({ error: 'File not found' });
        }
      };
    }

    if (!enhanced.download) {
      enhanced.download = (
        filePath: string,
        filename?: string,
        options?: FileOptions
      ) => {
        const name = filename || filePath.split('/').pop() || 'download';
        enhanced.setHeader(
          'Content-Disposition',
          `attachment; filename="${name}"`
        );
        enhanced.sendFile(filePath, options);
      };
    }

    // Smart file operations
    if (!enhanced.getSmartContentType) {
      enhanced.getSmartContentType = (filePath: string) => {
        const ext = extname(filePath).toLowerCase();
        return enhanced.getContentTypeFromExtension(ext);
      };
    }

    if (!enhanced.generateETag) {
      enhanced.generateETag = (stats: { size: number; mtime: Date }) => {
        const hash = createHash('md5');
        hash.update(`${stats.size}-${stats.mtime.getTime()}`);
        return `"${hash.digest('hex')}"`;
      };
    }

    // Redirect methods
    if (!enhanced.redirect) {
      enhanced.redirect = (url: string, status: number = 302) => {
        enhanced.statusCode = status;
        enhanced.setHeader('Location', url);
        enhanced.end();
      };
    }

    if (!enhanced.redirectPermanent) {
      enhanced.redirectPermanent = (url: string) => {
        enhanced.redirect(url, 301);
      };
    }

    if (!enhanced.redirectTemporary) {
      enhanced.redirectTemporary = (url: string) => {
        enhanced.redirect(url, 307);
      };
    }

    // Header methods
    if (!enhanced.set) {
      enhanced.set = (
        field: string | Record<string, string>,
        value?: string
      ) => {
        if (typeof field === 'string' && value !== undefined) {
          enhanced.setHeader(field, value);
        } else if (typeof field === 'object') {
          Object.entries(field).forEach(([key, val]) => {
            enhanced.setHeader(key, val);
          });
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

    if (!enhanced.removeHeader) {
      enhanced.removeHeader = (field: string) => {
        // Use the native removeHeader method from ServerResponse
        (enhanced as ServerResponse).removeHeader(field);
        return enhanced;
      };
    }

    if (!enhanced.get) {
      enhanced.get = (field: string) => {
        return enhanced.getHeader(field) as string | undefined;
      };
    }

    // Cookie methods
    if (!enhanced.cookie) {
      enhanced.cookie = (
        name: string,
        value: string,
        options?: CookieOptions
      ) => {
        const cookie = serializeCookie(name, value, options);
        enhanced.setHeader('Set-Cookie', cookie);
        return enhanced;
      };
    }

    if (!enhanced.clearCookie) {
      enhanced.clearCookie = (name: string, options?: CookieOptions) => {
        enhanced.cookie(name, '', {
          ...options,
          maxAge: 0,
          expires: new Date(0),
        });
        return enhanced;
      };
    }

    // Template rendering
    if (!enhanced.render) {
      enhanced.render = (template: string, data?: unknown) => {
        // Basic template rendering - can be extended with template engine
        let rendered = template;

        if (data && typeof data === 'object') {
          Object.entries(data as Record<string, unknown>).forEach(
            ([key, value]) => {
              const regex = new RegExp(`{{${key}}}`, 'g');
              rendered = rendered.replace(regex, String(value));
            }
          );
        }

        enhanced.html(rendered);
      };
    }

    // Template helper methods
    if (!enhanced.getNestedValue) {
      enhanced.getNestedValue = (obj: unknown, path: string) => {
        return path.split('.').reduce((current: Record<string, unknown> | null, key: string) => {
          return current && typeof current === 'object' && key in current
            ? current[key] as Record<string, unknown> | null
            : null;
        }, obj as Record<string, unknown> | null);
      };
    }

    if (!enhanced.isTruthy) {
      enhanced.isTruthy = (value: unknown) => {
        return (
          value !== null &&
          value !== undefined &&
          value !== false &&
          value !== 0 &&
          value !== ''
        );
      };
    }

    // Cache control
    if (!enhanced.cache) {
      enhanced.cache = (seconds: number) => {
        enhanced.setHeader('Cache-Control', `public, max-age=${seconds}`);
        return enhanced;
      };
    }

    if (!enhanced.noCache) {
      enhanced.noCache = () => {
        enhanced.setHeader(
          'Cache-Control',
          'no-cache, no-store, must-revalidate'
        );
        enhanced.setHeader('Pragma', 'no-cache');
        enhanced.setHeader('Expires', '0');
        return enhanced;
      };
    }

    // CORS support
    if (!enhanced.cors) {
      enhanced.cors = (origin?: string) => {
        enhanced.setHeader('Access-Control-Allow-Origin', origin || '*');
        enhanced.setHeader(
          'Access-Control-Allow-Methods',
          'GET, POST, PUT, DELETE, OPTIONS'
        );
        enhanced.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization'
        );
        return enhanced;
      };
    }

    // Security headers
    if (!enhanced.security) {
      enhanced.security = () => {
        enhanced.setHeader('X-Content-Type-Options', 'nosniff');
        enhanced.setHeader('X-Frame-Options', 'DENY');
        enhanced.setHeader('X-XSS-Protection', '1; mode=block');
        enhanced.setHeader(
          'Referrer-Policy',
          'strict-origin-when-cross-origin'
        );
        return enhanced;
      };
    }

    // Compression hint
    if (!enhanced.compress) {
      enhanced.compress = () => {
        enhanced.setHeader('Content-Encoding', 'gzip');
        return enhanced;
      };
    }

    // API response helpers
    if (!enhanced.success) {
      enhanced.success = (data: unknown, message?: string) => {
        enhanced.json({
          success: true,
          data,
          message: message || 'Success',
          timestamp: new Date().toISOString(),
        });
      };
    }

    if (!enhanced.error) {
      enhanced.error = (
        message: string,
        code: number = 500,
        details?: unknown
      ) => {
        enhanced.status(code).json({
          success: false,
          error: message,
          details,
          timestamp: new Date().toISOString(),
        });
      };
    }

    if (!enhanced.paginate) {
      enhanced.paginate = (
        data: unknown[],
        page: number,
        limit: number,
        total: number
      ) => {
        const totalPages = Math.ceil(total / limit);
        enhanced.json({
          success: true,
          data,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
          timestamp: new Date().toISOString(),
        });
      };
    }

    // Content type utilities
    if (!enhanced.getContentTypeFromExtension) {
      enhanced.getContentTypeFromExtension = (ext: string) => {
        const mimeTypes: Record<string, string> = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'application/javascript',
          '.json': 'application/json',
          '.xml': 'application/xml',
          '.txt': 'text/plain',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.pdf': 'application/pdf',
          '.zip': 'application/zip',
          '.csv': 'text/csv',
        };
        return mimeTypes[ext] || 'application/octet-stream';
      };
    }

    // Performance
    if (!enhanced.time) {
      enhanced.time = (label?: string) => {
        const timing = process.hrtime.bigint();
        enhanced.setHeader('X-Response-Time', `${timing}ns`);
        if (label) {
          enhanced.setHeader('X-Timing-Label', label);
        }
        return enhanced;
      };
    }

    // Helper method for CSV conversion
    if (!enhanced.convertToCSV) {
      enhanced.convertToCSV = (data: unknown[]) => {
        if (!Array.isArray(data) || data.length === 0) {
          return '';
        }

        const headers = Object.keys(data[0] as Record<string, unknown>);
        const csvRows = [headers.join(',')];

        for (const row of data) {
          const values = headers.map(header => {
            const value = (row as Record<string, unknown>)[header];
            return `"${String(value || '').replace(/"/g, '""')}"`;
          });
          csvRows.push(values.join(','));
        }

        return csvRows.join('\n');
      };
    }

    return enhanced;
  }
}
