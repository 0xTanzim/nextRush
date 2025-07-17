/**
 * Response enhancer - converts Node.js ServerResponse to Express-style response
 * Enhanced with comprehensive API methods for maximum developer productivity
 */

import { promises as fs } from 'fs';
import { ServerResponse } from 'http';
import * as path from 'path';
import { NextRushResponse } from '../src/types/express';

export interface ResponseContext {
  templateManager?: any;
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
      this.setHeader('Content-Type', 'application/json');
      const jsonData = JSON.stringify(data);
      this.end(jsonData);
    };

    // Send response (auto-detects type)
    enhanced.send = function (data: string | Buffer | object): void {
      if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) {
        this.json(data);
      } else if (Buffer.isBuffer(data)) {
        this.setHeader('Content-Type', 'application/octet-stream');
        this.end(data);
      } else {
        this.setHeader('Content-Type', 'text/plain');
        this.end(String(data));
      }
    };

    // HTML response
    enhanced.html = function (data: string): void {
      this.setHeader('Content-Type', 'text/html');
      this.end(data);
    };

    // Plain text response
    enhanced.text = function (data: string): void {
      this.setHeader('Content-Type', 'text/plain');
      this.end(data);
    };

    // XML response
    enhanced.xml = function (data: string): void {
      this.setHeader('Content-Type', 'application/xml');
      this.end(data);
    };

    // 🚀 NEW: CSV response
    enhanced.csv = function (data: any[], filename?: string): void {
      this.setHeader('Content-Type', 'text/csv');
      if (filename) {
        this.setHeader(
          'Content-Disposition',
          `attachment; filename="${filename}"`
        );
      }

      if (!data.length) {
        this.end('');
        return;
      }

      // Generate CSV headers from first object
      const headers = Object.keys(data[0]);
      let csv = headers.join(',') + '\n';

      // Generate CSV rows
      for (const row of data) {
        const values = headers.map((header) => {
          const value = row[header];
          // Escape quotes and wrap in quotes if contains comma or quote
          if (
            typeof value === 'string' &&
            (value.includes(',') || value.includes('"'))
          ) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value || '';
        });
        csv += values.join(',') + '\n';
      }

      this.end(csv);
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
      if (contentType) {
        this.setHeader('Content-Type', contentType);
      }

      const opts = options || {};

      if (opts.enableCompression) {
        this.setHeader('Content-Encoding', 'gzip');
      }

      stream.pipe(this);
    };

    // Header management
    enhanced.set = function (
      field: string | Record<string, string>,
      value?: string
    ): NextRushResponse {
      if (typeof field === 'object') {
        for (const [key, val] of Object.entries(field)) {
          this.setHeader(key, val);
        }
      } else if (value !== undefined) {
        this.setHeader(field, value);
      }
      return this;
    };

    enhanced.header = function (
      field: string,
      value: string
    ): NextRushResponse {
      this.setHeader(field, value);
      return this;
    };

    enhanced.get = function (field: string): string | undefined {
      return this.getHeader(field) as string;
    };

    enhanced.removeHeader = function (field: string): NextRushResponse {
      this.removeHeader(field);
      return this;
    };

    // Cookie methods
    enhanced.cookie = function (
      name: string,
      value: string,
      options?: any
    ): NextRushResponse {
      const opts = options || {};
      let cookie = `${name}=${value}`;

      if (opts.maxAge) {
        cookie += `; Max-Age=${opts.maxAge}`;
      }
      if (opts.expires) {
        cookie += `; Expires=${opts.expires.toUTCString()}`;
      }
      if (opts.path) {
        cookie += `; Path=${opts.path}`;
      }
      if (opts.domain) {
        cookie += `; Domain=${opts.domain}`;
      }
      if (opts.secure) {
        cookie += '; Secure';
      }
      if (opts.httpOnly) {
        cookie += '; HttpOnly';
      }
      if (opts.sameSite) {
        cookie += `; SameSite=${opts.sameSite}`;
      }

      this.setHeader('Set-Cookie', cookie);
      return this;
    };

    enhanced.clearCookie = function (
      name: string,
      options?: any
    ): NextRushResponse {
      const opts = { ...options, expires: new Date(1), maxAge: 0 };
      return this.cookie(name, '', opts);
    };

    // File operations
    enhanced.sendFile = function (filePath: string, options?: any): void {
      const opts = options || {};

      fs.readFile(filePath)
        .then((data) => {
          // Set content type based on file extension
          const ext = path.extname(filePath).toLowerCase();
          const contentType = this.getContentTypeFromExtension(ext);
          this.setHeader('Content-Type', contentType);

          if (opts.cacheControl) {
            this.setHeader('Cache-Control', opts.cacheControl);
          }

          this.end(data);
        })
        .catch((error) => {
          this.statusCode = 404;
          this.end('File not found');
        });
    };

    enhanced.download = function (
      filePath: string,
      filename?: string,
      options?: any
    ): void {
      const downloadName = filename || path.basename(filePath);
      this.setHeader(
        'Content-Disposition',
        `attachment; filename="${downloadName}"`
      );
      this.sendFile(filePath, options);
    };

    // Redirection
    enhanced.redirect = function (url: string, status: number = 302): void {
      this.statusCode = status;
      this.setHeader('Location', url);
      this.end();
    };

    // 🚀 NEW: Cache control methods
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

    // 🚀 NEW: CORS methods
    enhanced.cors = function (origin?: string): NextRushResponse {
      this.setHeader('Access-Control-Allow-Origin', origin || '*');
      this.setHeader(
        'Access-Control-Allow-Methods',
        'GET,HEAD,PUT,PATCH,POST,DELETE'
      );
      this.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
      );
      return this;
    };

    // 🚀 NEW: Security headers
    enhanced.security = function (): NextRushResponse {
      this.setHeader('X-Frame-Options', 'DENY');
      this.setHeader('X-XSS-Protection', '1; mode=block');
      this.setHeader('X-Content-Type-Options', 'nosniff');
      this.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      return this;
    };

    // 🚀 NEW: Compression hint
    enhanced.compress = function (): NextRushResponse {
      this.setHeader('Content-Encoding', 'gzip');
      return this;
    };

    // 🚀 NEW: Response timing
    enhanced.time = function (label?: string): NextRushResponse {
      const timestamp = Date.now();
      this.setHeader('X-Response-Time', `${timestamp}`);
      if (label) {
        this.setHeader('X-Response-Label', label);
      }
      return this;
    };

    // Helper method for content type detection
    enhanced.getContentTypeFromExtension = function (ext: string): string {
      const mimeTypes: Record<string, string> = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
        '.xml': 'application/xml',
        '.zip': 'application/zip',
      };
      return mimeTypes[ext] || 'application/octet-stream';
    };

    // 🚀 Template rendering (if template manager is available)
    if (context?.templateManager) {
      enhanced.render = async function (
        templatePath: string,
        data?: any,
        options?: any
      ): Promise<void> {
        try {
          const html = await context.templateManager.render(
            templatePath,
            data,
            options
          );
          this.html(html);
        } catch (error) {
          this.statusCode = 500;
          this.text('Template rendering error');
        }
      };
    }

    return enhanced;
  }
}
