/**
 * 🚀 NextRush Professional Static Files Middleware
 * Enterprise-grade static file serving with SPA support, caching, and security
 */

import { createHash } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import * as path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';

const pipelineAsync = promisify(pipeline);

export interface StaticOptions {
  /** Root directory to serve files from */
  root?: string;
  /** Enable directory listing */
  index?: boolean | string[];
  /** Default index files */
  indexFiles?: string[];
  /** Enable SPA mode (fallback to index.html) */
  spa?: boolean;
  /** SPA fallback file */
  spaFile?: string;
  /** Enable caching */
  cache?: boolean;
  /** Cache max age in seconds */
  maxAge?: number;
  /** Enable ETag generation */
  etag?: boolean;
  /** Enable compression */
  compress?: boolean;
  /** Enable range requests */
  ranges?: boolean;
  /** File extensions to serve */
  extensions?: string[];
  /** Custom headers */
  headers?: Record<string, string>;
  /** Enable security headers */
  security?: boolean;
  /** Enable dotfiles serving */
  dotfiles?: 'allow' | 'deny' | 'ignore';
  /** Custom 404 handler */
  notFound?: (req: IncomingMessage, res: ServerResponse) => void;
  /** File filter function */
  filter?: (filePath: string) => boolean;
}

export interface FileInfo {
  path: string;
  size: number;
  mtime: Date;
  etag: string;
  contentType: string;
  isDirectory: boolean;
}

/**
 * 📁 Professional File Server
 */
export class FileServer {
  private options: Required<StaticOptions>;
  private cache = new Map<string, FileInfo>();

  constructor(options: StaticOptions = {}) {
    this.options = {
      root: options.root || './public',
      index: options.index !== false,
      indexFiles: options.indexFiles || ['index.html', 'index.htm'],
      spa: options.spa || false,
      spaFile: options.spaFile || 'index.html',
      cache: options.cache !== false,
      maxAge: options.maxAge || 3600,
      etag: options.etag !== false,
      compress: options.compress || false,
      ranges: options.ranges !== false,
      extensions: options.extensions || [],
      headers: options.headers || {},
      security: options.security !== false,
      dotfiles: options.dotfiles || 'ignore',
      notFound: options.notFound || this.defaultNotFound.bind(this),
      filter: options.filter || (() => true),
      ...options,
    };
  }

  /**
   * Main middleware function
   */
  middleware() {
    return async (
      req: IncomingMessage,
      res: ServerResponse,
      next?: Function
    ) => {
      try {
        const served = await this.serve(req, res);
        if (!served && next) {
          next();
        }
      } catch (error) {
        if (next) {
          next(error);
        } else {
          this.handleError(res, error);
        }
      }
    };
  }

  /**
   * Serve a static file
   */
  async serve(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const method = req.method?.toLowerCase();
    if (method !== 'get' && method !== 'head') {
      return false;
    }

    const urlPath = this.parseUrl(req.url || '/');
    const filePath = this.resolvePath(urlPath);

    // Security check
    if (!this.isPathSafe(filePath)) {
      this.sendError(res, 403, 'Forbidden');
      return true;
    }

    // Check file filter
    if (!this.options.filter(filePath)) {
      return false;
    }

    try {
      const fileInfo = await this.getFileInfo(filePath);

      // Handle directories
      if (fileInfo.isDirectory) {
        return await this.handleDirectory(req, res, filePath, urlPath);
      }

      // Serve file
      return await this.serveFile(req, res, fileInfo);
    } catch (error) {
      // Try SPA fallback
      if (this.options.spa && urlPath !== '/' && !path.extname(urlPath)) {
        return await this.serveSpaFallback(req, res);
      }

      return false;
    }
  }

  /**
   * Parse URL and decode
   */
  private parseUrl(url: string): string {
    try {
      const parsed = new URL(url, 'http://localhost');
      return decodeURIComponent(parsed.pathname);
    } catch {
      return '/';
    }
  }

  /**
   * Resolve file path
   */
  private resolvePath(urlPath: string): string {
    // Remove leading slash and resolve
    const relativePath = urlPath.replace(/^\/+/, '');
    return path.resolve(this.options.root, relativePath);
  }

