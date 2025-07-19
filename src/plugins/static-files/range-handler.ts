/**
 * 📡 Range Request Handler
 * Support for partial content delivery and streaming
 */

import { NextRushRequest, NextRushResponse } from '../../types/express';
import { CacheEntry, RangeInfo } from './types';

/**
 * Range request handler for streaming and partial content
 */
export class RangeHandler {
  /**
   * Parse Range header and return range information
   */
  parseRange(rangeHeader: string, contentLength: number): RangeInfo[] | null {
    if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
      return null;
    }

    const ranges: RangeInfo[] = [];
    const rangeSpec = rangeHeader.slice(6); // Remove 'bytes='
    const rangeStrings = rangeSpec.split(',');

    for (const rangeString of rangeStrings) {
      const range = this.parseSingleRange(rangeString.trim(), contentLength);
      if (range) {
        ranges.push(range);
      }
    }

    return ranges.length > 0 ? ranges : null;
  }

  /**
   * Parse a single range specification
   */
  private parseSingleRange(
    rangeString: string,
    contentLength: number
  ): RangeInfo | null {
    const parts = rangeString.split('-');
    if (parts.length !== 2) return null;

    const startStr = parts[0];
    const endStr = parts[1];

    let start: number;
    let end: number;

    if (startStr === '') {
      // Suffix range: -500 (last 500 bytes)
      if (endStr === '') return null;
      const suffixLength = parseInt(endStr, 10);
      if (isNaN(suffixLength) || suffixLength <= 0) return null;

      start = Math.max(0, contentLength - suffixLength);
      end = contentLength - 1;
    } else if (endStr === '') {
      // Prefix range: 500- (from byte 500 to end)
      start = parseInt(startStr, 10);
      if (isNaN(start) || start < 0) return null;

      end = contentLength - 1;
    } else {
      // Full range: 500-999
      start = parseInt(startStr, 10);
      end = parseInt(endStr, 10);

      if (isNaN(start) || isNaN(end) || start < 0 || end < start) {
        return null;
      }
    }

    // Ensure range is within bounds
    if (start >= contentLength) return null;
    end = Math.min(end, contentLength - 1);

    return {
      start,
      end,
      total: contentLength,
      chunkSize: end - start + 1,
    };
  }

  /**
   * Check if ranges are satisfiable
   */
  areRangesSatisfiable(ranges: RangeInfo[], contentLength: number): boolean {
    return ranges.every(
      (range) =>
        range.start < contentLength &&
        range.end < contentLength &&
        range.start <= range.end
    );
  }

  /**
   * Handle single range request
   */
  handleSingleRange(
    req: NextRushRequest,
    res: NextRushResponse,
    cacheEntry: CacheEntry,
    range: RangeInfo
  ): void {
    const chunk = cacheEntry.content.slice(range.start, range.end + 1);

    // Set partial content status
    res.statusCode = 206; // Partial Content

    // Set headers
    res.setHeader(
      'Content-Range',
      `bytes ${range.start}-${range.end}/${range.total}`
    );
    res.setHeader('Content-Length', range.chunkSize);
    res.setHeader('Content-Type', cacheEntry.mimeType);
    res.setHeader('Accept-Ranges', 'bytes');

    // Set ETag for cache validation
    if (cacheEntry.etag) {
      res.setHeader('ETag', cacheEntry.etag);
    }

    // Set Last-Modified
    res.setHeader('Last-Modified', cacheEntry.lastModified.toUTCString());

    // Send chunk
    res.end(chunk);
  }

  /**
   * Handle multiple range request (multipart)
   */
  handleMultipleRanges(
    req: NextRushRequest,
    res: NextRushResponse,
    cacheEntry: CacheEntry,
    ranges: RangeInfo[]
  ): void {
    const boundary = this.generateBoundary();
    const mimeType = `multipart/byteranges; boundary=${boundary}`;

    // Set partial content status
    res.statusCode = 206; // Partial Content
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');

    // Build multipart response
    let responseBody = '';

    for (const range of ranges) {
      const chunk = cacheEntry.content.slice(range.start, range.end + 1);

      responseBody += `\r\n--${boundary}\r\n`;
      responseBody += `Content-Type: ${cacheEntry.mimeType}\r\n`;
      responseBody += `Content-Range: bytes ${range.start}-${range.end}/${range.total}\r\n\r\n`;
      responseBody += chunk.toString('binary');
    }

    responseBody += `\r\n--${boundary}--\r\n`;

    res.setHeader('Content-Length', Buffer.byteLength(responseBody, 'binary'));
    res.end(responseBody, 'binary');
  }

  /**
   * Send range not satisfiable response
   */
  sendRangeNotSatisfiable(res: NextRushResponse, contentLength: number): void {
    res.statusCode = 416; // Range Not Satisfiable
    res.setHeader('Content-Range', `bytes */${contentLength}`);
    res.setHeader('Content-Type', 'text/plain');
    res.end('Range Not Satisfiable');
  }

  /**
   * Check if request is a range request
   */
  isRangeRequest(req: NextRushRequest): boolean {
    return !!req.headers.range;
  }

  /**
   * Validate range request
   */
  validateRangeRequest(
    req: NextRushRequest,
    cacheEntry: CacheEntry
  ): { valid: boolean; ranges?: RangeInfo[]; error?: string } {
    const rangeHeader = req.headers.range;
    if (!rangeHeader) {
      return { valid: false, error: 'No range header' };
    }

    const ranges = this.parseRange(rangeHeader, cacheEntry.size);
    if (!ranges || ranges.length === 0) {
      return { valid: false, error: 'Invalid range format' };
    }

    if (!this.areRangesSatisfiable(ranges, cacheEntry.size)) {
      return { valid: false, error: 'Range not satisfiable' };
    }

    // Check for too many ranges (prevent DoS)
    if (ranges.length > 10) {
      return { valid: false, error: 'Too many ranges' };
    }

    return { valid: true, ranges };
  }

  /**
   * Handle conditional range request (with If-Range)
   */
  handleConditionalRange(
    req: NextRushRequest,
    cacheEntry: CacheEntry
  ): boolean {
    const ifRange = req.headers['if-range'];
    if (!ifRange) return true; // No conditional check

    const ifRangeValue = Array.isArray(ifRange) ? ifRange[0] : ifRange;

    // Check if If-Range matches current ETag or Last-Modified
    if (ifRangeValue === cacheEntry.etag) {
      return true;
    }

    // Check if If-Range matches Last-Modified
    const ifRangeDate = new Date(ifRangeValue);
    if (
      !isNaN(ifRangeDate.getTime()) &&
      ifRangeDate.getTime() === cacheEntry.lastModified.getTime()
    ) {
      return true;
    }

    return false; // Conditional failed, send full content
  }

  /**
   * Calculate total size for multipart response
   */
  calculateMultipartSize(
    ranges: RangeInfo[],
    cacheEntry: CacheEntry,
    boundary: string
  ): number {
    let totalSize = 0;

    for (const range of ranges) {
      // Boundary and headers
      totalSize += Buffer.byteLength(`\r\n--${boundary}\r\n`);
      totalSize += Buffer.byteLength(
        `Content-Type: ${cacheEntry.mimeType}\r\n`
      );
      totalSize += Buffer.byteLength(
        `Content-Range: bytes ${range.start}-${range.end}/${range.total}\r\n\r\n`
      );

      // Content
      totalSize += range.chunkSize;
    }

    // Final boundary
    totalSize += Buffer.byteLength(`\r\n--${boundary}--\r\n`);

    return totalSize;
  }

  /**
   * Generate boundary for multipart response
   */
  private generateBoundary(): string {
    return `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if MIME type supports range requests
   */
  supportsRanges(mimeType: string): boolean {
    // Media files typically support range requests
    const supportedTypes = [
      'video/',
      'audio/',
      'application/pdf',
      'application/octet-stream',
      'image/', // Some large images benefit from ranges
    ];

    return supportedTypes.some((type) => mimeType.startsWith(type));
  }

  /**
   * Get optimal chunk size for streaming
   */
  getOptimalChunkSize(fileSize: number): number {
    // Base chunk size on file size
    if (fileSize < 1024 * 1024) {
      // < 1MB
      return 64 * 1024; // 64KB
    } else if (fileSize < 10 * 1024 * 1024) {
      // < 10MB
      return 256 * 1024; // 256KB
    } else {
      return 1024 * 1024; // 1MB
    }
  }
}
