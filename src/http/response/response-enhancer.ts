/**
 * Response enhancer - converts Node.js ServerResponse to Express-style response
 * Enhanced with comprehensive API methods for maximum developer productivity
 */
import * as fs from 'fs';
import { ServerResponse } from 'http';
import * as path from 'path';
import { TemplateManager } from '../../templating/clean-template-engine';
import { NextRushResponse } from '../../types/express';

export interface ResponseContext {
  templateManager?: TemplateManager;
}

export class ResponseEnhancer {
  static enhance(
    res: ServerResponse,
    context?: ResponseContext
  ): NextRushResponse {
    const enhanced = res as NextRushResponse;

    // Initialize locals
    enhanced.locals = {};

    // Status method (chainable)
    enhanced.status = function (code: number): NextRushResponse {
      this.statusCode = code;
      return this;
    };

    // JSON response with automatic content-type
    enhanced.json = function (data: any): void {
      this.setHeader('Content-Type', 'application/json; charset=utf-8');
      this.end(JSON.stringify(data));
    };

    // Send response (auto-detects type)
    enhanced.send = function (data: string | Buffer | object): void {
      if (typeof data === 'object' && !(data instanceof Buffer)) {
        this.json(data);
      } else if (typeof data === 'string') {
        this.setHeader('Content-Type', 'text/html; charset=utf-8');
        this.end(data);
      } else {
        this.end(data);
      }
    };

    // HTML response
    enhanced.html = function (data: string): void {
      this.setHeader('Content-Type', 'text/html; charset=utf-8');
      this.end(data);
    };

    // Plain text response
    enhanced.text = function (data: string): void {
      this.setHeader('Content-Type', 'text/plain; charset=utf-8');
      this.end(data);
    };

    // XML response
    enhanced.xml = function (data: string): void {
      this.setHeader('Content-Type', 'application/xml; charset=utf-8');
      this.end(data);
    };

    // 🚀 NEW: CSV response
    enhanced.csv = function (data: any[], filename?: string): void {
      this.setHeader('Content-Type', 'text/csv; charset=utf-8');
      if (filename) {
        this.setHeader(
          'Content-Disposition',
          `attachment; filename="${filename}"`
        );
      }

      if (data.length === 0) {
        this.end('');
        return;
      }

      // Convert array of objects to CSV
      const headers = Object.keys(data[0]);
      const csvRows = [
        headers.join(','),
        ...data.map((row) =>
          headers
            .map((header) => {
              const value = row[header];
              return typeof value === 'string' && value.includes(',')
                ? `"${value}"`
                : String(value);
            })
            .join(',')
        ),
      ];

      this.end(csvRows.join('\n'));
    };

    // 🚀 ENHANCED: Professional streaming for large files
    enhanced.stream = function (
      stream: NodeJS.ReadableStream,
      contentType?: string,
      options?: {
        bufferSize?: number;
        highWaterMark?: number;
        enableCompression?: boolean;
      }
    ): void {
      // Set content type if provided
      if (contentType) {
        this.setHeader('Content-Type', contentType);
      }

      // 🚀 SMART STREAMING with options
      const streamOptions = {
        bufferSize: options?.bufferSize || 64 * 1024, // 64KB default buffer
        highWaterMark: options?.highWaterMark || 16 * 1024, // 16KB high water mark
        ...options,
      };

      // 🔧 PERFORMANCE: Set optimal headers for streaming
      this.setHeader('Transfer-Encoding', 'chunked');

      // 🎯 COMPRESSION HINT for reverse proxies
      if (streamOptions.enableCompression) {
        this.setHeader('Vary', 'Accept-Encoding');
      }

      // 📊 MONITORING: Log streaming start
      console.log(`🎥 Streaming content (${contentType || 'unknown type'})`);

      // Handle stream errors gracefully
      stream.on('error', (error) => {
        console.error('Stream error:', error);
        if (!this.headersSent) {
          this.statusCode = 500;
          this.end('Stream error occurred');
        }
      });

      // Monitor streaming progress for large files
      let bytesStreamed = 0;
      stream.on('data', (chunk) => {
        bytesStreamed += chunk.length;
        // Log progress for large streams (> 10MB)
        if (
          bytesStreamed > 10 * 1024 * 1024 &&
          bytesStreamed % (5 * 1024 * 1024) === 0
        ) {
          console.log(
            `📈 Streamed ${(bytesStreamed / 1024 / 1024).toFixed(2)}MB`
          );
        }
      });

      stream.on('end', () => {
        if (bytesStreamed > 1024 * 1024) {
          console.log(
            `✅ Stream completed: ${(bytesStreamed / 1024 / 1024).toFixed(
              2
            )}MB total`
          );
        }
      });

      // Start streaming
      stream.pipe(this);
    };

    // Redirect with default status 302
    enhanced.redirect = function (url: string, status: number = 302): void {
      this.statusCode = status;
      this.setHeader('Location', url);
      this.end();
    };

    // 🚀 NEW: Enhanced redirect with different types
    enhanced.redirectPermanent = function (url: string): void {
      this.redirect(url, 301);
    };

    enhanced.redirectTemporary = function (url: string): void {
      this.redirect(url, 302);
    };

    // Set headers (chainable)
    enhanced.set = enhanced.header = function (
      field: string | Record<string, string>,
      value?: string
    ): NextRushResponse {
      if (typeof field === 'object') {
        // Set multiple headers: res.set({ 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' })
        Object.entries(field).forEach(([key, val]) => {
          this.setHeader(key, val);
        });
      } else if (value !== undefined) {
        // Set single header: res.set('Content-Type', 'text/html')
        this.setHeader(field, value);
      }
      return this;
    };

    // Get header value
    enhanced.get = function (field: string): string | undefined {
      return this.getHeader(field) as string | undefined;
    };

    // 🚀 NEW: Remove header
    enhanced.removeHeader = function (field: string): NextRushResponse {
      this.removeHeader(field);
      return this;
    };

    // Enhanced cookie methods with better options support
    enhanced.cookie = function (
      name: string,
      value: string,
      options: {
        maxAge?: number;
        expires?: Date;
        path?: string;
        domain?: string;
        secure?: boolean;
        httpOnly?: boolean;
        sameSite?: 'strict' | 'lax' | 'none';
        signed?: boolean;
      } = {}
    ): NextRushResponse {
      let cookie = `${name}=${encodeURIComponent(value)}`;

      if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
      if (options.expires)
        cookie += `; Expires=${options.expires.toUTCString()}`;
      if (options.path) cookie += `; Path=${options.path}`;
      if (options.domain) cookie += `; Domain=${options.domain}`;
      if (options.secure) cookie += '; Secure';
      if (options.httpOnly) cookie += '; HttpOnly';
      if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;

      const existing = this.getHeader('Set-Cookie') || [];
      const cookies = Array.isArray(existing) ? existing : [existing];
      cookies.push(cookie);
      this.setHeader('Set-Cookie', cookies.map(String));

      return this;
    };

    // Clear cookie
    enhanced.clearCookie = function (
      name: string,
      options: any = {}
    ): NextRushResponse {
      return this.cookie(name, '', {
        ...options,
        expires: new Date(0),
        maxAge: 0,
      });
    };

    // 🚀 NEW: Send file with proper headers
    // 🚀 ENHANCED: Professional file serving with smart detection
    enhanced.sendFile = function (
      filePath: string,
      options: {
        maxAge?: number;
        lastModified?: boolean;
        etag?: boolean;
        dotfiles?: 'allow' | 'deny' | 'ignore';
        root?: string;
        headers?: Record<string, string>;
        acceptRanges?: boolean;
      } = {}
    ): void {
      const resolvedPath = options.root
        ? path.resolve(options.root, filePath)
        : path.resolve(filePath);

      // Security check - prevent path traversal
      if (
        options.root &&
        !resolvedPath.startsWith(path.resolve(options.root))
      ) {
        this.statusCode = 403;
        this.end('Forbidden: Path traversal not allowed');
        return;
      }

      // Check if file exists
      fs.stat(resolvedPath, (err, stats) => {
        if (err) {
          this.statusCode = 404;
          this.end('File not found');
          return;
        }

        if (!stats.isFile()) {
          this.statusCode = 404;
          this.end('Not a file');
          return;
        }

        try {
          // 🎯 SMART CONTENT-TYPE DETECTION (Enhanced)
          const contentType = this.getSmartContentType(resolvedPath);

          // Only set headers if response hasn't been sent
          if (!this.headersSent) {
            this.setHeader('Content-Type', contentType);
            this.setHeader('Content-Length', stats.size.toString());

            // Set custom headers if provided
            if (options.headers) {
              Object.entries(options.headers).forEach(([key, value]) => {
                this.setHeader(key, value);
              });
            }

            // 🏷️ AUTOMATIC CACHE HEADERS
            if (options.maxAge) {
              this.setHeader(
                'Cache-Control',
                `public, max-age=${Math.floor(options.maxAge / 1000)}`
              );
            }

            if (options.lastModified !== false) {
              this.setHeader('Last-Modified', stats.mtime.toUTCString());
            }

            if (options.etag !== false) {
              const etag = this.generateETag(stats);
              this.setHeader('ETag', etag);
            }

            // 🚀 RANGE SUPPORT for large files
            if (options.acceptRanges !== false && stats.size > 1024 * 1024) {
              this.setHeader('Accept-Ranges', 'bytes');
            }
          }

          // 🚀 SMART FILE STREAMING (Enhanced for performance)
          if (stats.size > 1024 * 1024) {
            // Files > 1MB get streaming
            console.log(
              `📡 Streaming large file: ${path.basename(resolvedPath)} (${(
                stats.size /
                1024 /
                1024
              ).toFixed(2)}MB)`
            );
            const stream = fs.createReadStream(resolvedPath);
            stream.pipe(this);

            stream.on('error', () => {
              if (!this.headersSent) {
                this.statusCode = 500;
                this.end('Internal Server Error');
              }
            });
          } else {
            // Small files - read and send directly for better performance
            fs.readFile(resolvedPath, (readErr, data) => {
              if (readErr) {
                this.statusCode = 500;
                this.end('Internal Server Error');
                return;
              }
              this.end(data);
            });
          }
        } catch (error) {
          if (!this.headersSent) {
            this.statusCode = 500;
            this.end('Internal Server Error');
          }
        }
      });
    };

    // 🎯 SMART CONTENT-TYPE DETECTION (Professional Grade)
    enhanced.getSmartContentType = function (filePath: string): string {
      const ext = path.extname(filePath).toLowerCase();

      const mimeTypes: Record<string, string> = {
        // 📄 Text & Web Files
        '.html': 'text/html; charset=utf-8',
        '.htm': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.mjs': 'text/javascript; charset=utf-8',
        '.ts': 'text/typescript; charset=utf-8',
        '.jsx': 'text/jsx; charset=utf-8',
        '.tsx': 'text/tsx; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.xml': 'application/xml; charset=utf-8',
        '.txt': 'text/plain; charset=utf-8',
        '.md': 'text/markdown; charset=utf-8',
        '.csv': 'text/csv; charset=utf-8',
        '.log': 'text/plain; charset=utf-8',

        // 🖼️ Images
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.bmp': 'image/bmp',
        '.tiff': 'image/tiff',
        '.tif': 'image/tiff',
        '.avif': 'image/avif',

        // 🎥 Videos
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.wmv': 'video/x-ms-wmv',
        '.flv': 'video/x-flv',
        '.mkv': 'video/x-matroska',

        // 🎵 Audio
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.flac': 'audio/flac',
        '.wma': 'audio/x-ms-wma',

        // 📚 Documents
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx':
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.rtf': 'application/rtf',
        '.odt': 'application/vnd.oasis.opendocument.text',

        // 🗜️ Archives
        '.zip': 'application/zip',
        '.rar': 'application/x-rar-compressed',
        '.tar': 'application/x-tar',
        '.gz': 'application/gzip',
        '.7z': 'application/x-7z-compressed',
        '.bz2': 'application/x-bzip2',

        // 🔤 Fonts
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.otf': 'font/otf',
        '.eot': 'application/vnd.ms-fontobject',

        // 💾 Application Files
        '.exe': 'application/octet-stream',
        '.dmg': 'application/x-apple-diskimage',
        '.deb': 'application/x-debian-package',
        '.rpm': 'application/x-rpm',
        '.msi': 'application/x-msdownload',

        // 🛠️ Development Files
        '.yaml': 'text/yaml; charset=utf-8',
        '.yml': 'text/yaml; charset=utf-8',
        '.toml': 'text/toml; charset=utf-8',
        '.ini': 'text/plain; charset=utf-8',
        '.conf': 'text/plain; charset=utf-8',
        '.env': 'text/plain; charset=utf-8',
      };

      return mimeTypes[ext] || 'application/octet-stream';
    };

    // 🏷️ PROFESSIONAL ETAG GENERATION
    enhanced.generateETag = function (stats: any): string {
      return `"${stats.size.toString(16)}-${stats.mtime
        .getTime()
        .toString(16)}"`;
    };

    // 🚀 NEW: Download file (forces download)
    enhanced.download = function (
      filePath: string,
      filename?: string,
      options: any = {}
    ): void {
      const downloadName = filename || path.basename(filePath);
      this.setHeader(
        'Content-Disposition',
        `attachment; filename="${downloadName}"`
      );
      this.sendFile(filePath, options);
    };

    // 🚀 ENHANCED: Professional template rendering
    enhanced.render = function (template: string, data: any = {}): void {
      try {
        if (context?.templateManager) {
          // Use professional template manager
          if (template.includes('.') && !template.includes('<')) {
            // File template
            context.templateManager
              .renderFile(template, data)
              .then((rendered: string) => {
                this.html(rendered);
              })
              .catch((error: any) => {
                console.error('Template file rendering error:', error);
                this.status(500).html('<h1>Template File Error</h1>');
              });
          } else {
            // String template
            context.templateManager
              .renderString(template, data)
              .then((rendered: string) => {
                this.html(rendered);
              })
              .catch((error: any) => {
                console.error('Template string rendering error:', error);
                this.status(500).html('<h1>Template String Error</h1>');
              });
          }
        } else {
          // Fallback to simple template rendering
          let html = template;

          // Handle file templates (if template is a path)
          if (template.includes('.') && !template.includes('<')) {
            // This looks like a file path, try to read it
            const templatePath = path.resolve(template);
            try {
              const fs = require('fs');
              html = fs.readFileSync(templatePath, 'utf-8');
            } catch {
              // If file reading fails, treat as literal template
              html = template;
            }
          }

          // Simple variable replacement {{variable}}
          Object.entries(data).forEach(([key, value]) => {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            html = html.replace(regex, String(value));
          });

          // Enhanced features for simple templating
          // Handle conditionals: {{#if condition}}...{{/if}}
          html = html.replace(
            /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
            (_, condition, content) => {
              const value = enhanced.getNestedValue(data, condition.trim());
              return enhanced.isTruthy(value) ? content : '';
            }
          );

          // Handle loops: {{#each array}}...{{/each}}
          html = html.replace(
            /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
            (_, arrayKey, content) => {
              const array = enhanced.getNestedValue(data, arrayKey.trim());
              if (!Array.isArray(array)) return '';

              return array
                .map((item, index) => {
                  let itemContent = content;
                  // Replace {{this}} with current item
                  itemContent = itemContent.replace(
                    /\{\{\s*this\s*\}\}/g,
                    String(item)
                  );
                  // Replace {{@index}} with current index
                  itemContent = itemContent.replace(
                    /\{\{\s*@index\s*\}\}/g,
                    String(index)
                  );
                  // Replace {{property}} with item.property
                  if (typeof item === 'object' && item !== null) {
                    Object.entries(item).forEach(([key, value]) => {
                      const regex = new RegExp(
                        `\\{\\{\\s*${key}\\s*\\}\\}`,
                        'g'
                      );
                      itemContent = itemContent.replace(regex, String(value));
                    });
                  }
                  return itemContent;
                })
                .join('');
            }
          );

          this.html(html);
        }
      } catch (error) {
        console.error('Template rendering error:', error);
        this.status(500).html('<h1>Template Rendering Error</h1>');
      }
    };

    // 🛠️ Helper methods for template rendering
    enhanced.getNestedValue = function (obj: any, path: string): any {
      return path.split('.').reduce((current, key) => current?.[key], obj);
    };

    enhanced.isTruthy = function (value: any): boolean {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object' && value !== null)
        return Object.keys(value).length > 0;
      return Boolean(value);
    };

    // 🚀 NEW: Cache control helpers
    enhanced.cache = function (seconds: number): NextRushResponse {
      this.setHeader('Cache-Control', `public, max-age=${seconds}`);
      return this;
    };

    enhanced.noCache = function (): NextRushResponse {
      this.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      this.setHeader('Pragma', 'no-cache');
      this.setHeader('Expires', '0');
      return this;
    };

    // 🚀 NEW: CORS helpers
    enhanced.cors = function (origin: string = '*'): NextRushResponse {
      this.setHeader('Access-Control-Allow-Origin', origin);
      this.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      this.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
      );
      return this;
    };

