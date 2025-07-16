/**
 * 🚀 NextRush Static File Middleware
 * Professional static file serving with advanced features
 * Zero dependencies, maximum performance
 */

import * as crypto from 'crypto';
import { promises as fs, constants as fsConstants } from 'fs';
import { ServerResponse } from 'http';
import * as path from 'path';
import { NextRushRequest, NextRushResponse } from '../types/express';

export interface StaticOptions {
  // Cache options
  maxAge?: string | number;
  etag?: boolean;
  lastModified?: boolean;
  immutable?: boolean;

  // File serving options
  index?: string | string[] | false;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  extensions?: string[] | false;
  redirect?: boolean;
  fallthrough?: boolean;

  // Security options
  acceptRanges?: boolean;
  cacheControl?: boolean;

  // Advanced options
  spa?: boolean; // Single Page App support
  setHeaders?: (res: ServerResponse, filePath: string, stat: any) => void;

  // Performance options
  maxFileSize?: number;
  compressionThreshold?: number;
}

export interface StaticFileInfo {
  path: string;
  stat: any;
  etag: string | undefined;
  lastModified: string | undefined;
  contentType: string;
  size: number;
}

/**
 * Professional static file middleware
 */
export class StaticFileMiddleware {
  private options: Required<StaticOptions>;
  private root: string;
  private mountPath: string;

  constructor(mountPath: string, root: string, options: StaticOptions = {}) {
    this.mountPath = mountPath.endsWith('/')
      ? mountPath.slice(0, -1)
      : mountPath;
    this.root = path.resolve(root);
    this.options = {
      maxAge: options.maxAge || 0,
      etag: options.etag !== false,
      lastModified: options.lastModified !== false,
      immutable: options.immutable || false,
      index: options.index !== false ? options.index || ['index.html'] : false,
      dotfiles: options.dotfiles || 'ignore',
      extensions: options.extensions || false,
      redirect: options.redirect !== false,
      fallthrough: options.fallthrough !== false,
      acceptRanges: options.acceptRanges !== false,
      cacheControl: options.cacheControl !== false,
      spa: options.spa || false,
      setHeaders: options.setHeaders || (() => {}),
      maxFileSize: options.maxFileSize || 50 * 1024 * 1024, // 50MB
      compressionThreshold: options.compressionThreshold || 1024,
    };
  }

