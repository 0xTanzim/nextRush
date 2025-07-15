/**
 * Response enhancer - converts Node.js ServerResponse to Express-style response
 * Enhanced with comprehensive API methods for maximum developer productivity
 */
import * as fs from 'fs';
import { ServerResponse } from 'http';
import * as path from 'path';
import { NextRushResponse } from '../../types/express';

export class ResponseEnhancer {
  static enhance(res: ServerResponse): NextRushResponse {
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

    // 🚀 NEW: Stream response
    enhanced.stream = function (
      stream: NodeJS.ReadableStream,
      contentType?: string
    ): void {
      if (contentType) {
        this.setHeader('Content-Type', contentType);
      }
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
    enhanced.sendFile = function (
      filePath: string,
      options: {
        maxAge?: number;
        lastModified?: boolean;
        etag?: boolean;
        dotfiles?: 'allow' | 'deny' | 'ignore';
        root?: string;
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
        this.end('Forbidden');
        return;
      }

      // Check if file exists
      fs.stat(resolvedPath, (err, stats) => {
        if (err) {
          this.statusCode = 404;
          this.end('File not found');
          return;
        }

        try {
          // Set content type based on file extension
          const ext = path.extname(resolvedPath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.wav': 'audio/wav',
            '.mp4': 'video/mp4',
            '.woff': 'application/font-woff',
            '.ttf': 'application/font-ttf',
            '.eot': 'application/vnd.ms-fontobject',
            '.otf': 'application/font-otf',
            '.svg': 'application/image/svg+xml',
            '.pdf': 'application/pdf',
            '.txt': 'text/plain',
          };

          const mimeType = mimeTypes[ext] || 'application/octet-stream';

          // Only set headers if response hasn't been sent
          if (!this.headersSent) {
            this.setHeader('Content-Type', mimeType);
            this.setHeader('Content-Length', stats.size.toString());

            // Set cache headers
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
              const etag = `"${stats.size}-${stats.mtime.getTime()}"`;
              this.setHeader('ETag', etag);
            }
          }

          // Stream the file
          const stream = fs.createReadStream(resolvedPath);
          stream.pipe(this);

          stream.on('error', () => {
            if (!this.headersSent) {
              this.statusCode = 500;
              this.end('Internal Server Error');
            }
          });
        } catch (error) {
          if (!this.headersSent) {
            this.statusCode = 500;
            this.end('Internal Server Error');
          }
        }
      });
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

    // 🚀 NEW: Render template (basic implementation)
    enhanced.render = function (template: string, data: any = {}): void {
      // Simple template rendering - replace {{variable}} with data values
      let html = template;
      Object.entries(data).forEach(([key, value]) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        html = html.replace(regex, String(value));
      });
      this.html(html);
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