  /**
   * Check if path is safe (no directory traversal)
   */
  private isPathSafe(filePath: string): boolean {
    const rootPath = path.resolve(this.options.root);
    const resolvedPath = path.resolve(filePath);

    // Check if file is within root directory
    if (!resolvedPath.startsWith(rootPath)) {
      return false;
    }

    // Check dotfiles
    if (this.options.dotfiles !== 'allow') {
      const basename = path.basename(resolvedPath);
      if (basename.startsWith('.')) {
        return this.options.dotfiles === 'ignore' ? false : false;
      }
    }

    return true;
  }

  /**
   * Get file information with caching
   */
  private async getFileInfo(filePath: string): Promise<FileInfo> {
    if (this.options.cache && this.cache.has(filePath)) {
      const cached = this.cache.get(filePath)!;

      // Validate cache by checking mtime
      try {
        const stats = await fs.stat(filePath);
        if (stats.mtime.getTime() === cached.mtime.getTime()) {
          return cached;
        }
      } catch {
        // File doesn't exist anymore
        this.cache.delete(filePath);
        throw new Error('File not found');
      }
    }

    const stats = await fs.stat(filePath);
    const fileInfo: FileInfo = {
      path: filePath,
      size: stats.size,
      mtime: stats.mtime,
      etag: this.generateETag(stats),
      contentType: this.getContentType(filePath),
      isDirectory: stats.isDirectory(),
    };

    if (this.options.cache) {
      this.cache.set(filePath, fileInfo);
    }

    return fileInfo;
  }

  /**
   * Handle directory requests
   */
  private async handleDirectory(
    req: IncomingMessage,
    res: ServerResponse,
    dirPath: string,
    urlPath: string
  ): Promise<boolean> {
    // Try index files
    if (this.options.index) {
      const indexFiles = Array.isArray(this.options.index)
        ? this.options.index
        : this.options.indexFiles;

      for (const indexFile of indexFiles) {
        const indexPath = path.join(dirPath, indexFile);
        try {
          const fileInfo = await this.getFileInfo(indexPath);
          if (!fileInfo.isDirectory) {
            return await this.serveFile(req, res, fileInfo);
          }
        } catch {
          // Index file doesn't exist, continue
        }
      }
    }

    // Directory listing (if enabled)
    if (this.options.index && Array.isArray(this.options.index)) {
      return await this.serveDirectoryListing(res, dirPath, urlPath);
    }

    return false;
  }

