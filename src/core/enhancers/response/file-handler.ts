/**
 * File Handler for NextRush v2
 *
 * Provides file serving, downloading, and streaming utilities.
 *
 * @packageDocumentation
 */

import { createHash } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { getSmartContentType } from './mime-types.js';

/**
 * File options interface
 */
export interface FileOptions {
  /** Generate ETag header (default: true) */
  etag?: boolean;
  /** Root directory for relative paths */
  root?: string;
  /** Custom headers to set */
  headers?: Record<string, string>;
  /** Max age for cache control */
  maxAge?: number;
  /** Immutable cache control */
  immutable?: boolean;
}

/**
 * File stats for ETag generation
 */
export interface FileStats {
  size: number;
  mtime: Date;
}

/**
 * Generate ETag from file stats
 *
 * @param stats - File statistics
 * @returns ETag string with quotes
 *
 * @example
 * ```typescript
 * const stats = statSync('/path/to/file');
 * const etag = generateETag({ size: stats.size, mtime: stats.mtime });
 * // '"a1b2c3d4..."'
 * ```
 */
export function generateETag(stats: FileStats): string {
  const hash = createHash('md5');
  hash.update(`${stats.size}-${stats.mtime.getTime()}`);
  return `"${hash.digest('hex')}"`;
}

/**
 * Send a file as response
 *
 * @param res - Server response object
 * @param filePath - Path to the file
 * @param options - File serving options
 *
 * @example
 * ```typescript
 * sendFile(res, '/path/to/file.pdf', { etag: true });
 * ```
 */
export function sendFile(
  res: ServerResponse,
  filePath: string,
  options: FileOptions = {}
): void {
  try {
    const stats = statSync(filePath);
    const contentType = getSmartContentType(filePath);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Last-Modified', stats.mtime.toUTCString());

    // ETag
    if (options.etag !== false) {
      const etag = generateETag({ size: stats.size, mtime: stats.mtime });
      res.setHeader('ETag', etag);
    }

    // Cache control
    if (options.maxAge !== undefined) {
      let cacheControl = `public, max-age=${options.maxAge}`;
      if (options.immutable) {
        cacheControl += ', immutable';
      }
      res.setHeader('Cache-Control', cacheControl);
    }

    // Custom headers
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        res.setHeader(key, value);
      }
    }

    // Stream the file
    const stream = createReadStream(filePath);
    stream.pipe(res);
  } catch {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'File not found' }));
  }
}

/**
 * Send file as download attachment
 *
 * @param res - Server response object
 * @param filePath - Path to the file
 * @param filename - Download filename (optional)
 * @param options - File serving options
 *
 * @example
 * ```typescript
 * sendDownload(res, '/path/to/report.pdf', 'monthly-report.pdf');
 * ```
 */
export function sendDownload(
  res: ServerResponse,
  filePath: string,
  filename?: string,
  options: FileOptions = {}
): void {
  const name = filename || filePath.split('/').pop() || 'download';
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  sendFile(res, filePath, options);
}

/**
 * Stream data to response
 *
 * @param res - Server response object
 * @param stream - Readable stream
 * @param contentType - Optional content type
 *
 * @example
 * ```typescript
 * const readable = createReadStream('/path/to/file');
 * streamToResponse(res, readable, 'application/octet-stream');
 * ```
 */
export function streamToResponse(
  res: ServerResponse,
  stream: NodeJS.ReadableStream,
  contentType?: string
): void {
  if (contentType && !res.headersSent) {
    res.setHeader('Content-Type', contentType);
  }
  stream.pipe(res);
}