  /**
   * Create middleware function
   */
  middleware() {
    return async (
      req: NextRushRequest,
      res: NextRushResponse,
      next: () => void
    ): Promise<void> => {
      // Only handle GET and HEAD requests
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        if (this.options.fallthrough) {
          return next();
        }
        return this.sendError(res, 405, 'Method not allowed');
      }

      const urlPath = req.path || req.url || '';

      // Check if this request is for our mount path
      if (!urlPath.startsWith(this.mountPath)) {
        return next();
      }

      // Get relative path from mount point
      const relativePath = urlPath.slice(this.mountPath.length) || '/';

      try {
        const fileInfo = await this.resolveFile(relativePath);

        if (!fileInfo) {
          // SPA fallback - serve index.html for unmatched routes
          if (this.options.spa && this.options.index) {
            const indexFiles = Array.isArray(this.options.index)
              ? this.options.index
              : [this.options.index];
            for (const indexFile of indexFiles) {
              const indexInfo = await this.resolveFile(`/${indexFile}`);
              if (indexInfo) {
                return this.serveFile(req, res, indexInfo);
              }
            }
          }

          if (this.options.fallthrough) {
            return next();
          }
          return this.sendError(res, 404, 'File not found');
        }

        // Check if client has fresh content
        if (this.isFresh(req, fileInfo)) {
          res.statusCode = 304;
          res.end();
          return;
        }

        await this.serveFile(req, res, fileInfo);
      } catch (error) {
        console.error('Static file error:', error);
        if (this.options.fallthrough) {
          return next();
        }
        return this.sendError(res, 500, 'Internal server error');
      }
    };
  }

  /**
   * Resolve file path and get file info
   */
  private async resolveFile(
    relativePath: string
  ): Promise<StaticFileInfo | null> {
    // Normalize and secure the path
    const normalizedPath = path
      .normalize(relativePath)
      .replace(/^(\.\.[/\\])+/, '');
    let filePath = path.join(this.root, normalizedPath);

    // Security check - ensure path is within root
    if (!filePath.startsWith(this.root)) {
      return null;
    }

    try {
      let stat = await fs.stat(filePath);

      // If it's a directory, look for index files
      if (stat.isDirectory()) {
        if (!this.options.index) {
          return null;
        }

        const indexFiles = Array.isArray(this.options.index)
          ? this.options.index
          : [this.options.index];

        for (const indexFile of indexFiles) {
          const indexPath = path.join(filePath, indexFile);
          try {
            const indexStat = await fs.stat(indexPath);
            if (indexStat.isFile()) {
              filePath = indexPath;
              stat = indexStat;
              break;
            }
          } catch {
            continue;
          }
        }

        // If no index file found and redirect is enabled
        if (
          stat.isDirectory() &&
          this.options.redirect &&
          !relativePath.endsWith('/')
        ) {
          return null; // Will be handled by redirect logic
        }
      }

      // Check if it's a file
      if (!stat.isFile()) {
        return null;
      }

      // Check file size
      if (stat.size > this.options.maxFileSize) {
        throw new Error('File too large');
      }

      // Handle dotfiles
      const fileName = path.basename(filePath);
      if (fileName.startsWith('.')) {
        if (this.options.dotfiles === 'deny') {
          throw new Error('Access denied');
        }
        if (this.options.dotfiles === 'ignore') {
          return null;
        }
      }

      // Try extensions if file doesn't exist
      if (this.options.extensions && this.options.extensions.length > 0) {
        let found = false;
        try {
          await fs.access(filePath, fsConstants.F_OK);
          found = true;
        } catch {
          // Try with extensions
          for (const ext of this.options.extensions) {
            try {
              const extPath =
                filePath + (ext.startsWith('.') ? ext : '.' + ext);
              const extStat = await fs.stat(extPath);
              if (extStat.isFile()) {
                filePath = extPath;
                stat = extStat;
                found = true;
                break;
              }
            } catch {
              continue;
            }
          }
        }

        if (!found) {
          return null;
        }
      }

      const contentType = this.getContentType(filePath);
      const etag = this.options.etag ? this.generateETag(stat) : undefined;
      const lastModified = this.options.lastModified
        ? stat.mtime.toUTCString()
        : undefined;

      return {
        path: filePath,
        stat,
        etag,
        lastModified,
        contentType,
        size: stat.size,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Serve the file to client
   */
  private async serveFile(
    req: NextRushRequest,
    res: NextRushResponse,
    fileInfo: StaticFileInfo
  ): Promise<void> {
    // Set content type
    res.setHeader('Content-Type', fileInfo.contentType);
    res.setHeader('Content-Length', fileInfo.size);

    // Set cache headers
    if (this.options.cacheControl) {
      const maxAge =
        typeof this.options.maxAge === 'string'
          ? this.parseMaxAge(this.options.maxAge)
          : this.options.maxAge;

      const cacheControl = [`max-age=${Math.floor(maxAge / 1000)}`];

      if (this.options.immutable) {
        cacheControl.push('immutable');
      }

      res.setHeader('Cache-Control', cacheControl.join(', '));
    }

    // Set ETag
    if (fileInfo.etag) {
      res.setHeader('ETag', fileInfo.etag);
    }

    // Set Last-Modified
    if (fileInfo.lastModified) {
      res.setHeader('Last-Modified', fileInfo.lastModified);
    }

    // Set Accept-Ranges
    if (this.options.acceptRanges) {
      res.setHeader('Accept-Ranges', 'bytes');
    }

    // Custom headers
    this.options.setHeaders(res, fileInfo.path, fileInfo.stat);

    // Handle HEAD requests
    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    // Handle Range requests
    const range = req.headers.range;
    if (range && this.options.acceptRanges) {
      const ranges = this.parseRange(range, fileInfo.size);
      if (ranges && ranges.length === 1) {
        const { start, end } = ranges[0];
        res.statusCode = 206;
        res.setHeader(
          'Content-Range',
          `bytes ${start}-${end}/${fileInfo.size}`
        );
        res.setHeader('Content-Length', end - start + 1);

        const stream = (await import('fs')).createReadStream(fileInfo.path, {
          start,
          end,
        });
        stream.pipe(res);
        return;
      }
    }

    // Stream the file
    const stream = (await import('fs')).createReadStream(fileInfo.path);
    stream.pipe(res);
  }

  /**
   * Check if client has fresh content
   */
  private isFresh(req: NextRushRequest, fileInfo: StaticFileInfo): boolean {
    const ifNoneMatch = req.headers['if-none-match'];
    const ifModifiedSince = req.headers['if-modified-since'];

    // Check ETag
    if (ifNoneMatch && fileInfo.etag) {
      return ifNoneMatch === fileInfo.etag;
    }

    // Check Last-Modified
    if (ifModifiedSince && fileInfo.lastModified) {
      return new Date(ifModifiedSince) >= new Date(fileInfo.lastModified);
    }

    return false;
  }

  /**
   * Generate ETag for file
   */
  private generateETag(stat: any): string {
    const hash = crypto.createHash('md5');
    hash.update(`${stat.size}-${stat.mtime.getTime()}`);
    return `"${hash.digest('hex')}"`;
  }

  /**
   * Get content type for file
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    const mimeTypes: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.htm': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.mjs': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.xml': 'application/xml; charset=utf-8',
      '.txt': 'text/plain; charset=utf-8',
      '.md': 'text/markdown; charset=utf-8',

      // Images
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',

      // Fonts
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.otf': 'font/otf',
      '.eot': 'application/vnd.ms-fontobject',

      // Documents
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

      // Archives
      '.zip': 'application/zip',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',

      // Media
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.webm': 'video/webm',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Parse max age string to milliseconds
   */
  private parseMaxAge(maxAge: string): number {
    const units: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000,
      y: 365 * 24 * 60 * 60 * 1000,
    };

    const match = maxAge.match(/^(\d+)([smhdwy]?)$/);
    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2] || 's';

    return value * (units[unit] || 1000);
  }

  /**
   * Parse Range header
   */
  private parseRange(
    rangeHeader: string,
    fileSize: number
  ): Array<{ start: number; end: number }> | null {
    const ranges = [];
    const rangeMatch = rangeHeader.match(/bytes=(.+)/);

    if (!rangeMatch) return null;

    const rangeSpecs = rangeMatch[1].split(',');

    for (const spec of rangeSpecs) {
      const range = spec.trim().split('-');
      let start = parseInt(range[0]);
      let end = parseInt(range[1]);

      if (isNaN(start) && isNaN(end)) {
        return null;
      }

      if (isNaN(start)) {
        start = fileSize - end;
        end = fileSize - 1;
      } else if (isNaN(end)) {
        end = fileSize - 1;
      }

      if (start >= fileSize || end >= fileSize || start > end) {
        return null;
      }

      ranges.push({ start, end });
    }

    return ranges.length > 0 ? ranges : null;
  }

  /**
   * Send error response
   */
  private sendError(
    res: NextRushResponse,
    code: number,
    message: string
  ): void {
    res.statusCode = code;
    res.setHeader('Content-Type', 'text/plain');
    res.end(message);
  }
}

/**
 * Create static file middleware
 */
export function createStaticMiddleware(
  mountPath: string,
  root: string,
  options: StaticOptions = {}
) {
  const middleware = new StaticFileMiddleware(mountPath, root, options);
  return middleware.middleware();
}
