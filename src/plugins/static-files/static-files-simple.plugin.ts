/**
 * 📁 Enhanced Static Files Plugin - NextRush Framework
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Application } from '../../core/app/application';
import { NextRushRequest, NextRushResponse } from '../../types/express';
import { BasePlugin, PluginRegistry } from '../core/base-plugin';

const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

export interface EnhancedStaticOptions {
  maxAge?: string | number;
  etag?: boolean;
  index?: string | string[] | false;
  spa?: boolean | string;
  compress?: boolean;
  cacheControl?: string;
  lastModified?: boolean;
  memoryCache?: boolean;
  maxCacheSize?: number;
  maxFileSize?: number;
  setHeaders?: (res: NextRushResponse, path: string, stat: fs.Stats) => void;
}

interface StaticMount {
  mountPath: string;
  rootPath: string;
  options: EnhancedStaticOptions;
}

interface CacheEntry {
  content: Buffer;
  mimeType: string;
  etag: string;
  lastModified: Date;
  size: number;
}

export class StaticFilesPlugin extends BasePlugin {
  name = 'EnhancedStaticFiles';

  private mounts: StaticMount[] = [];
  private fileCache = new Map<string, CacheEntry>();
  private mimeTypes = new Map<string, string>();
  private maxCacheSize: number = 50 * 1024 * 1024;
  private currentCacheSize: number = 0;

  constructor(registry: PluginRegistry) {
    super(registry);
    this.initializeMimeTypes();
  }

  install(app: Application): void {
    (app as any).static = (
      mountPath: string,
      rootPath: string,
      options: EnhancedStaticOptions = {}
    ) => {
      this.addMount(mountPath, rootPath, options);
    };

    app.use((req, res, next) => this.handleRequest(req, res, next));
    this.emit('staticFiles:installed');
  }

  uninstall(): void {
    this.mounts.length = 0;
    this.fileCache.clear();
    this.currentCacheSize = 0;
    this.emit('staticFiles:uninstalled');
  }

  start(): void {
    this.emit('staticFiles:started');
  }

  stop(): void {
    this.fileCache.clear();
    this.currentCacheSize = 0;
    this.emit('staticFiles:stopped');
  }

  getStats(): object {
    return {
      mounts: this.mounts.length,
      cachedFiles: this.fileCache.size,
      cacheSize: this.currentCacheSize,
    };
  }

  private addMount(
    mountPath: string,
    rootPath: string,
    options: EnhancedStaticOptions
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

  private async serveFromMount(
    req: NextRushRequest,
    res: NextRushResponse,
    mount: StaticMount
  ): Promise<boolean> {
    const relativePath = req.url!.substring(mount.mountPath.length);
    const filePath = path.join(mount.rootPath, relativePath);

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
      if (mount.options.spa) {
        return await this.serveSpaFallback(req, res, mount);
      }
    }

    return false;
  }

  private async serveFile(
    req: NextRushRequest,
    res: NextRushResponse,
    mount: StaticMount,
    filePath: string,
    stats: fs.Stats
  ): Promise<boolean> {
    const cacheKey = filePath;
    let cacheEntry = this.fileCache.get(cacheKey);

    if (cacheEntry && cacheEntry.lastModified >= stats.mtime) {
      this.sendCachedFile(res, cacheEntry, mount.options);
      return true;
    }

    const content = await readFile(filePath);
    const mimeType = this.getMimeType(filePath);
    const etag = this.generateEtag(content);

    cacheEntry = {
      content,
      mimeType,
      etag,
      lastModified: stats.mtime,
      size: stats.size,
    };

    if (this.shouldCache(content.length, mount.options)) {
      this.addToCache(cacheKey, cacheEntry);
    }

    this.sendFile(res, cacheEntry, mount.options);
    return true;
  }

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

  private sendCachedFile(
    res: NextRushResponse,
    cacheEntry: CacheEntry,
    options: EnhancedStaticOptions
  ): void {
    res.setHeader('Content-Type', cacheEntry.mimeType);
    res.setHeader('Content-Length', cacheEntry.content.length.toString());

    if (options.etag !== false) {
      res.setHeader('ETag', cacheEntry.etag);
    }

    if (options.lastModified !== false) {
      res.setHeader('Last-Modified', cacheEntry.lastModified.toUTCString());
    }

    if (options.cacheControl) {
      res.setHeader('Cache-Control', options.cacheControl);
    }

    res.end(cacheEntry.content);
  }

  private sendFile(
    res: NextRushResponse,
    cacheEntry: CacheEntry,
    options: EnhancedStaticOptions
  ): void {
    res.setHeader('Content-Type', cacheEntry.mimeType);
    res.setHeader('Content-Length', cacheEntry.content.length.toString());

    if (options.etag !== false) {
      res.setHeader('ETag', cacheEntry.etag);
    }

    if (options.lastModified !== false) {
      res.setHeader('Last-Modified', cacheEntry.lastModified.toUTCString());
    }

    if (options.cacheControl) {
      res.setHeader('Cache-Control', options.cacheControl);
    } else if (options.maxAge) {
      const maxAge =
        typeof options.maxAge === 'number'
          ? options.maxAge
          : parseInt(options.maxAge);
      res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (options.setHeaders) {
      options.setHeaders(res, '', {
        mtime: cacheEntry.lastModified,
      } as fs.Stats);
    }

    res.end(cacheEntry.content);
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

  private generateEtag(content: Buffer): string {
    const hash = require('crypto')
      .createHash('md5')
      .update(content)
      .digest('hex');
    return `"${hash}"`;
  }

  private normalizePath(mountPath: string): string {
    if (!mountPath.startsWith('/')) mountPath = '/' + mountPath;
    if (mountPath.endsWith('/') && mountPath.length > 1) {
      mountPath = mountPath.slice(0, -1);
    }
    return mountPath;
  }

  private getDefaultOptions(): EnhancedStaticOptions {
    return {
      maxAge: '1d',
      etag: true,
      index: ['index.html'],
      spa: false,
      compress: false,
      lastModified: true,
      memoryCache: true,
      maxCacheSize: this.maxCacheSize,
      maxFileSize: 1024 * 1024,
    };
  }

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
      ['.pdf', 'application/pdf'],
      ['.txt', 'text/plain'],
      ['.md', 'text/markdown'],
    ];

    types.forEach(([ext, type]) => {
      this.mimeTypes.set(ext, type);
    });
  }

  private shouldCache(size: number, options: EnhancedStaticOptions): boolean {
    if (!options.memoryCache) return false;
    if (size > (options.maxFileSize || 1024 * 1024)) return false;
    if (this.currentCacheSize + size > this.maxCacheSize) return false;
    return true;
  }

  private addToCache(key: string, entry: CacheEntry): void {
    this.fileCache.set(key, entry);
    this.currentCacheSize += entry.size;
    this.emit('staticFiles:fileCached', key, entry.size);
  }
}
