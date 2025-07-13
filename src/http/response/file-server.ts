import { access, readFile, stat } from 'fs/promises';
import * as path from 'path';
import { NextRushError } from '../../errors/types';
import { ContentType } from '../../types/http';
import { EnhancedResponse, FileServerConfig } from './types';

export class FileServer {
  private config: FileServerConfig;

  constructor(config: FileServerConfig = {}) {
    this.config = {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      allowedExtensions: [
        '.html',
        '.css',
        '.js',
        '.json',
        '.txt',
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.svg',
      ],
      cacheHeaders: true,
      ...config,
    };
  }

  async serve(
    res: EnhancedResponse,
    relativePath: string,
    status: number = 200
  ): Promise<void> {
    try {
      // Validate inputs
      if (!relativePath || typeof relativePath !== 'string') {
        throw new NextRushError(
          'File path must be a non-empty string',
          'INVALID_FILE_PATH',
          400
        );
      }

      if (res.headersSent) {
        throw new NextRushError(
          'Cannot serve file after headers have been sent',
          'HEADERS_SENT',
          500
        );
      }

      // Security: prevent directory traversal
      const normalizedPath = path.normalize(relativePath);
      if (normalizedPath.includes('..')) {
        throw new NextRushError(
          'Directory traversal not allowed',
          'SECURITY_VIOLATION',
          403,
          { path: relativePath }
        );
      }

      // Check file extension if restrictions are set
      if (this.config.allowedExtensions) {
        const ext = path.extname(normalizedPath);
        if (!this.config.allowedExtensions.includes(ext)) {
          throw new NextRushError(
            `File extension not allowed: ${ext}`,
            'EXTENSION_NOT_ALLOWED',
            403,
            { extension: ext, allowedExtensions: this.config.allowedExtensions }
          );
        }
      }

      const fullPath = path.resolve(normalizedPath);

      // Check if file exists and is accessible
      await access(fullPath);

      // Get file stats
      const stats = await stat(fullPath);

      if (!stats.isFile()) {
        throw new NextRushError('Path is not a file', 'NOT_A_FILE', 400, {
          path: relativePath,
        });
      }

      // Check file size
      if (this.config.maxFileSize && stats.size > this.config.maxFileSize) {
        throw new NextRushError(
          'File too large to serve',
          'FILE_TOO_LARGE',
          413,
          {
            fileSize: stats.size,
            maxSize: this.config.maxFileSize,
            path: relativePath,
          }
        );
      }

      // Read file
      const fileContent = await readFile(fullPath, 'utf-8');
      const contentType = this.getContentType(fullPath);

      // Set headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', Buffer.byteLength(fileContent, 'utf-8'));

      if (this.config.cacheHeaders) {
        res.setHeader('Last-Modified', stats.mtime.toUTCString());
        res.setHeader('ETag', `"${stats.size}-${stats.mtime.getTime()}"`);
      }

      res.send(fileContent, status, contentType);
    } catch (error) {
      if (error instanceof NextRushError) {
        throw error;
      }

      // Handle file system errors
      const fsError = error as any;
      if (fsError.code === 'ENOENT') {
        throw new NextRushError(
          `File not found: ${relativePath}`,
          'FILE_NOT_FOUND',
          404
        );
      } else if (fsError.code === 'EACCES') {
        throw new NextRushError(
          'Permission denied accessing file',
          'PERMISSION_DENIED',
          403,
          { path: relativePath }
        );
      } else if (fsError.code === 'EISDIR') {
        throw new NextRushError(
          'Path is a directory, not a file',
          'IS_DIRECTORY',
          400,
          { path: relativePath }
        );
      } else {
        throw new NextRushError(
          'Failed to serve file',
          'FILE_SYSTEM_ERROR',
          500,
          { path: relativePath, error: fsError.message }
        );
      }
    }
  }

  private getContentType(filePath: string): ContentType {
    const ext = path.extname(filePath).toLowerCase();

    const mimeTypes: Record<string, ContentType> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.xml': 'application/xml',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  configure(config: FileServerConfig): void {
    this.config = { ...this.config, ...config };
  }
}
