/**
 * 📁 Professional Static Files Plugin - NextRush Framework
 *
 * Enterprise-grade static file serving with advanced features:
 * - 🗜️ Smart compression (gzip/brotli)
 * - 💾 Intelligent memory caching
 * - 📡 Range requests for streaming
 * - 🏷️ ETag support for conditional requests
 * - 🔒 Security headers and path validation
 * - 🚀 High-performance optimization
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import * as zlib from 'zlib';
import { Application } from '../../core/app/application';
import { NextRushRequest, NextRushResponse } from '../../types/express';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';

const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

/**
 * Enhanced static file options
 */
export interface ProfessionalStaticOptions {
  // Cache control
  maxAge?: string | number;
  immutable?: boolean;
  etag?: boolean;
  lastModified?: boolean;

  // File serving
  index?: string | string[] | false;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  extensions?: string[] | false;
  redirect?: boolean;

  // Performance
  compress?: 'gzip' | 'brotli' | 'auto' | boolean;
  precompress?: boolean;
  memoryCache?: boolean;
  maxCacheSize?: number;
  maxFileSize?: number;
  acceptRanges?: boolean;

  // Security
  serveHidden?: boolean;
  caseSensitive?: boolean;

  // SPA support
  spa?: boolean | string;

  // Custom headers
  setHeaders?: (res: NextRushResponse, path: string, stat: fs.Stats) => void;
}

/**
 * Static mount configuration
 */
interface StaticMount {
  mountPath: string;
  rootPath: string;
  options: ProfessionalStaticOptions;
}

/**
 * Cache entry for memory caching
 */
interface CacheEntry {
  content: Buffer;
  compressed?: Buffer;
  mimeType: string;
  etag: string;
  lastModified: Date;
  size: number;
  compressedSize?: number;
  encoding?: string;
}

/**
 * Professional Static Files Plugin
 */
export class ProfessionalStaticPlugin extends BasePlugin {
  name = 'ProfessionalStatic';

  private mounts: StaticMount[] = [];
  private cache = new Map<string, CacheEntry>();
  private mimeTypes = new Map<string, string>();
  private compressionCache = new Map<string, Buffer>();

  // Performance tracking
  private stats = {
    totalRequests: 0,
    cacheHits: 0,
    compressionHits: 0,
    bytesServed: 0,
  };

  // Configuration
  private maxCacheSize: number = 100 * 1024 * 1024; // 100MB
  private currentCacheSize: number = 0;
  private compressionThreshold: number = 1024; // 1KB

  constructor(registry: PluginRegistry) {
    super(registry);
    this.initializeMimeTypes();
  }

  /**
   * Install the plugin
   */
  install(app: Application): void {
    // Add static method to app
    (app as any).static = (
      mountPath: string,
      rootPath: string,
      options: ProfessionalStaticOptions = {}
    ) => {
      this.addMount(mountPath, rootPath, options);
    };

    // Add middleware to handle static requests
    app.use((req, res, next) => this.handleRequest(req, res, next));

    this.emit('professionalStatic:installed');
  }

  /**
   * Start the plugin
   */
  start(): void {
    this.emit('professionalStatic:started');
  }

  /**
   * Stop the plugin
   */
  stop(): void {
    this.cache.clear();
    this.compressionCache.clear();
    this.currentCacheSize = 0;
    this.emit('professionalStatic:stopped');
  }

  /**
   * Get plugin statistics
   */
  getStats(): object {
    return {
      mounts: this.mounts.length,
      cachedFiles: this.cache.size,
      cacheSize: this.currentCacheSize,
      compressionCache: this.compressionCache.size,
      performance: this.stats,
    };
  }

  /**
   * Add static mount
   */
  private addMount(
    mountPath: string,
    rootPath: string,
    options: ProfessionalStaticOptions
  ): void {
    const normalizedMountPath = this.normalizePath(mountPath);
    const resolvedRootPath = path.resolve(rootPath);

    this.mounts.push({
      mountPath: normalizedMountPath,
      rootPath: resolvedRootPath,
      options: { ...this.getDefaultOptions(), ...options },
    });

    this.emit(
      'professionalStatic:mountAdded',
      normalizedMountPath,
      resolvedRootPath
    );
  }

  /**
   * Handle incoming requests
   */
  private async handleRequest(
    req: NextRushRequest,
    res: NextRushResponse,
    next: () => void
  ): Promise<void> {
    try {
      this.stats.totalRequests++;

      for (const mount of this.mounts) {
        if (req.url?.startsWith(mount.mountPath)) {
          const served = await this.serveFromMount(req, res, mount);
          if (served) return;
        }
      }
      next();
    } catch (error) {
      next();
    }
  }

