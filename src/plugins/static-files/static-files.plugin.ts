/**
 * 📁 Static Files Plugin - NextRush Framework
 *
 * Unified plugin architecture following copilot instructions.
 * Provides app.static() functionality with SPA support.
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Application } from '../../core/app/application';
import { NextRushRequest, NextRushResponse } from '../../types/express';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';

const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

/**
 * Static file serving options
 */
export interface StaticOptions {
  maxAge?: string | number;
  etag?: boolean;
  index?: string | string[] | false;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  extensions?: string[] | false;
  immutable?: boolean;
  redirect?: boolean;
  spa?: boolean;
}

/**
 * Static mount definition
 */
interface StaticMount {
  mountPath: string;
  rootPath: string;
  options: StaticOptions;
}

/**
 * File cache entry
 */
interface CacheEntry {
  content: Buffer;
  mimeType: string;
  etag: string;
  lastModified: Date;
}

/**
 * Static Files Plugin - Enterprise file serving with SPA support
 */
export class StaticFilesPlugin extends BasePlugin {
  name = 'StaticFiles';

  private mounts: StaticMount[] = [];
  private fileCache = new Map<string, CacheEntry>();
  private mimeTypes = new Map<string, string>();

  constructor(registry: PluginRegistry) {
    super(registry);
    this.initializeMimeTypes();
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

    // Install middleware for serving static files
    app.use((req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      this.handleRequest(req, res, next);
    });

    this.emit('staticFiles:installed');
  }

  /**
   * Start the static files plugin
   */
  start(): void {
    this.emit('staticFiles:started', this.mounts.length);
  }

  /**
   * Stop the static files plugin
   */
  stop(): void {
    this.fileCache.clear();
    this.emit('staticFiles:stopped');
  }

  /**
   * Add a static mount point
   */
  private addMount(
    mountPath: string,
    rootPath: string,
    options: StaticOptions
  ): void {
    const normalizedMountPath = this.normalizePath(mountPath);
    const resolvedRootPath = path.resolve(rootPath);

    this.mounts.push({
      mountPath: normalizedMountPath,
      rootPath: resolvedRootPath,
      options: { ...this.getDefaultOptions(), ...options },
    });

    this.emit('staticFiles:mountAdded', normalizedMountPath, resolvedRootPath);
  }

  /**
   * Handle incoming requests for static files
   */
  private async handleRequest(
    req: NextRushRequest,
    res: NextRushResponse,
    next: () => void
  ): Promise<void> {
    try {
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
   * Serve file from a specific mount
   */
  private async serveFromMount(
    req: NextRushRequest,
    res: NextRushResponse,
    mount: StaticMount
  ): Promise<boolean> {
    const relativePath = req.url!.substring(mount.mountPath.length);
    const filePath = path.join(mount.rootPath, relativePath);

    // Security check - prevent directory traversal
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
   * Serve a single file
   */
  private async serveFile(
    req: NextRushRequest,
    res: NextRushResponse,
    mount: StaticMount,
    filePath: string,
    stats: fs.Stats
  ): Promise<boolean> {
    const cacheKey = filePath;
    let cacheEntry = this.fileCache.get(cacheKey);

    // Check if cached version is still valid
    if (cacheEntry && cacheEntry.lastModified >= stats.mtime) {
      this.sendCachedFile(res, cacheEntry, mount.options);
      return true;
    }

    // Read and cache the file
    try {
      const content = await readFile(filePath);
      const mimeType = this.getMimeType(filePath);
      const etag = this.generateEtag(content);

      cacheEntry = {
        content,
        mimeType,
        etag,
        lastModified: stats.mtime,
      };

      this.fileCache.set(cacheKey, cacheEntry);
      this.sendCachedFile(res, cacheEntry, mount.options);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Serve directory (index file)
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
      } catch (error) {
        continue;
      }
    }

    return false;
  }

  /**
   * Serve SPA fallback (usually index.html)
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
   * Send cached file to response
   */
  private sendCachedFile(
    res: NextRushResponse,
    cacheEntry: CacheEntry,
    options: StaticOptions
  ): void {
    res.setHeader('Content-Type', cacheEntry.mimeType);
    res.setHeader('Content-Length', cacheEntry.content.length.toString());

    if (options.etag !== false) {
      res.setHeader('ETag', cacheEntry.etag);
    }

    if (options.maxAge) {
      const maxAge =
        typeof options.maxAge === 'string'
          ? parseInt(options.maxAge)
          : options.maxAge;
      res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    }

    res.end(cacheEntry.content);
  }

  /**
   * Security check for path traversal
   */
  private isPathSafe(filePath: string, rootPath: string): boolean {
    const resolved = path.resolve(filePath);
    const root = path.resolve(rootPath);
    return resolved.startsWith(root);
  }

  /**
   * Get MIME type for file
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return this.mimeTypes.get(ext) || 'application/octet-stream';
  }

  /**
   * Generate ETag for content
   */
  private generateEtag(content: Buffer): string {
    return `"${content.length.toString(16)}-${Date.now().toString(16)}"`;
  }

  /**
   * Normalize mount path
   */
  private normalizePath(mountPath: string): string {
    let normalized = mountPath.startsWith('/') ? mountPath : `/${mountPath}`;
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  }

  /**
   * Get default static options
   */
  private getDefaultOptions(): StaticOptions {
    return {
      maxAge: 0,
      etag: true,
      index: 'index.html',
      dotfiles: 'ignore',
      extensions: false,
      immutable: false,
      redirect: true,
      spa: false,
    };
  }

  /**
   * Initialize MIME types mapping
   */
  private initializeMimeTypes(): void {
    const types = [
      ['.html', 'text/html'],
      ['.css', 'text/css'],
      ['.js', 'application/javascript'],
      ['.json', 'application/json'],
      ['.png', 'image/png'],
      ['.jpg', 'image/jpeg'],
      ['.jpeg', 'image/jpeg'],
      ['.gif', 'image/gif'],
      ['.svg', 'image/svg+xml'],
      ['.ico', 'image/x-icon'],
      ['.txt', 'text/plain'],
      ['.pdf', 'application/pdf'],
      ['.xml', 'application/xml'],
    ];

    types.forEach(([ext, type]) => {
      this.mimeTypes.set(ext, type);
    });
  }
}
