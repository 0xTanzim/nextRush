/**
 * 📁 Static Files Plugin - Enterprise Static File Serving
 * High-performance static file serving with caching and SPA support
 */

import {
  BaseStaticFilesPlugin,
  StaticMountDefinition,
  StaticMountOptions
} from '../types/specialized-plugins';
import { PluginContext, PluginMetadata } from '../core/plugin.interface';
import { NextRushRequest, NextRushResponse } from '../../types/express';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

/**
 * File info interface
 */
interface FileInfo {
  path: string;
  stats: fs.Stats;
  mimeType: string;
  etag: string;
}

/**
 * Enterprise Static Files Plugin
 * Provides high-performance static file serving with advanced features
 */
export class StaticFilesPlugin extends BaseStaticFilesPlugin {
  public readonly metadata: PluginMetadata = {
    name: 'NextRush-StaticFiles',
    version: '1.0.0',
    description: 'Enterprise static file serving with caching, compression, and SPA support',
    author: 'NextRush Framework',
    category: 'core',
    priority: 70, // Medium-high priority
    dependencies: []
  };

  private fileCache = new Map<string, FileInfo>();
  private mimeTypes = new Map<string, string>();

  protected async onInstall(context: PluginContext): Promise<void> {
    const app = context.app;

    // Initialize MIME types
    this.initializeMimeTypes();

    // Bind static method to application
    (app as any).static = (mountPath: string, rootPath: string, options?: StaticMountOptions) => {
      this.addMount(mountPath, rootPath, options);
      return app;
    };

    context.logger.info('Static files plugin methods bound to application');
  }

  protected async onStart(context: PluginContext): Promise<void> {
    // Pre-cache static files if configured
    await this.preloadFiles();
    
    context.logger.info(`Static files plugin started with ${this.mounts.size} mounts`);
  }

  protected async onStop(context: PluginContext): Promise<void> {
    // Clear file cache
    this.fileCache.clear();
    
    context.logger.info('Static files plugin stopped');
  }

  protected async onUninstall(context: PluginContext): Promise<void> {
    // Clean up all mounts and cache
    this.mounts.clear();
    this.fileCache.clear();
    
    context.logger.info('Static files plugin uninstalled');
  }

  public override addMount(mountPath: string, rootPath: string, options: StaticMountOptions = {}): void {
    // Normalize paths
    const normalizedMountPath = this.normalizePath(mountPath);
    const normalizedRootPath = path.resolve(rootPath);

    super.addMount(normalizedMountPath, normalizedRootPath, options);
  }

  /**
   * Handle static file request
   */
  public async handleRequest(
    req: NextRushRequest,
    res: NextRushResponse
  ): Promise<boolean> {
    const requestPath = req.url || '/';
    
    // Find matching mount
    const mount = this.findMount(requestPath);
    if (!mount) {
      return false; // No matching mount
    }

    try {
      // Extract relative path
      const relativePath = requestPath.substring(mount.mountPath.length);
      const filePath = path.join(mount.rootPath, relativePath);

      // Security check - prevent directory traversal
      if (!this.isPathSafe(filePath, mount.rootPath)) {
        this.sendError(res, 403, 'Forbidden');
        return true;
      }

      // Try to serve the file
      const served = await this.serveFile(filePath, mount.options, req, res);
      
      if (!served && mount.options.spa) {
        // SPA fallback - serve index.html
        const indexPath = path.join(mount.rootPath, 'index.html');
        await this.serveFile(indexPath, mount.options, req, res);
      }

      return true;
    } catch (error) {
      this.getContext().logger.error('Static file serving error:', error);
      this.sendError(res, 500, 'Internal Server Error');
      return true;
    }
  }

  // Private methods
  private initializeMimeTypes(): void {
    // Common MIME types
    const types = {
      '.html': 'text/html',
      '.htm': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.xml': 'application/xml',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject'
    };

    Object.entries(types).forEach(([ext, type]) => {
      this.mimeTypes.set(ext, type);
    });
  }

  private async preloadFiles(): Promise<void> {
    // Pre-load frequently accessed files for better performance
    for (const [, mount] of this.mounts) {
      if (mount.options.index) {
        const indexPath = path.join(mount.rootPath, 'index.html');
        try {
          await this.loadFileInfo(indexPath);
        } catch (error) {
          // Index file doesn't exist, that's ok
        }
      }
    }
  }