    // 🚀 NEW: Security headers
    enhanced.security = function (): NextRushResponse {
      this.setHeader('X-Content-Type-Options', 'nosniff');
      this.setHeader('X-Frame-Options', 'DENY');
      this.setHeader('X-XSS-Protection', '1; mode=block');
      this.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
      return this;
    };

    // 🚀 NEW: Content compression hint
    enhanced.compress = function (): NextRushResponse {
      this.setHeader('Vary', 'Accept-Encoding');
      return this;
    };

    // 🚀 NEW: API response helpers
    enhanced.success = function (data: any, message: string = 'Success'): void {
      this.json({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString(),
      });
    };

    enhanced.error = function (
      message: string,
      code: number = 500,
      details?: any
    ): void {
      this.status(code).json({
        success: false,
        error: message,
        details,
        timestamp: new Date().toISOString(),
      });
    };

    enhanced.paginate = function (
      data: any[],
      page: number,
      limit: number,
      total: number
    ): void {
      const totalPages = Math.ceil(total / limit);
      this.json({
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

    // 🚀 NEW: Response timing
    enhanced.time = function (label?: string): NextRushResponse {
      const time = Date.now();
      if (label) {
        this.setHeader(`X-Response-Time-${label}`, `${time}ms`);
      } else {
        this.setHeader('X-Response-Time', `${time}ms`);
      }
      return this;
    };

    return enhanced;
  }
}