  /**
   * Serve file from mount
   */
  private async serveFromMount(
    req: NextRushRequest,
    res: NextRushResponse,
    mount: StaticMount
  ): Promise<boolean> {
    const relativePath = req.url!.substring(mount.mountPath.length);
    const filePath = path.join(mount.rootPath, relativePath);

    // Security: Validate path
    if (!this.isPathSafe(filePath, mount.rootPath)) {
      return false;
    }

    try {
      const stats = await stat(filePath);

      if (stats.isDirectory()) {
        return await this.serveDirectory(req, res, mount, filePath);
      }

      if (stats.isFile()) {
        return await this.serveFile(req, res, mount, filePath, stats);
      }
    } catch (error) {
      // File not found - try SPA fallback
      if (mount.options.spa) {
        return await this.serveSpaFallback(req, res, mount);
      }
    }

    return false;
  }

  /**
   * Serve directory with index files
   */
  private async serveDirectory(
    req: NextRushRequest,
    res: NextRushResponse,
    mount: StaticMount,
    dirPath: string
  ): Promise<boolean> {
    if (mount.options.index === false) {
      return false;
    }

    const indexFiles = Array.isArray(mount.options.index)
      ? mount.options.index
      : [mount.options.index || 'index.html'];

    for (const indexFile of indexFiles) {
      const indexPath = path.join(dirPath, indexFile);
      try {
        const stats = await stat(indexPath);
        if (stats.isFile()) {
          return await this.serveFile(req, res, mount, indexPath, stats);
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  /**
   * Serve individual file with all optimizations
   */
  private async serveFile(
    req: NextRushRequest,
    res: NextRushResponse,
    mount: StaticMount,
    filePath: string,
    stats: fs.Stats
  ): Promise<boolean> {
    const options = mount.options;

    // Check for conditional requests (ETag/If-Modified-Since)
    if (this.handleConditionalRequest(req, res, stats, options)) {
      return true;
    }

    // Try to serve from cache
    const cacheKey = this.getCacheKey(filePath, stats);
    let cacheEntry = this.cache.get(cacheKey);

    if (!cacheEntry || cacheEntry.lastModified < stats.mtime) {
      // Read and cache file
      cacheEntry = await this.createCacheEntry(filePath, stats, options);

      if (this.shouldCache(stats.size, options)) {
        this.addToCache(cacheKey, cacheEntry);
      }
    } else {
      this.stats.cacheHits++;
    }

    // Handle range requests for streaming
    if (options.acceptRanges && req.headers.range) {
      return this.handleRangeRequest(req, res, cacheEntry, options);
    }

    // Serve complete file
    this.sendFile(res, cacheEntry, options, filePath, stats);
    this.stats.bytesServed += cacheEntry.size;

    return true;
  }

  /**
   * Create cache entry with compression
   */
  private async createCacheEntry(
    filePath: string,
    stats: fs.Stats,
    options: ProfessionalStaticOptions
  ): Promise<CacheEntry> {
    const content = await readFile(filePath);
    const mimeType = this.getMimeType(filePath);
    const etag = this.generateETag(content, stats);

    const entry: CacheEntry = {
      content,
      mimeType,
      etag,
      lastModified: stats.mtime,
      size: stats.size,
    };

    // Apply compression if enabled
    if (options.compress && this.shouldCompress(content, mimeType)) {
      const compressed = await this.compressContent(content, options.compress);
      if (compressed) {
        entry.compressed = compressed;
        entry.compressedSize = compressed.length;
        entry.encoding =
          typeof options.compress === 'string' ? options.compress : 'gzip';
      }
    }

    return entry;
  }

  /**
   * Handle conditional requests (ETag, If-Modified-Since)
   */
  private handleConditionalRequest(
    req: NextRushRequest,
    res: NextRushResponse,
    stats: fs.Stats,
    options: ProfessionalStaticOptions
  ): boolean {
    if (options.etag) {
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch) {
        const etag = this.generateETag(Buffer.alloc(0), stats);
        if (ifNoneMatch === etag) {
          res.status(304).end();
          return true;
        }
      }
    }

    if (options.lastModified) {
      const ifModifiedSince = req.headers['if-modified-since'];
      if (ifModifiedSince) {
        const modifiedSince = new Date(ifModifiedSince);
        if (stats.mtime <= modifiedSince) {
          res.status(304).end();
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Handle range requests for partial content
   */
  private handleRangeRequest(
    req: NextRushRequest,
    res: NextRushResponse,
    cacheEntry: CacheEntry,
    options: ProfessionalStaticOptions
  ): boolean {
    const range = req.headers.range;
    if (!range) return false;

    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : cacheEntry.size - 1;

    if (start >= cacheEntry.size || end >= cacheEntry.size) {
      res.status(416).setHeader('Content-Range', `bytes */${cacheEntry.size}`);
      res.end();
      return true;
    }

    const chunkSize = end - start + 1;
    const chunk = cacheEntry.content.slice(start, end + 1);

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${cacheEntry.size}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', chunkSize);
    res.setHeader('Content-Type', cacheEntry.mimeType);

    res.end(chunk);
    return true;
  }

  /**
   * Send file with all headers and optimizations
   */
  private sendFile(
    res: NextRushResponse,
    cacheEntry: CacheEntry,
    options: ProfessionalStaticOptions,
    filePath: string,
    stats: fs.Stats
  ): void {
    // Determine content to send (compressed or original)
    const shouldSendCompressed =
      cacheEntry.compressed &&
      this.acceptsCompression(res.req as NextRushRequest, cacheEntry.encoding!);

    const content = shouldSendCompressed
      ? cacheEntry.compressed!
      : cacheEntry.content;
    const contentLength = shouldSendCompressed
      ? cacheEntry.compressedSize!
      : cacheEntry.size;

    // Set headers
    res.setHeader('Content-Type', cacheEntry.mimeType);
    res.setHeader('Content-Length', contentLength);

    if (shouldSendCompressed) {
      res.setHeader('Content-Encoding', cacheEntry.encoding!);
      res.setHeader('Vary', 'Accept-Encoding');
      this.stats.compressionHits++;
    }

    if (options.etag) {
      res.setHeader('ETag', cacheEntry.etag);
    }

    if (options.lastModified) {
      res.setHeader('Last-Modified', cacheEntry.lastModified.toUTCString());
    }

    if (options.acceptRanges) {
      res.setHeader('Accept-Ranges', 'bytes');
    }

    // Cache control
    if (options.maxAge) {
      const maxAge =
        typeof options.maxAge === 'number'
          ? options.maxAge
          : this.parseMaxAge(options.maxAge);
      let cacheControl = `public, max-age=${maxAge}`;
      if (options.immutable) {
        cacheControl += ', immutable';
      }
      res.setHeader('Cache-Control', cacheControl);
    }

    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Custom headers
    if (options.setHeaders) {
      options.setHeaders(res, filePath, stats);
    }

    res.end(content);
  }

  /**
   * Serve SPA fallback
   */
  private async serveSpaFallback(
    req: NextRushRequest,
    res: NextRushResponse,
    mount: StaticMount
  ): Promise<boolean> {
    const fallbackFile =
      typeof mount.options.spa === 'string' ? mount.options.spa : 'index.html';
    const fallbackPath = path.join(mount.rootPath, fallbackFile);

    try {
      const stats = await stat(fallbackPath);
      return await this.serveFile(req, res, mount, fallbackPath, stats);
    } catch (error) {
      return false;
    }
  }

  /**
   * Compress content based on settings
   */
  private async compressContent(
    content: Buffer,
    compression: string | boolean
  ): Promise<Buffer | null> {
    try {
      if (compression === 'gzip' || compression === true) {
        return await promisify(zlib.gzip)(content);
      } else if (compression === 'brotli') {
        return await promisify(zlib.brotliCompress)(content);
      } else if (compression === 'auto') {
        // Use brotli for better compression, fallback to gzip
        try {
          return await promisify(zlib.brotliCompress)(content);
        } catch {
          return await promisify(zlib.gzip)(content);
        }
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  /**
   * Check if client accepts compression
   */
  private acceptsCompression(req: NextRushRequest, encoding: string): boolean {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    return acceptEncoding.includes(encoding);
  }

  /**
   * Check if content should be compressed
   */
  private shouldCompress(content: Buffer, mimeType: string): boolean {
    if (content.length < this.compressionThreshold) return false;

    const compressibleTypes = [
      'text/',
      'application/javascript',
      'application/json',
      'application/xml',
      'image/svg+xml',
    ];

    return compressibleTypes.some((type) => mimeType.startsWith(type));
  }

  /**
   * Utility methods
   */
  private getCacheKey(filePath: string, stats: fs.Stats): string {
    return `${filePath}:${stats.mtime.getTime()}:${stats.size}`;
  }

  private generateETag(content: Buffer, stats: fs.Stats): string {
    const hash = crypto
      .createHash('md5')
      .update(`${stats.mtime.getTime()}-${stats.size}`)
      .digest('hex');
    return `"${hash}"`;
  }

  private shouldCache(
    size: number,
    options: ProfessionalStaticOptions
  ): boolean {
    if (!options.memoryCache) return false;
    if (size > (options.maxFileSize || 2 * 1024 * 1024)) return false;
    if (this.currentCacheSize + size > this.maxCacheSize) return false;
    return true;
  }

  private addToCache(key: string, entry: CacheEntry): void {
    this.cache.set(key, entry);
    this.currentCacheSize += entry.size;
    if (entry.compressed) {
      this.currentCacheSize += entry.compressedSize!;
    }
    this.emit('professionalStatic:fileCached', key, entry.size);
  }

  private parseMaxAge(maxAge: string): number {
    const units: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
      w: 604800,
      y: 31536000,
    };

    const match = maxAge.match(/^(\d+)([smhdwy]?)$/);
    if (!match) return 3600; // Default 1 hour

    const value = parseInt(match[1]);
    const unit = match[2] || 's';
    return value * (units[unit] || 1);
  }

  private isPathSafe(filePath: string, rootPath: string): boolean {
    const resolvedFilePath = path.resolve(filePath);
    const resolvedRootPath = path.resolve(rootPath);
    return resolvedFilePath.startsWith(resolvedRootPath);
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return this.mimeTypes.get(ext) || 'application/octet-stream';
  }

  private normalizePath(mountPath: string): string {
    if (!mountPath.startsWith('/')) mountPath = '/' + mountPath;
    if (mountPath.endsWith('/') && mountPath.length > 1) {
      mountPath = mountPath.slice(0, -1);
    }
    return mountPath;
  }

  private getDefaultOptions(): ProfessionalStaticOptions {
    return {
      maxAge: '1d',
      immutable: false,
      etag: true,
      lastModified: true,
      index: ['index.html'],
      dotfiles: 'ignore',
      extensions: false,
      redirect: true,
      compress: 'auto',
      precompress: false,
      memoryCache: true,
      maxCacheSize: this.maxCacheSize,
      maxFileSize: 2 * 1024 * 1024, // 2MB
      acceptRanges: true,
      serveHidden: false,
      caseSensitive: true,
      spa: false,
    };
  }

  private initializeMimeTypes(): void {
    const types = [
      // Text
      ['.html', 'text/html'],
      ['.css', 'text/css'],
      ['.js', 'application/javascript'],
      ['.mjs', 'application/javascript'],
      ['.json', 'application/json'],
      ['.xml', 'application/xml'],
      ['.txt', 'text/plain'],
      ['.md', 'text/markdown'],

      // Images
      ['.png', 'image/png'],
      ['.jpg', 'image/jpeg'],
      ['.jpeg', 'image/jpeg'],
      ['.gif', 'image/gif'],
      ['.svg', 'image/svg+xml'],
      ['.webp', 'image/webp'],
      ['.ico', 'image/x-icon'],
      ['.bmp', 'image/bmp'],

      // Audio/Video
      ['.mp4', 'video/mp4'],
      ['.avi', 'video/x-msvideo'],
      ['.mov', 'video/quicktime'],
      ['.wmv', 'video/x-ms-wmv'],
      ['.mp3', 'audio/mpeg'],
      ['.wav', 'audio/wav'],
      ['.flac', 'audio/flac'],
      ['.ogg', 'audio/ogg'],

      // Documents
      ['.pdf', 'application/pdf'],
      ['.doc', 'application/msword'],
      [
        '.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      ['.xls', 'application/vnd.ms-excel'],
      [
        '.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      ['.ppt', 'application/vnd.ms-powerpoint'],
      [
        '.pptx',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ],

      // Archives
      ['.zip', 'application/zip'],
      ['.rar', 'application/vnd.rar'],
      ['.7z', 'application/x-7z-compressed'],
      ['.tar', 'application/x-tar'],
      ['.gz', 'application/gzip'],

      // Fonts
      ['.woff', 'font/woff'],
      ['.woff2', 'font/woff2'],
      ['.ttf', 'font/ttf'],
      ['.otf', 'font/otf'],
      ['.eot', 'application/vnd.ms-fontobject'],
    ];

    types.forEach(([ext, type]) => {
      this.mimeTypes.set(ext, type);
    });
  }
}