  private findMount(requestPath: string): StaticMountDefinition | null {
    // Find the most specific (longest) matching mount path
    let bestMatch: StaticMountDefinition | null = null;
    let longestMatch = 0;

    for (const [, mount] of this.mounts) {
      if (requestPath.startsWith(mount.mountPath)) {
        if (mount.mountPath.length > longestMatch) {
          bestMatch = mount;
          longestMatch = mount.mountPath.length;
        }
      }
    }

    return bestMatch;
  }

  private async serveFile(
    filePath: string,
    options: StaticMountOptions,
    req: NextRushRequest,
    res: NextRushResponse
  ): Promise<boolean> {
    try {
      // Check if file exists and get info
      const fileInfo = await this.loadFileInfo(filePath);
      
      if (!fileInfo.stats.isFile()) {
        return false;
      }

      // Check cache headers
      if (this.checkCache(fileInfo, req, res)) {
        return true; // 304 Not Modified sent
      }

      // Set headers
      this.setResponseHeaders(fileInfo, options, res);

      // Send file content
      const content = await readFile(fileInfo.path);
      res.end(content);

      return true;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return false; // File not found
      }
      throw error;
    }
  }

  private async loadFileInfo(filePath: string): Promise<FileInfo> {
    // Check cache first
    const cached = this.fileCache.get(filePath);
    if (cached) {
      // Verify file hasn't changed
      try {
        const currentStats = await stat(filePath);
        if (currentStats.mtime.getTime() === cached.stats.mtime.getTime()) {
          return cached;
        }
      } catch (error) {
        // File no longer exists
        this.fileCache.delete(filePath);
        throw error;
      }
    }

    // Load file info
    const stats = await stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = this.mimeTypes.get(ext) || 'application/octet-stream';
    const etag = `"${stats.size}-${stats.mtime.getTime()}"`;

    const fileInfo: FileInfo = {
      path: filePath,
      stats,
      mimeType,
      etag
    };

    // Cache file info
    this.fileCache.set(filePath, fileInfo);

    return fileInfo;
  }

  private checkCache(
    fileInfo: FileInfo,
    req: NextRushRequest,
    res: NextRushResponse
  ): boolean {
    const ifNoneMatch = req.headers['if-none-match'];
    const ifModifiedSince = req.headers['if-modified-since'];

    // Check ETag
    if (ifNoneMatch && ifNoneMatch === fileInfo.etag) {
      res.writeHead(304);
      res.end();
      return true;
    }

    // Check Last-Modified
    if (ifModifiedSince) {
      const modifiedSince = new Date(ifModifiedSince as string);
      if (fileInfo.stats.mtime <= modifiedSince) {
        res.writeHead(304);
        res.end();
        return true;
      }
    }

    return false;
  }

  private setResponseHeaders(
    fileInfo: FileInfo,
    options: StaticMountOptions,
    res: NextRushResponse
  ): void {
    // Content type
    res.setHeader('Content-Type', fileInfo.mimeType);
    res.setHeader('Content-Length', fileInfo.stats.size);

    // Cache headers
    if (options.etag !== false) {
      res.setHeader('ETag', fileInfo.etag);
    }

    if (options.lastModified !== false) {
      res.setHeader('Last-Modified', fileInfo.stats.mtime.toUTCString());
    }

    // Cache control
    if (options.maxAge) {
      const maxAge = typeof options.maxAge === 'string' 
        ? parseInt(options.maxAge, 10) 
        : options.maxAge;
      res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    }

    // Immutable cache
    if (options.immutable) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }

    // Custom headers
    if (options.setHeaders) {
      options.setHeaders(res, fileInfo.path, fileInfo.stats);
    }
  }

  private isPathSafe(filePath: string, rootPath: string): boolean {
    // Resolve paths and check if file is within root
    const resolvedFilePath = path.resolve(filePath);
    const resolvedRootPath = path.resolve(rootPath);
    
    return resolvedFilePath.startsWith(resolvedRootPath);
  }

  private normalizePath(inputPath: string): string {
    // Ensure path starts with / and doesn't end with /
    let normalized = inputPath.startsWith('/') ? inputPath : `/${inputPath}`;
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  private sendError(res: NextRushResponse, status: number, message: string): void {
    if (!res.headersSent) {
      res.writeHead(status, { 'Content-Type': 'text/plain' });
      res.end(message);
    }
  }
}
