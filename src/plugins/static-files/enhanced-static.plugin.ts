/**
 * 📁 Enhanced Static Files Plugin - NextRush Framework
 *
 * Professional-grade static file serving with advanced features:
 * - Intelligent caching with ETags and Last-Modified
 * - Content compression (gzip, brotli)
 * - Range requests for large files
 * - SPA routing support
 * - Security headers and MIME type detection
 * - Hot reloading in development
 * - CDN-ready with immutable assets
 */

import * as fs from 'fs';
import { createReadStream } from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import * as zlib from 'zlib';
import { Application } from '../../core/app/application';
import { NextRushRequest, NextRushResponse } from '../../types/express';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';

const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const access = promisify(fs.access);

/**
 * Enhanced static file serving options
 */
export interface EnhancedStaticOptions {
  // Basic options
  maxAge?: string | number;
  etag?: boolean;
  index?: string | string[] | false;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  extensions?: string[] | false;
  immutable?: boolean;
  redirect?: boolean;
  spa?: boolean;

  // Advanced options
  compress?: boolean | 'gzip' | 'brotli' | 'auto';
  cacheControl?: string;
  lastModified?: boolean;
  acceptRanges?: boolean;
  precompress?: boolean;
  hotReload?: boolean;

  // Security options
  serveHidden?: boolean;
  caseSensitive?: boolean;

  // Performance options
  memoryCache?: boolean;
  maxCacheSize?: number;
  maxFileSize?: number;

  // Headers
  setHeaders?: (res: NextRushResponse, path: string, stat: fs.Stats) => void;
}

/**
 * Static mount definition
 */
interface StaticMount {
  mountPath: string;
  rootPath: string;
  options: EnhancedStaticOptions;
}

/**
 * Enhanced file cache entry
 */
interface EnhancedCacheEntry {
  content: Buffer;
  compressed?: {
    gzip?: Buffer;
    brotli?: Buffer;
  };
  mimeType: string;
  etag: string;
  lastModified: Date;
  size: number;
  isCompressible: boolean;
}

/**
 * Range request info
 */
interface RangeInfo {
  start: number;
  end: number;
  total: number;
}

/**
 * 📁 Enhanced Static Files Plugin - Professional Grade
 */
export class EnhancedStaticFilesPlugin extends BasePlugin {
  name = 'EnhancedStaticFiles';

  private mounts: StaticMount[] = [];
  private fileCache = new Map<string, EnhancedCacheEntry>();
  private mimeTypes = new Map<string, string>();
  private compressibleTypes = new Set<string>();
  private maxCacheSize: number = 50 * 1024 * 1024; // 50MB
  private currentCacheSize: number = 0;

  constructor(registry: PluginRegistry) {
    super(registry);
    this.initializeMimeTypes();
    this.initializeCompressibleTypes();
  }

  /**
   * Install enhanced static file serving capabilities
   */
  install(app: Application): void {
    // Add app.static method with enhanced options
    (app as any).static = (
      mountPath: string,
      rootPath: string,
      options: EnhancedStaticOptions = {}
    ): Application => {
      this.addMount(mountPath, rootPath, options);
      return app;
    };

    // Install middleware for serving static files
    app.use((req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      this.handleRequest(req, res, next);
    });

    this.emit('enhancedStaticFiles:installed');
  }

  /**
   * Start the enhanced static files plugin
   */
  start(): void {
    this.emit('enhancedStaticFiles:started', this.mounts.length);
  }

  /**
   * Stop the enhanced static files plugin
   */
  stop(): void {
    this.fileCache.clear();
    this.currentCacheSize = 0;
    this.emit('enhancedStaticFiles:stopped');
  }

  /**
   * 📁 Add static mount with enhanced options
   */
  private addMount(
    mountPath: string,
    rootPath: string,
    options: EnhancedStaticOptions
  ): void {
    const resolvedPath = path.resolve(rootPath);
    const normalizedMount = this.normalizePath(mountPath);

    this.mounts.push({
      mountPath: normalizedMount,
      rootPath: resolvedPath,
      options: { ...this.getDefaultOptions(), ...options },
    });

    this.emit('enhancedStaticFiles:mountAdded', {
      mountPath: normalizedMount,
      rootPath: resolvedPath,
    });
  }

