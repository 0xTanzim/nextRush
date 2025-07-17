/**
 * 🚀 Static Files Component - Clean Component Architecture
 * Serves static files with proper MIME types and caching
 */

import * as fs from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import * as path from 'path';
import { BaseComponent } from '../../core/base-component';
import { MinimalApplication } from '../../core/interfaces';

/**
 * Static files options
 */
export interface StaticOptions {
  root: string;
  index?: string;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  etag?: boolean;
  extensions?: string[];
  immutable?: boolean;
  lastModified?: boolean;
  maxAge?: number;
  redirect?: boolean;
  setHeaders?: (res: ServerResponse, path: string, stat: fs.Stats) => void;
}

/**
 * Static Files Component - Clean Architecture
 */
export class StaticFilesComponent extends BaseComponent {
  readonly name = 'StaticFiles';
  private staticRoutes = new Map<string, StaticOptions>();
  private mimeTypes = new Map<string, string>();

  constructor() {
    super('StaticFiles');
    this.initializeMimeTypes();
  }

  /**
   * Install static files methods on application
   */
  install(app: MinimalApplication): void {
    this.setApp(app);

    // Install static method
    (app as any).static = (
      mountPath: string,
      root: string,
      options?: Partial<StaticOptions>
    ) => {
      this.addStaticRoute(mountPath, root, options);
      return app;
    };

    // Install middleware for serving static files
    (app as any).use(
      (req: IncomingMessage, res: ServerResponse, next: Function) => {
        this.handleStaticRequest(req, res, next);
      }
    );

    this.log('info', 'Static files component installed');
  }

  /**
   * Add static route
   */
  private addStaticRoute(
    mountPath: string,
    root: string,
    options?: Partial<StaticOptions>
  ): void {
    const fullOptions: StaticOptions = {
      root: path.resolve(root),
      index: 'index.html',
      dotfiles: 'ignore',
      etag: true,
      extensions: ['html', 'htm'],
      immutable: false,
      lastModified: true,
      maxAge: 0,
      redirect: true,
      ...options,
    };

    this.staticRoutes.set(mountPath, fullOptions);
    this.log('info', `Static route added: ${mountPath} -> ${fullOptions.root}`);
  }

  /**
   * Handle static file requests
   */
  private async handleStaticRequest(
    req: IncomingMessage,
    res: ServerResponse,
    next: Function
  ): Promise<void> {
    const url = req.url || '/';
    const pathname = url.split('?')[0];

    for (const [mountPath, options] of this.staticRoutes) {
      if (pathname.startsWith(mountPath)) {
        const relativePath = pathname.slice(mountPath.length);
        const success = await this.serveStaticFile(relativePath, options, res);
        if (success) return;
      }
    }

    next();
  }

  /**
   * Serve static file
   */
  private async serveStaticFile(
    relativePath: string,
    options: StaticOptions,
    res: ServerResponse
  ): Promise<boolean> {
    try {
      let filePath = path.join(options.root, relativePath);

      // Security check - prevent directory traversal
      if (!filePath.startsWith(options.root)) {
        return false;
      }

      // Handle directory requests
      if (relativePath === '' || relativePath === '/') {
        if (options.index) {
          filePath = path.join(options.root, options.index);
        } else {
          return false;
        }
      }

      // Check if file exists
      const stats = await this.getFileStats(filePath);
      if (!stats) {
        // Try with extensions
        for (const ext of options.extensions || []) {
          const extPath = `${filePath}.${ext}`;
          const extStats = await this.getFileStats(extPath);
          if (extStats) {
            filePath = extPath;
            break;
          }
        }
        // Final check
        const finalStats = await this.getFileStats(filePath);
        if (!finalStats) return false;
      }

      // Handle dotfiles
      const basename = path.basename(filePath);
      if (basename.startsWith('.')) {
        if (options.dotfiles === 'deny') {
          res.statusCode = 403;
          res.end('Forbidden');
          return true;
        } else if (options.dotfiles === 'ignore') {
          return false;
        }
      }

      // Serve the file
      await this.sendFile(filePath, options, res);
      return true;
    } catch (error) {
      this.log('error', `Error serving static file: ${error}`);
      return false;
    }
  }

  /**
   * Get file stats safely
   */
  private async getFileStats(filePath: string): Promise<fs.Stats | null> {
    try {
      return await fs.promises.stat(filePath);
    } catch {
      return null;
    }
  }

  /**
   * Send file with proper headers
   */
  private async sendFile(
    filePath: string,
    options: StaticOptions,
    res: ServerResponse
  ): Promise<void> {
    const stats = await fs.promises.stat(filePath);
    const ext = path.extname(filePath).slice(1);
    const mimeType = this.mimeTypes.get(ext) || 'application/octet-stream';

    // Set headers
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stats.size);

    if (options.lastModified) {
      res.setHeader('Last-Modified', stats.mtime.toUTCString());
    }

    if (options.etag) {
      const etag = `"${stats.size}-${stats.mtime.getTime()}"`;
      res.setHeader('ETag', etag);
    }

    if (options.maxAge && options.maxAge > 0) {
      res.setHeader('Cache-Control', `max-age=${options.maxAge}`);
      if (options.immutable) {
        res.setHeader('Cache-Control', `max-age=${options.maxAge}, immutable`);
      }
    }

    // Custom headers
    if (options.setHeaders) {
      options.setHeaders(res, filePath, stats);
    }

    // Stream the file
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  /**
   * Initialize MIME types
   */
  private initializeMimeTypes(): void {
    const types = {
      html: 'text/html',
      htm: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      json: 'application/json',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      ico: 'image/x-icon',
      txt: 'text/plain',
      pdf: 'application/pdf',
      zip: 'application/zip',
      xml: 'application/xml',
      woff: 'font/woff',
      woff2: 'font/woff2',
      ttf: 'font/ttf',
      eot: 'application/vnd.ms-fontobject',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
    };

    for (const [ext, type] of Object.entries(types)) {
      this.mimeTypes.set(ext, type);
    }
  }

  /**
   * Start component
   */
  override async start(): Promise<void> {
    await super.start();
    this.log('info', `Static files ready (${this.staticRoutes.size} routes)`);
  }

  /**
   * Stop component
   */
  override async stop(): Promise<void> {
    this.staticRoutes.clear();
    await super.stop();
    this.log('info', 'Static files component stopped');
  }
}
