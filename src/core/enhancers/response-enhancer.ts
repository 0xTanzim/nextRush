/**
 * Response Enhancer - NextRush-compatible response enhancement with full Express-style features
 */

import * as fs from 'fs';
import { ServerResponse } from 'http';
import * as path from 'path';

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

    // 📊 Status method (chainable)
    if (!enhanced.status) {
      enhanced.status = (code: number) => {
        enhanced.statusCode = code;
        return enhanced;
      };
    }

    // 📤 Core response methods with improved handling
    if (!enhanced.json) {
      enhanced.json = (data: any) => {
        enhanced.setHeader('Content-Type', 'application/json; charset=utf-8');
        enhanced.end(JSON.stringify(data, null, 2));
      };
    }

    if (!enhanced.send) {
      enhanced.send = (data: any) => {
        if (data === null || data === undefined) {
          enhanced.end();
          return;
        }

        if (typeof data === 'object' && !Buffer.isBuffer(data)) {
          enhanced.json(data);
        } else if (Buffer.isBuffer(data)) {
          enhanced.setHeader('Content-Type', 'application/octet-stream');
          enhanced.end(data);
        } else {
          enhanced.setHeader('Content-Type', 'text/html; charset=utf-8');
          enhanced.end(String(data));
        }
      };
    }

    if (!enhanced.html) {
      enhanced.html = (data: string) => {
        enhanced.setHeader('Content-Type', 'text/html; charset=utf-8');
        enhanced.end(data);
      };
    }

    if (!enhanced.text) {
      enhanced.text = (data: string) => {
        enhanced.setHeader('Content-Type', 'text/plain; charset=utf-8');
        enhanced.end(data);
      };
    }

    if (!enhanced.xml) {
      enhanced.xml = (data: string) => {
        enhanced.setHeader('Content-Type', 'application/xml; charset=utf-8');
        enhanced.end(data);
      };
    }

    // 📊 CSV response generation with proper formatting
    if (!enhanced.csv) {
      enhanced.csv = (data: any[], filename?: string) => {
        if (!Array.isArray(data) || data.length === 0) {
          enhanced
            .status(400)
            .json({ error: 'Data must be a non-empty array' });
          return;
        }

        // Generate CSV from array of objects
        const headers = Object.keys(data[0]);
        let csv = headers.join(',') + '\n';

        for (const row of data) {
          const values = headers.map((header) => {
            const value = row[header];
            // Escape commas and quotes in CSV
            if (
              typeof value === 'string' &&
              (value.includes(',') || value.includes('"'))
            ) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          });
          csv += values.join(',') + '\n';
        }

        enhanced.setHeader('Content-Type', 'text/csv; charset=utf-8');
        if (filename) {
          enhanced.setHeader(
            'Content-Disposition',
            `attachment; filename="${filename}"`
          );
        }
        enhanced.end(csv);
      };
    }

    // 🌊 Streaming response for large files with compression support
    if (!enhanced.stream) {
      enhanced.stream = (
        stream: NodeJS.ReadableStream,
        contentType = 'application/octet-stream',
        options: any = {}
      ) => {
        enhanced.setHeader('Content-Type', contentType);

        if (options.enableCompression) {
          enhanced.setHeader('Content-Encoding', 'gzip');
        }

        stream.pipe(enhanced);
      };
    }

    // 🔄 Redirect methods with proper status codes
    if (!enhanced.redirect) {
      enhanced.redirect = (url: string, status = 302) => {
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

    // 📋 Header management with bulk operations
    if (!enhanced.set) {
      enhanced.set = (
        field: string | Record<string, string>,
        value?: string
      ) => {
        if (typeof field === 'object') {
          for (const [key, val] of Object.entries(field)) {
            enhanced.setHeader(key, val);
          }
        } else if (value !== undefined) {
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

    if (!enhanced.removeHeader) {
      enhanced.removeHeader = (field: string) => {
        res.removeHeader(field);
        return enhanced;
      };
    }

    if (!enhanced.get) {
      enhanced.get = (field: string) => {
        return enhanced.getHeader(field) as string | undefined;
      };
    }

    // 🍪 Cookie management with all security options
    if (!enhanced.cookie) {
      enhanced.cookie = (name: string, value: string, options: any = {}) => {
        let cookieString = `${name}=${encodeURIComponent(value)}`;

        if (options.maxAge) {
          cookieString += `; Max-Age=${options.maxAge}`;
        }

        if (options.expires) {
          cookieString += `; Expires=${options.expires.toUTCString()}`;
        }

        if (options.path) {
          cookieString += `; Path=${options.path}`;
        }

        if (options.domain) {
          cookieString += `; Domain=${options.domain}`;
        }

        if (options.secure) {
          cookieString += '; Secure';
        }

        if (options.httpOnly) {
          cookieString += '; HttpOnly';
        }

        if (options.sameSite) {
          cookieString += `; SameSite=${options.sameSite}`;
        }

        enhanced.setHeader('Set-Cookie', cookieString);
        return enhanced;
      };
    }

    if (!enhanced.clearCookie) {
      enhanced.clearCookie = (name: string, options: any = {}) => {
        enhanced.cookie(name, '', {
          ...options,
          expires: new Date(0),
        });
        return enhanced;
      };
    }

    // 📁 File operations with smart content detection and caching
    if (!enhanced.sendFile) {
      enhanced.sendFile = async (filePath: string, options: any = {}) => {
        try {
          const fullPath = path.resolve(filePath);
          const stats = await fs.promises.stat(fullPath);

          if (!stats.isFile()) {
            enhanced.status(404).json({ error: 'File not found' });
            return;
          }

          const contentType = enhanced.getSmartContentType(fullPath);
          enhanced.setHeader('Content-Type', contentType);
          enhanced.setHeader('Content-Length', stats.size);

          if (options.lastModified) {
            enhanced.setHeader('Last-Modified', stats.mtime.toUTCString());
          }

          if (options.etag) {
            enhanced.setHeader('ETag', enhanced.generateETag(stats));
          }

          if (options.maxAge) {
            enhanced.setHeader('Cache-Control', `max-age=${options.maxAge}`);
          }

          const fileStream = fs.createReadStream(fullPath);
          fileStream.pipe(enhanced);
        } catch (error) {
          enhanced.status(404).json({ error: 'File not found' });
        }
      };
    }

    if (!enhanced.download) {
      enhanced.download = async (
        filePath: string,
        filename?: string,
        options: any = {}
      ) => {
        const downloadName = filename || path.basename(filePath);
        enhanced.setHeader(
          'Content-Disposition',
          `attachment; filename="${downloadName}"`
        );
        enhanced.sendFile(filePath, options);
      };
    }

    // 🧠 Smart content-type detection with comprehensive MIME types
    if (!enhanced.getSmartContentType) {
      enhanced.getSmartContentType = (filePath: string) => {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'text/javascript',
          '.json': 'application/json',
          '.txt': 'text/plain',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
          '.pdf': 'application/pdf',
          '.zip': 'application/zip',
          '.rar': 'application/vnd.rar',
          '.7z': 'application/x-7z-compressed',
          '.mp4': 'video/mp4',
          '.avi': 'video/x-msvideo',
          '.mov': 'video/quicktime',
          '.wmv': 'video/x-ms-wmv',
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
          '.flac': 'audio/flac',
          '.ogg': 'audio/ogg',
          '.doc': 'application/msword',
          '.docx':
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls': 'application/vnd.ms-excel',
          '.xlsx':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.ppt': 'application/vnd.ms-powerpoint',
          '.pptx':
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
          '.ttf': 'font/ttf',
          '.eot': 'application/vnd.ms-fontobject',
        };
        return mimeTypes[ext] || 'application/octet-stream';
      };
    }

    // 🏷️ ETag generation for cache validation
    if (!enhanced.generateETag) {
      enhanced.generateETag = (stats: any) => {
        return `"${stats.size}-${stats.mtime.getTime()}"`;
      };
    }

    // 🎨 Template rendering - Use Application's render method if available
    if (!enhanced.render) {
      enhanced.render = async (
        template: string,
        data: any = {},
        options?: any
      ) => {
        try {
          // Check if we have a NextRush application instance with render method
          const req = enhanced.req as any;
          if (req && req.app && typeof req.app.render === 'function') {
            // Use the application's render method (includes views directory resolution)
            const html = await req.app.render(template, data);
            enhanced.setHeader('Content-Type', 'text/html; charset=utf-8');
            enhanced.end(html);
            return;
          }

          // Fallback to direct file reading (for backward compatibility)
          const templateContent = await fs.promises.readFile(template, 'utf-8');

          // Simple template replacement
          let rendered = templateContent.replace(
            /\{\{(\w+)\}\}/g,
            (match, key) => {
              return enhanced.getNestedValue(data, key) || match;
            }
          );

          // Handle conditionals
          rendered = rendered.replace(
            /\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/g,
            (match, key, content) => {
              return enhanced.isTruthy(enhanced.getNestedValue(data, key))
                ? content
                : '';
            }
          );

          // Handle loops
          rendered = rendered.replace(
            /\{\{#each\s+(\w+)\}\}(.*?)\{\{\/each\}\}/g,
            (match, key, content) => {
              const items = enhanced.getNestedValue(data, key);
              if (Array.isArray(items)) {
                return items
                  .map((item: any, index: number) => {
                    return content
                      .replace(/\{\{this\}\}/g, item)
                      .replace(/\{\{@index\}\}/g, index.toString());
                  })
                  .join('');
              }
              return '';
            }
          );

          enhanced.setHeader('Content-Type', 'text/html; charset=utf-8');
          enhanced.end(rendered);
        } catch (error) {
          enhanced.status(500).json({
            error: 'Template rendering failed',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      };
    }

    // Template helper methods
    if (!enhanced.getNestedValue) {
      enhanced.getNestedValue = (obj: any, path: string) => {
        return path.split('.').reduce((current, key) => current?.[key], obj);
      };
    }

    if (!enhanced.isTruthy) {
      enhanced.isTruthy = (value: any) => {
        return Boolean(value) && value !== 'false' && value !== '0';
      };
    }

    // 💾 Cache control with advanced options
    if (!enhanced.cache) {
      enhanced.cache = (seconds: number) => {
        enhanced.setHeader('Cache-Control', `max-age=${seconds}`);
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

    // 🌐 CORS support with flexible origins
    if (!enhanced.cors) {
      enhanced.cors = (origin = '*') => {
        enhanced.setHeader('Access-Control-Allow-Origin', origin);
        enhanced.setHeader(
          'Access-Control-Allow-Methods',
          'GET, POST, PUT, DELETE, PATCH, OPTIONS'
        );
        enhanced.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization'
        );
        return enhanced;
      };
    }

    // 🔒 Security headers with comprehensive protection
    if (!enhanced.security) {
      enhanced.security = () => {
        enhanced.setHeader('X-Content-Type-Options', 'nosniff');
        enhanced.setHeader('X-Frame-Options', 'DENY');
        enhanced.setHeader('X-XSS-Protection', '1; mode=block');
        enhanced.setHeader(
          'Strict-Transport-Security',
          'max-age=31536000; includeSubDomains'
        );
        enhanced.setHeader(
          'Referrer-Policy',
          'strict-origin-when-cross-origin'
        );
        enhanced.setHeader('Content-Security-Policy', "default-src 'self'");
        return enhanced;
      };
    }

    // 🗜️ Compression hint
    if (!enhanced.compress) {
      enhanced.compress = () => {
        enhanced.setHeader('Vary', 'Accept-Encoding');
        return enhanced;
      };
    }

    // 🎯 API response helpers with consistent structure
    if (!enhanced.success) {
      enhanced.success = (data: any, message = 'Success') => {
        enhanced.json({
          success: true,
          message,
          data,
          timestamp: new Date().toISOString(),
        });
      };
    }

    if (!enhanced.error) {
      enhanced.error = (message: string, code = 500, details?: any) => {
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
        data: any[],
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

    // 📄 Content type utilities
    if (!enhanced.getContentTypeFromExtension) {
      enhanced.getContentTypeFromExtension = enhanced.getSmartContentType;
    }

    // ⏱️ Performance timing with server metrics
    if (!enhanced.time) {
      enhanced.time = (label = 'response') => {
        enhanced.setHeader('X-Response-Time', `${label}-${Date.now()}`);
        return enhanced;
      };
    }

    return enhanced;
  }
}