  /**
   * Serve a file
   */
  private async serveFile(
    req: IncomingMessage,
    res: ServerResponse,
    fileInfo: FileInfo
  ): Promise<boolean> {
    // Set headers
    this.setHeaders(res, fileInfo);

    // Check if-none-match (ETag)
    if (this.options.etag && req.headers['if-none-match'] === fileInfo.etag) {
      res.statusCode = 304;
      res.end();
      return true;
    }

    // Check if-modified-since
    const ifModifiedSince = req.headers['if-modified-since'];
    if (ifModifiedSince) {
      const modifiedSince = new Date(ifModifiedSince);
      if (fileInfo.mtime <= modifiedSince) {
        res.statusCode = 304;
        res.end();
        return true;
      }
    }

    // Handle HEAD requests
    if (req.method?.toLowerCase() === 'head') {
      res.end();
      return true;
    }

    // Handle range requests
    if (this.options.ranges && req.headers.range) {
      return await this.serveRange(req, res, fileInfo);
    }

    // Serve full file
    res.statusCode = 200;

    try {
      const stream = createReadStream(fileInfo.path);
      await pipelineAsync(stream, res);
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Serve range request
   */
  private async serveRange(
    req: IncomingMessage,
    res: ServerResponse,
    fileInfo: FileInfo
  ): Promise<boolean> {
    const range = req.headers.range!;
    const match = range.match(/bytes=(\d+)-(\d*)/);

    if (!match) {
      res.statusCode = 416;
      res.setHeader('Content-Range', `bytes */${fileInfo.size}`);
      res.end();
      return true;
    }

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : fileInfo.size - 1;

    if (start >= fileInfo.size || end >= fileInfo.size) {
      res.statusCode = 416;
      res.setHeader('Content-Range', `bytes */${fileInfo.size}`);
      res.end();
      return true;
    }

    const chunkSize = end - start + 1;

    res.statusCode = 206;
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileInfo.size}`);
    res.setHeader('Content-Length', chunkSize.toString());
    res.setHeader('Accept-Ranges', 'bytes');

    try {
      const stream = createReadStream(fileInfo.path, { start, end });
      await pipelineAsync(stream, res);
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Serve SPA fallback
   */
  private async serveSpaFallback(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<boolean> {
    const spaPath = path.resolve(this.options.root, this.options.spaFile);

    try {
      const fileInfo = await this.getFileInfo(spaPath);
      return await this.serveFile(req, res, fileInfo);
    } catch {
      return false;
    }
  }

  /**
   * Serve directory listing
   */
  private async serveDirectoryListing(
    res: ServerResponse,
    dirPath: string,
    urlPath: string
  ): Promise<boolean> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      const html = this.generateDirectoryHTML(entries, urlPath);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Length', Buffer.byteLength(html).toString());
      res.end(html);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate directory listing HTML
   */
  private generateDirectoryHTML(entries: any[], urlPath: string): string {
    const parentPath = urlPath === '/' ? '' : path.dirname(urlPath);

    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Directory: ${urlPath}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .entry { padding: 5px 0; }
        .dir { font-weight: bold; }
        .file { color: #666; }
        a { text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>Directory: ${urlPath}</h1>
    `;

    if (urlPath !== '/') {
      html += `<div class="entry dir"><a href="${parentPath}">..</a></div>`;
    }

    for (const entry of entries) {
      const isDir = entry.isDirectory();
      const href = path.posix.join(urlPath, entry.name);
      const className = isDir ? 'dir' : 'file';
      const name = isDir ? `${entry.name}/` : entry.name;

      html += `<div class="entry ${className}"><a href="${href}">${name}</a></div>`;
    }

    html += '</body></html>';
    return html;
  }

  /**
   * Set response headers
   */
  private setHeaders(res: ServerResponse, fileInfo: FileInfo): void {
    // Content type
    res.setHeader('Content-Type', fileInfo.contentType);
    res.setHeader('Content-Length', fileInfo.size.toString());

    // Cache headers
    if (this.options.cache) {
      res.setHeader('Cache-Control', `public, max-age=${this.options.maxAge}`);
      res.setHeader('Last-Modified', fileInfo.mtime.toUTCString());
    }

    // ETag
    if (this.options.etag) {
      res.setHeader('ETag', fileInfo.etag);
    }

    // Security headers
    if (this.options.security) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // Custom headers
    for (const [key, value] of Object.entries(this.options.headers)) {
      res.setHeader(key, value);
    }
  }

  /**
   * Generate ETag
   */
  private generateETag(stats: any): string {
    const hash = createHash('md5');
    hash.update(`${stats.size}-${stats.mtime.getTime()}`);
    return `"${hash.digest('hex')}"`;
  }

  /**
   * Get content type from file extension
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();

    const mimeTypes: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.htm': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.xml': 'application/xml; charset=utf-8',
      '.txt': 'text/plain; charset=utf-8',
      '.md': 'text/markdown; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.otf': 'font/otf',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Default 404 handler
   */
  private defaultNotFound(req: IncomingMessage, res: ServerResponse): void {
    this.sendError(res, 404, 'Not Found');
  }

  /**
   * Send error response
   */
  private sendError(
    res: ServerResponse,
    status: number,
    message: string
  ): void {
    res.statusCode = status;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(message);
  }

  /**
   * Handle errors
   */
  private handleError(res: ServerResponse, error: any): void {
    console.error('Static file server error:', error);
    this.sendError(res, 500, 'Internal Server Error');
  }

  /**
   * Clear file cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

/**
 * Create static file middleware
 */
export function createStatic(options?: StaticOptions) {
  const server = new FileServer(options);
  return server.middleware();
}

/**
 * Express-style static middleware
 */
export function serveStatic(
  root: string,
  options?: Omit<StaticOptions, 'root'>
) {
  return createStatic({ ...options, root });
}