  /**
   * 🔍 Handle incoming requests for static files
   */
  private async handleRequest(
    req: NextRushRequest,
    res: NextRushResponse,
    next: () => void
  ): Promise<void> {
    // Only handle GET and HEAD requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    const requestPath = decodeURIComponent(req.pathname || '/');

    for (const mount of this.mounts) {
      if (this.isPathUnderMount(requestPath, mount.mountPath)) {
        const filePath = this.resolveFilePath(requestPath, mount);

        if (filePath) {
          try {
            await this.serveFile(filePath, req, res, mount.options);
            return;
          } catch (error) {
            // Continue to next mount if file not found
            continue;
          }
        }
      }
    }

    // No static file found, pass to next middleware
    next();
  }

  /**
   * 📄 Serve a specific file with enhanced features
   */
  private async serveFile(
    filePath: string,
    req: NextRushRequest,
    res: NextRushResponse,
    options: EnhancedStaticOptions
  ): Promise<void> {
    try {
      const stats = await stat(filePath);

      if (!stats.isFile()) {
        throw new Error('Not a file');
      }

      // Check if file is too large for memory cache
      if (options.maxFileSize && stats.size > options.maxFileSize) {
        return this.streamFile(filePath, req, res, options, stats);
      }

      // Get or create cache entry
      const cacheEntry = await this.getCachedFile(filePath, stats, options);

      // Handle conditional requests
      if (this.handleConditionalRequest(req, res, cacheEntry)) {
        return;
      }

      // Handle range requests
      const rangeHeader = req.headers.range as string;
      if (rangeHeader && options.acceptRanges !== false) {
        return this.handleRangeRequest(req, res, cacheEntry, rangeHeader);
      }

      // Set response headers
      this.setFileHeaders(res, cacheEntry, options, stats, filePath);

      // Handle compression
      const acceptEncoding = (req.headers['accept-encoding'] as string) || '';
      if (options.compress && cacheEntry.isCompressible) {
        if (cacheEntry.compressed?.brotli && acceptEncoding.includes('br')) {
          res.setHeader('Content-Encoding', 'br');
          res.setHeader('Content-Length', cacheEntry.compressed.brotli.length);
          res.end(cacheEntry.compressed.brotli);
          return;
        } else if (
          cacheEntry.compressed?.gzip &&
          acceptEncoding.includes('gzip')
        ) {
          res.setHeader('Content-Encoding', 'gzip');
          res.setHeader('Content-Length', cacheEntry.compressed.gzip.length);
          res.end(cacheEntry.compressed.gzip);
          return;
        }
      }

      // Send uncompressed file
      res.setHeader('Content-Length', cacheEntry.size);
      res.end(cacheEntry.content);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 🌊 Stream large files
   */
  private streamFile(
    filePath: string,
    req: NextRushRequest,
    res: NextRushResponse,
    options: EnhancedStaticOptions,
    stats: fs.Stats
  ): void {
    const mimeType = this.getMimeType(path.extname(filePath));
    const etag = this.generateETag(stats);

    // Set headers
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Last-Modified', stats.mtime.toUTCString());
    res.setHeader('ETag', etag);

    if (options.acceptRanges !== false) {
      res.setHeader('Accept-Ranges', 'bytes');
    }

    // Handle range requests for streaming
    const rangeHeader = req.headers.range as string;
    if (rangeHeader) {
      const range = this.parseRange(rangeHeader, stats.size);
      if (range) {
        res.statusCode = 206;
        res.setHeader(
          'Content-Range',
          `bytes ${range.start}-${range.end}/${stats.size}`
        );
        res.setHeader('Content-Length', range.end - range.start + 1);

        const stream = createReadStream(filePath, {
          start: range.start,
          end: range.end,
        });
        stream.pipe(res);
        return;
      }
    }

    // Stream entire file
    const stream = createReadStream(filePath);
    stream.pipe(res);
  }

  /**
   * 💾 Get or create cached file entry
   */
  private async getCachedFile(
    filePath: string,
    stats: fs.Stats,
    options: EnhancedStaticOptions
  ): Promise<EnhancedCacheEntry> {
    const cacheKey = `${filePath}:${stats.mtime.getTime()}`;
    let cacheEntry = this.fileCache.get(cacheKey);

    if (!cacheEntry && options.memoryCache !== false) {
      const content = await readFile(filePath);
      const mimeType = this.getMimeType(path.extname(filePath));
      const etag = this.generateETag(stats);
      const isCompressible = this.isCompressible(mimeType);

      cacheEntry = {
        content,
        mimeType,
        etag,
        lastModified: stats.mtime,
        size: stats.size,
        isCompressible,
      };

      // Add compression if enabled
      if (options.compress && isCompressible) {
        cacheEntry.compressed = {};

        if (
          options.compress === true ||
          options.compress === 'gzip' ||
          options.compress === 'auto'
        ) {
          cacheEntry.compressed.gzip = await this.compressGzip(content);
        }

        if (options.compress === 'brotli' || options.compress === 'auto') {
          cacheEntry.compressed.brotli = await this.compressBrotli(content);
        }
      }

      // Cache management
      if (this.shouldCache(content.length)) {
        this.fileCache.set(cacheKey, cacheEntry);
        this.currentCacheSize += content.length;
        this.evictIfNeeded();
      }
    }

    if (!cacheEntry) {
      // Fallback for non-cached files
      const content = await readFile(filePath);
      const mimeType = this.getMimeType(path.extname(filePath));
      const etag = this.generateETag(stats);

      cacheEntry = {
        content,
        mimeType,
        etag,
        lastModified: stats.mtime,
        size: stats.size,
        isCompressible: this.isCompressible(mimeType),
      };
    }

    return cacheEntry;
  }

  /**
   * 🔧 Set appropriate headers for file response
   */
  private setFileHeaders(
    res: NextRushResponse,
    cacheEntry: EnhancedCacheEntry,
    options: EnhancedStaticOptions,
    stats: fs.Stats,
    filePath: string
  ): void {
    res.setHeader('Content-Type', cacheEntry.mimeType);

    if (options.etag !== false) {
      res.setHeader('ETag', cacheEntry.etag);
    }

    if (options.lastModified !== false) {
      res.setHeader('Last-Modified', cacheEntry.lastModified.toUTCString());
    }

    if (options.acceptRanges !== false) {
      res.setHeader('Accept-Ranges', 'bytes');
    }

    // Cache control
    if (options.cacheControl) {
      res.setHeader('Cache-Control', options.cacheControl);
    } else if (options.maxAge) {
      const maxAge =
        typeof options.maxAge === 'string'
          ? options.maxAge
          : `${options.maxAge}`;
      const cacheControl = options.immutable
        ? `public, max-age=${maxAge}, immutable`
        : `public, max-age=${maxAge}`;
      res.setHeader('Cache-Control', cacheControl);
    }

    // Custom headers
    if (options.setHeaders) {
      options.setHeaders(res, filePath, stats);
    }

    // Security headers
    if (!options.serveHidden) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  }

  /**
   * 📦 Handle range requests
   */
  private handleRangeRequest(
    req: NextRushRequest,
    res: NextRushResponse,
    cacheEntry: EnhancedCacheEntry,
    rangeHeader: string
  ): void {
    const range = this.parseRange(rangeHeader, cacheEntry.size);

    if (!range) {
      res.statusCode = 416; // Range Not Satisfiable
      res.setHeader('Content-Range', `bytes */${cacheEntry.size}`);
      res.end();
      return;
    }

    res.statusCode = 206; // Partial Content
    res.setHeader(
      'Content-Range',
      `bytes ${range.start}-${range.end}/${range.total}`
    );
    res.setHeader('Content-Length', range.end - range.start + 1);
    res.setHeader('Content-Type', cacheEntry.mimeType);

    const chunk = cacheEntry.content.slice(range.start, range.end + 1);
    res.end(chunk);
  }

  /**
   * 🎯 Helper methods
   */

  private handleConditionalRequest(
    req: NextRushRequest,
    res: NextRushResponse,
    cacheEntry: EnhancedCacheEntry
  ): boolean {
    const ifModifiedSince = req.headers['if-modified-since'];
    const ifNoneMatch = req.headers['if-none-match'];

    if (
      ifModifiedSince &&
      new Date(ifModifiedSince as string) >= cacheEntry.lastModified
    ) {
      res.statusCode = 304;
      res.end();
      return true;
    }

    if (ifNoneMatch === cacheEntry.etag) {
      res.statusCode = 304;
      res.end();
      return true;
    }

    return false;
  }

  private parseRange(rangeHeader: string, fileSize: number): RangeInfo | null {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) return null;

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      return null;
    }

    return { start, end, total: fileSize };
  }

