/**
 * 📁 NextRush Static Files Plugin
 * 
 * Enterprise-grade static file serving with:
 * - 🗜️ Smart compression (gzip/brotli)
 * - 💾 Intelligent LRU caching
 * - 📡 Range requests for streaming
 * - 🔒 Comprehensive security
 * - 🚀 High-performance optimization
 * - 📱 SPA support with fallback
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Application } from '../../core/app/application';
import { NextRushRequest, NextRushResponse } from '../../types/express';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';

// Import modular components
import { CacheManager } from './cache-manager';
import { CompressionHandler } from './compression-handler';
import { MimeTypeHandler } from './mime-handler';
import { RangeHandler } from './range-handler';
import { SecurityHandler } from './security-handler';
import { 
  StaticOptions, 
  StaticMount, 
  CacheEntry, 
  StaticStats,
  DEFAULT_STATIC_OPTIONS 
} from './types';

const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const access = promisify(fs.access);

/**
 * NextRush Static Files Plugin
 */
export class StaticFilesPlugin extends BasePlugin {
  name = 'StaticFiles';

  // Modular components
  private cacheManager!: CacheManager;
  private compressionHandler!: CompressionHandler;
  private mimeTypeHandler!: MimeTypeHandler;
  private rangeHandler!: RangeHandler;
  private securityHandler!: SecurityHandler;

  // Configuration
  private mounts: StaticMount[] = [];
  private stats: StaticStats = {
    totalRequests: 0,
    cacheHits: 0,
    compressionHits: 0,
    bytesServed: 0,
    filesCached: 0,
    cacheSize: 0,
    mounts: 0,
    uptime: Date.now()
  };

  // Maintenance
  private maintenanceInterval: NodeJS.Timeout | null = null;

  constructor(registry: PluginRegistry) {
    super(registry);
    this.initializeComponents();
  }

  /**
   * Install static file serving capabilities
   */
  install(app: Application): void {
    // Add app.static method
    (app as any).static = (
      mountPath: string,
      rootPath: string,
      options: StaticOptions = {}
    ): Application => {
      this.addMount(mountPath, rootPath, options);
      return app;
    };

    // Add middleware for serving static files
    app.use((req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      this.handleRequest(req, res, next);
    });

    this.emit('staticFiles:installed');
  }

  /**
   * Start the plugin
   */
  start(): void {
    this.startMaintenance();
    this.emit('staticFiles:started', this.mounts.length);
  }

  /**
   * Stop the plugin
   */
  stop(): void {
    this.stopMaintenance();
    this.cacheManager.clear();
    this.emit('staticFiles:stopped');
  }

  /**
   * Get comprehensive statistics
   */
  getStats(): StaticStats & { cache: any } {
    const cacheStats = this.cacheManager.getStats();
    
    return {
      ...this.stats,
      filesCached: cacheStats.entryCount,
      cacheSize: cacheStats.totalSize,
      mounts: this.mounts.length,
      uptime: Date.now() - this.stats.uptime,
      cache: cacheStats
    };
  }

