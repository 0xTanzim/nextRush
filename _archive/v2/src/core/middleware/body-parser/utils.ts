/**
 * 🚀 Body Parser Utilities - NextRush v2
 *
 * Shared utilities for all body parsers with performance optimizations
 *
 * @author NextRush Framework Team
 * @version 2.0.0
 */

import { StringDecoder } from 'string_decoder';

/**
 * 💾 Buffer pool for memory optimization
 */
class BufferPool {
  private pool: Buffer[] = [];
  private readonly maxSize: number;
  private readonly bufferSize: number;

  constructor(maxSize = 100, bufferSize = 1024 * 64) {
    // 64KB default
    this.maxSize = maxSize;
    this.bufferSize = bufferSize;
  }

  /**
   * 🎯 Acquire buffer from pool
   */
  acquire(size: number): Buffer {
    if (size <= this.bufferSize && this.pool.length > 0) {
      const buffer = this.pool.pop()!;
      return buffer.subarray(0, size);
    }
    return Buffer.allocUnsafe(size);
  }

  /**
   * 🔄 Return buffer to pool
   */
  release(buffer: Buffer): void {
    if (buffer.length === this.bufferSize && this.pool.length < this.maxSize) {
      buffer.fill(0); // Clear sensitive data
      this.pool.push(buffer);
    }
  }

  /**
   * 📊 Get pool statistics
   */
  getStats(): { poolSize: number; maxSize: number; bufferSize: number } {
    return {
      poolSize: this.pool.length,
      maxSize: this.maxSize,
      bufferSize: this.bufferSize,
    };
  }
}

/**
 * 🌍 Global buffer pool instance
 */
const globalBufferPool = new BufferPool();

/**
 * ⚡ Optimized buffer to string conversion
 * Uses StringDecoder for better performance with UTF-8
 */
export function optimizedBufferToString(
  buffer: Buffer,
  encoding: BufferEncoding = 'utf8'
): string {
  if (buffer.length === 0) return '';

  // Fast path for small buffers
  if (buffer.length < 1024) {
    return buffer.toString(encoding);
  }

  // Use StringDecoder for better performance with large UTF-8 buffers
  if (encoding === 'utf8') {
    const decoder = new StringDecoder('utf8');
    return decoder.write(buffer) + decoder.end();
  }

  return buffer.toString(encoding);
}

/**
 * 🎯 Check if data is empty
 */
export function isEmpty(data: unknown): boolean {
  if (data == null) return true;

  if (typeof data === 'string') return data.length === 0;
  if (typeof data === 'number') return false;
  if (typeof data === 'boolean') return false;
  if (Buffer.isBuffer(data)) return data.length === 0;

  if (Array.isArray(data)) return data.length === 0;

  if (typeof data === 'object') {
    return Object.keys(data as Record<string, unknown>).length === 0;
  }

  return false;
}

/**
 * 🔍 Detect content type from buffer
 */
export function detectContentType(buffer: Buffer): string {
  if (buffer.length === 0) return 'application/octet-stream';

  // Check for common content type signatures
  const start = buffer.subarray(0, Math.min(512, buffer.length));
  const startStr = start.toString('utf8', 0, Math.min(100, start.length));

  // JSON detection
  if (/^[\s]*[{[]/.test(startStr)) {
    return 'application/json';
  }

  // XML detection
  if (/^[\s]*<\?xml|^[\s]*<[a-zA-Z]/.test(startStr)) {
    return 'application/xml';
  }

  // HTML detection
  if (/^[\s]*<!DOCTYPE|^[\s]*<html/i.test(startStr)) {
    return 'text/html';
  }

  // Form data detection
  if (startStr.includes('=') && startStr.includes('&')) {
    return 'application/x-www-form-urlencoded';
  }

  // Binary file signatures
  const signature = start.subarray(0, 4);

  // PNG
  if (
    signature.length >= 4 &&
    signature[0] === 0x89 &&
    signature[1] === 0x50 &&
    signature[2] === 0x4e &&
    signature[3] === 0x47
  ) {
    return 'image/png';
  }

  // JPEG
  if (signature.length >= 2 && signature[0] === 0xff && signature[1] === 0xd8) {
    return 'image/jpeg';
  }

  // PDF
  if (startStr.startsWith('%PDF')) {
    return 'application/pdf';
  }

  // Default to text if printable ASCII, otherwise binary
  return isPrintableAscii(startStr) ? 'text/plain' : 'application/octet-stream';
}

/**
 * 🔤 Check if string contains only printable ASCII characters
 */
function isPrintableAscii(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      return false; // Non-printable control character (except tab, LF, CR)
    }
    if (code > 126) {
      return false; // Non-ASCII character
    }
  }
  return true;
}

/**
 * 📏 Validate content length
 */
export function validateContentLength(
  buffer: Buffer,
  maxSize: number,
  contentLength?: number
): void {
  if (buffer.length > maxSize) {
    throw new Error(
      `Request body too large: ${buffer.length} bytes (max: ${maxSize})`
    );
  }

  if (contentLength && contentLength !== buffer.length) {
    throw new Error(
      `Content-Length mismatch: declared ${contentLength}, actual ${buffer.length}`
    );
  }
}

/**
 * 🕐 Create timeout promise
 */
export function createTimeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Body parsing timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

/**
 * 🎭 Parse query string efficiently
 */
export function parseQueryString(
  queryString: string
): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};

  if (!queryString || queryString.length === 0) {
    return params;
  }

  const pairs = queryString.split('&');

  for (const pair of pairs) {
    if (pair.length === 0) continue;

    const equalIndex = pair.indexOf('=');
    const key = equalIndex >= 0 ? pair.slice(0, equalIndex) : pair;
    const value = equalIndex >= 0 ? pair.slice(equalIndex + 1) : '';

    if (!key) continue;

    const decodedKey = decodeURIComponent(key);
    const decodedValue = decodeURIComponent(value);

    if (decodedKey in params) {
      // Convert to array if multiple values
      const existing = params[decodedKey];
      if (Array.isArray(existing)) {
        existing.push(decodedValue);
      } else {
        params[decodedKey] = [existing as string, decodedValue];
      }
    } else {
      params[decodedKey] = decodedValue;
    }
  }

  return params;
}

/**
 * 🚀 High-performance string escape for JSON
 */
export function escapeJsonString(str: string): string {
  // Use more compliant regex pattern
  const escapeRegex = /[\\"]/g;
  return str.replace(escapeRegex, char => {
    switch (char) {
      case '\\':
        return '\\\\';
      case '"':
        return '\\"';
      default:
        return char;
    }
  });
}

/**
 * 📊 Performance measurement utility
 */
export class PerformanceTimer {
  private startTime: number;

  constructor() {
    this.startTime = performance.now();
  }

  /**
   * 🕐 Get elapsed time in milliseconds
   */
  elapsed(): number {
    return performance.now() - this.startTime;
  }

  /**
   * 🔄 Reset timer
   */
  reset(): void {
    this.startTime = performance.now();
  }
}

/**
 * 🗂️ Export buffer pool for advanced usage
 */
export { BufferPool, globalBufferPool };

/**
 * 🔧 Utility to get buffer from pool
 */
export function getPooledBuffer(size: number): Buffer {
  return globalBufferPool.acquire(size);
}

/**
 * 🔄 Utility to return buffer to pool
 */
export function releasePooledBuffer(buffer: Buffer): void {
  globalBufferPool.release(buffer);
}