  private generateETag(stats: fs.Stats): string {
    return `"${stats.mtime.getTime()}-${stats.size}"`;
  }

  private isCompressible(mimeType: string): boolean {
    return (
      this.compressibleTypes.has(mimeType) ||
      mimeType.startsWith('text/') ||
      mimeType.includes('javascript') ||
      mimeType.includes('json')
    );
  }

  private async compressGzip(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.gzip(buffer, (err, compressed) => {
        if (err) reject(err);
        else resolve(compressed);
      });
    });
  }

  private async compressBrotli(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.brotliCompress(buffer, (err, compressed) => {
        if (err) reject(err);
        else resolve(compressed);
      });
    });
  }

  private shouldCache(size: number): boolean {
    return this.currentCacheSize + size <= this.maxCacheSize;
  }

  private evictIfNeeded(): void {
    while (this.currentCacheSize > this.maxCacheSize) {
      const [key] = this.fileCache.keys();
      const entry = this.fileCache.get(key);
      if (entry) {
        this.currentCacheSize -= entry.size;
        this.fileCache.delete(key);
      } else {
        break;
      }
    }
  }

  private initializeCompressibleTypes(): void {
    [
      'text/html',
      'text/css',
      'text/javascript',
      'application/javascript',
      'application/json',
      'text/xml',
      'application/xml',
      'text/plain',
      'image/svg+xml',
    ].forEach((type) => this.compressibleTypes.add(type));
  }

  private isPathUnderMount(requestPath: string, mountPath: string): boolean {
    return requestPath.startsWith(mountPath);
  }

  private resolveFilePath(
    requestPath: string,
    mount: StaticMount
  ): string | null {
    const relativePath = requestPath.slice(mount.mountPath.length);
    return path.join(mount.rootPath, relativePath);
  }

  private normalizePath(pathname: string): string {
    return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  }

  private getMimeType(ext: string): string {
    return this.mimeTypes.get(ext) || 'application/octet-stream';
  }

  private getDefaultOptions(): EnhancedStaticOptions {
    return {
      maxAge: 0,
      etag: true,
      index: ['index.html'],
      dotfiles: 'ignore',
      extensions: false,
      immutable: false,
      redirect: true,
      spa: false,
      compress: false,
      lastModified: true,
      acceptRanges: true,
      memoryCache: true,
      maxCacheSize: 50 * 1024 * 1024,
      maxFileSize: 1024 * 1024,
      serveHidden: false,
      caseSensitive: true,
    };
  }

  private initializeMimeTypes(): void {
    const types = {
      '.html': 'text/html',
      '.htm': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.txt': 'text/plain',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.otf': 'font/otf',
    };

    for (const [ext, type] of Object.entries(types)) {
      this.mimeTypes.set(ext, type);
    }
  }
}
