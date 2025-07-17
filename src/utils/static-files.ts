/**
 * Static Files Utilities - Static file serving helpers
 */

import { promises as fs } from 'fs';
import * as path from 'path';

export interface StaticOptions {
  root: string;
  maxAge?: number;
  index?: string[];
  dotfiles?: 'allow' | 'deny' | 'ignore';
  etag?: boolean;
}

export class StaticFileServer {
  private options: Required<StaticOptions>;

  constructor(options: StaticOptions) {
    this.options = {
      root: options.root,
      maxAge: options.maxAge || 0,
      index: options.index || ['index.html'],
      dotfiles: options.dotfiles || 'ignore',
      etag: options.etag !== false,
    };
  }

  async serveFile(requestPath: string): Promise<{
    content: Buffer;
    contentType: string;
    etag?: string;
    lastModified?: Date;
  } | null> {
    try {
      const filePath = this.resolvePath(requestPath);
      if (!filePath) return null;

      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        // Try to serve index files
        for (const indexFile of this.options.index) {
          const indexPath = path.join(filePath, indexFile);
          try {
            const indexStats = await fs.stat(indexPath);
            if (indexStats.isFile()) {
              return this.readFile(indexPath, indexStats);
            }
          } catch {
            continue;
          }
        }
        return null;
      }

      if (stats.isFile()) {
        return this.readFile(filePath, stats);
      }

      return null;
    } catch {
      return null;
    }
  }

  private async readFile(
    filePath: string,
    stats: any
  ): Promise<{
    content: Buffer;
    contentType: string;
    etag?: string;
    lastModified?: Date;
  }> {
    const content = await fs.readFile(filePath);
    const contentType = this.getContentType(filePath);

    const result: any = {
      content,
      contentType,
      lastModified: stats.mtime,
    };

    if (this.options.etag) {
      result.etag = `"${stats.size}-${stats.mtime.getTime()}"`;
    }

    return result;
  }

  private resolvePath(requestPath: string): string | null {
    const fullPath = path.resolve(this.options.root, '.' + requestPath);

    // Security check - ensure path is within root
    if (!fullPath.startsWith(path.resolve(this.options.root))) {
      return null;
    }

    // Handle dotfiles
    const basename = path.basename(fullPath);
    if (basename.startsWith('.')) {
      if (this.options.dotfiles === 'deny') {
        return null;
      }
      if (this.options.dotfiles === 'ignore') {
        return null;
      }
    }

    return fullPath;
  }

  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.xml': 'application/xml',
      '.ico': 'image/x-icon',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }
}