  /**
   * Add static mount
   */
  private addMount(
    mountPath: string,
    rootPath: string,
    options: StaticOptions
  ): void {
    const normalizedMountPath = this.normalizePath(mountPath);
    const resolvedRootPath = path.resolve(rootPath);

    // Validate directory exists
    try {
      const stats = fs.statSync(resolvedRootPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${resolvedRootPath}`);
      }
    } catch (error) {
      console.warn(`[StaticFiles] Warning: Directory not found: ${resolvedRootPath}`);
    }

    const mount: StaticMount = {
      mountPath: normalizedMountPath,
      rootPath: resolvedRootPath,
      options: { ...DEFAULT_STATIC_OPTIONS, ...options }
    };

    this.mounts.push(mount);
    this.stats.mounts = this.mounts.length;

    this.emit('staticFiles:mountAdded', normalizedMountPath, resolvedRootPath);
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
      // Only handle GET and HEAD requests
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
      }

      this.stats.totalRequests++;

      // Security validation
      const securityCheck = this.securityHandler.validateRequest(req);
      if (!securityCheck.valid) {
        this.securityHandler.logSecurityEvent('Invalid request', req, securityCheck.reason);
        res.status(400).end('Bad Request');
        return;
      }

      const requestPath = decodeURIComponent(req.pathname || '/');

      // Try each mount
      for (const mount of this.mounts) {
        if (this.isPathUnderMount(requestPath, mount.mountPath)) {
          const served = await this.serveFromMount(req, res, mount, requestPath);
          if (served) {
            return;
          }
        }
      }

      next();
    } catch (error) {
      console.error('[StaticFiles] Request handling error:', error);
      next();
    }
  }

  /**
   * Serve file from specific mount
   */
  private async serveFromMount(
    req: NextRushRequest,
    res: NextRushResponse,
    mount: StaticMount,
    requestPath: string
  ): Promise<boolean> {
    const relativePath = requestPath.substring(mount.mountPath.length);
    const filePath = path.join(mount.rootPath, relativePath);

    // Security checks
    if (!this.securityHandler.isPathSafe(filePath, mount.rootPath)) {
      this.securityHandler.logSecurityEvent('Path traversal attempt', req, { filePath });
      return false;
    }

    if (!this.securityHandler.isDotfileAllowed(filePath, mount.options)) {
      return false;
    }

    if (!this.securityHandler.isHiddenFileAllowed(filePath, mount.options)) {
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

    // Handle directory redirect
    if (mount.options.redirect && !req.url!.endsWith('/')) {
      res.status(301).redirect(req.url + '/');
      return true;
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
    
    // Check conditional requests first (304 responses)
    if (this.handleConditionalRequest(req, res, stats, options)) {
      return true;
    }

    // Get or create cache entry
    const cacheKey = this.cacheManager.generateKey(filePath, stats);
    let cacheEntry = this.cacheManager.get(cacheKey);

    if (!cacheEntry) {
      // Read and process file
      cacheEntry = await this.createCacheEntry(filePath, stats, options);
      
      if (this.shouldCache(stats.size, options)) {
        this.cacheManager.set(cacheKey, cacheEntry);
      }
    } else {
      this.stats.cacheHits++;
    }

    // Handle range requests
    if (options.acceptRanges && this.rangeHandler.isRangeRequest(req)) {
      return this.handleRangeRequest(req, res, cacheEntry, options);
    }

    // Send complete file
    this.sendFile(req, res, cacheEntry, options, filePath, stats);
    return true;
  }

  /**
   * Create optimized cache entry
   */
  private async createCacheEntry(
    filePath: string,
    stats: fs.Stats,
    options: StaticOptions
  ): Promise<CacheEntry> {
    const content = await readFile(filePath);
    const mimeType = this.mimeTypeHandler.getMimeType(filePath);
    const etag = this.cacheManager.generateETag(content, stats);

    const entry: CacheEntry = {
      content,
      mimeType,
      etag,
      lastModified: stats.mtime,
      size: stats.size,
      compressible: this.compressionHandler.shouldCompress(content, mimeType)
    };

    // Apply compression if enabled and beneficial
    if (options.compress && entry.compressible) {
      const compressionType = options.compress === true ? 'auto' : options.compress;
      const compressed = await this.compressionHandler.compressContent(
        content, 
        compressionType
      );
      
      if (compressed) {
        entry.compressed = { [compressed.encoding === 'br' ? 'brotli' : compressed.encoding]: compressed.data };
        entry.encoding = compressed.encoding;
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
    options: StaticOptions
  ): boolean {
    // Check If-None-Match (ETag)
    if (options.etag) {
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch) {
        const etag = this.cacheManager.generateETag(Buffer.alloc(0), stats);
        if (ifNoneMatch === etag) {
          res.status(304).end();
          return true;
        }
      }
    }

    // Check If-Modified-Since
    if (options.lastModified) {
      const ifModifiedSince = req.headers['if-modified-since'];
      if (ifModifiedSince) {
        const modifiedSince = new Date(Array.isArray(ifModifiedSince) ? ifModifiedSince[0] : ifModifiedSince);
        if (stats.mtime <= modifiedSince) {
          res.status(304).end();
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Handle range requests
   */
  private handleRangeRequest(
    req: NextRushRequest,
    res: NextRushResponse,
    cacheEntry: CacheEntry,
    options: StaticOptions
  ): boolean {
    // Validate range request
    const validation = this.rangeHandler.validateRangeRequest(req, cacheEntry);
    if (!validation.valid) {
      if (validation.error === 'Range not satisfiable') {
        this.rangeHandler.sendRangeNotSatisfiable(res, cacheEntry.size);
      }
      return false;
    }

    const ranges = validation.ranges!;

    // Check conditional range
    if (!this.rangeHandler.handleConditionalRange(req, cacheEntry)) {
      // Conditional failed, send full content
      this.sendFile(req, res, cacheEntry, options, '', new fs.Stats());
      return true;
    }

    // Handle single or multiple ranges
    if (ranges.length === 1) {
      this.rangeHandler.handleSingleRange(req, res, cacheEntry, ranges[0]);
    } else {
      this.rangeHandler.handleMultipleRanges(req, res, cacheEntry, ranges);
    }

    return true;
  }

  /**
   * Send file with optimized headers and compression
   */
  private sendFile(
    req: NextRushRequest,
    res: NextRushResponse,
    cacheEntry: CacheEntry,
    options: StaticOptions,
    filePath: string,
    stats: fs.Stats
  ): void {
    // Determine best content to send
    let content = cacheEntry.content;
    let encoding: string | undefined;

    if (cacheEntry.compressed && options.compress) {
      const acceptEncoding = req.headers['accept-encoding'] as string || '';
      
      // Check for brotli support
      if (cacheEntry.compressed.brotli && this.compressionHandler.acceptsEncoding(acceptEncoding, 'br')) {
        content = cacheEntry.compressed.brotli;
        encoding = 'br';
        this.stats.compressionHits++;
      }
      // Check for gzip support  
      else if (cacheEntry.compressed.gzip && this.compressionHandler.acceptsEncoding(acceptEncoding, 'gzip')) {
        content = cacheEntry.compressed.gzip;
        encoding = 'gzip';
        this.stats.compressionHits++;
      }
    }

    // Set basic headers
    res.setHeader('Content-Type', cacheEntry.mimeType);
    res.setHeader('Content-Length', content.length);

    // Set compression headers
    if (encoding) {
      res.setHeader('Content-Encoding', encoding);
      res.setHeader('Vary', 'Accept-Encoding');
    }

    // Set cache headers
    if (options.etag) {
      res.setHeader('ETag', cacheEntry.etag);
    }

    if (options.lastModified) {
      res.setHeader('Last-Modified', cacheEntry.lastModified.toUTCString());
    }

    // Set cache control
    this.setCacheControl(res, options);

    // Set security headers
    this.securityHandler.setSecurityHeaders(res, cacheEntry.mimeType, options);

    // Set range support
    if (options.acceptRanges) {
      res.setHeader('Accept-Ranges', 'bytes');
    }

    // Custom headers
    if (options.setHeaders) {
      options.setHeaders(res, filePath, stats);
    }

    // Update statistics
    this.stats.bytesServed += content.length;

    // Send content
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
    const fallbackFile = typeof mount.options.spa === 'string' 
      ? mount.options.spa 
      : 'index.html';
    
    const fallbackPath = path.join(mount.rootPath, fallbackFile);

    try {
      const stats = await stat(fallbackPath);
      return await this.serveFile(req, res, mount, fallbackPath, stats);
    } catch (error) {
      return false;
    }
  }

  /**
   * Set cache control headers
   */
  private setCacheControl(res: NextRushResponse, options: StaticOptions): void {
    if (options.maxAge) {
      const maxAge = typeof options.maxAge === 'number' 
        ? options.maxAge 
        : this.parseMaxAge(options.maxAge);
      
      let cacheControl = `public, max-age=${maxAge}`;
      
      if (options.immutable) {
        cacheControl += ', immutable';
      }
      
      res.setHeader('Cache-Control', cacheControl);
    }
  }

  /**
   * Utility methods
   */
  private shouldCache(size: number, options: StaticOptions): boolean {
    return options.memoryCache !== false && 
           size <= (options.maxFileSize || 2 * 1024 * 1024);
  }

  private isPathUnderMount(requestPath: string, mountPath: string): boolean {
    if (mountPath === '/') {
      return true;
    }
    return requestPath === mountPath || requestPath.startsWith(mountPath + '/');
  }

  private normalizePath(pathname: string): string {
    let normalized = pathname;
    if (!normalized.startsWith('/')) normalized = '/' + normalized;
    if (normalized.endsWith('/') && normalized.length > 1) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  private parseMaxAge(maxAge: string): number {
    const units: Record<string, number> = {
      s: 1, m: 60, h: 3600, d: 86400, w: 604800, y: 31536000
    };

    const match = maxAge.match(/^(\d+)([smhdwy]?)$/);
    if (!match) return 3600; // Default 1 hour

    const value = parseInt(match[1]);
    const unit = match[2] || 's';
    return value * (units[unit] || 1);
  }

  /**
   * Initialize modular components
   */
  private initializeComponents(): void {
    this.cacheManager = new CacheManager();
    this.compressionHandler = new CompressionHandler();
    this.mimeTypeHandler = new MimeTypeHandler();
    this.rangeHandler = new RangeHandler();
    this.securityHandler = new SecurityHandler();
  }

  /**
   * Start maintenance tasks
   */
  private startMaintenance(): void {
    // Run cache maintenance every 10 minutes
    this.maintenanceInterval = setInterval(() => {
      this.cacheManager.performMaintenance();
    }, 10 * 60 * 1000);
  }

  /**
   * Stop maintenance tasks
   */
  private stopMaintenance(): void {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }
  }
}
