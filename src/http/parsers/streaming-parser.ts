/**
 * 🌊 Streaming Parser - Handles large payloads efficiently using streams
 * Memory-efficient parsing for large requests
 */

import { randomBytes } from 'crypto';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable, Transform, pipeline } from 'stream';
import { promisify } from 'util';
import {
  BaseParser,
  PayloadTooLargeError,
  RequestTimeoutError,
} from './base-parser';

const pipelineAsync = promisify(pipeline);

export interface StreamingOptions {
  maxSize?: number;
  timeout?: number;
  highWaterMark?: number;
  tempDir?: string;
  autoCleanup?: boolean;
}

export interface StreamingResult<T = any> {
  data: T;
  tempFile?: string;
  size: number;
  contentType: string;
  cleanup?: () => Promise<void>;
}

export class StreamingParser<T = any> extends BaseParser<StreamingResult<T>> {
  private highWaterMark: number;
  private tempDir: string;
  private autoCleanup: boolean;
  protected timeout: number;
  protected maxSize: number;

  constructor(options: StreamingOptions = {}) {
    super({
      maxSize: options.maxSize || 100 * 1024 * 1024, // 100MB for streaming
      timeout: options.timeout || 120000, // 2 minutes for large uploads
      encoding: 'binary',
    });

    this.highWaterMark = options.highWaterMark || 64 * 1024; // 64KB chunks
    this.tempDir = options.tempDir || tmpdir();
    this.autoCleanup = options.autoCleanup ?? true;
    this.timeout = options.timeout || 120000;
    this.maxSize = options.maxSize || 100 * 1024 * 1024;
  }

  protected override shouldReturnBuffer(): boolean {
    return false; // We handle streaming ourselves
  }

  protected async parseData(
    data: Buffer,
    contentType: string
  ): Promise<StreamingResult<T>> {
    const stream = Readable.from(data, { highWaterMark: this.highWaterMark });
    return this.parseStream(stream, contentType);
  }

  /**
   * 🌊 Parse data from a readable stream
   */
  async parseStream(
    stream: Readable,
    contentType: string
  ): Promise<StreamingResult<T>> {
    const tempFile = join(
      this.tempDir,
      `stream-${randomBytes(16).toString('hex')}.tmp`
    );
    const writeStream = createWriteStream(tempFile, {
      highWaterMark: this.highWaterMark,
    });

    let totalSize = 0;
    let timedOut = false;

    // Set up timeout
    const timeout = setTimeout(() => {
      timedOut = true;
      stream.destroy(
        new RequestTimeoutError(`Request timeout after ${this.timeout}ms`)
      );
    }, this.timeout);

    try {
      // Size monitoring transform
      const maxSizeRef = this.maxSize;
      const sizeMonitor = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          totalSize += chunk.length;
          if (totalSize > maxSizeRef) {
            return callback(
              new PayloadTooLargeError(
                `Payload exceeds maximum size: ${maxSizeRef} bytes`
              )
            );
          }
          callback(null, chunk);
        },
        highWaterMark: this.highWaterMark,
      });

      // Stream to temporary file
      await pipelineAsync(stream, sizeMonitor, writeStream);
      clearTimeout(timeout);

      if (timedOut) {
        throw new RequestTimeoutError(
          `Request timeout after ${this.timeout}ms`
        );
      }

      // Parse the content based on type
      const data = await this.parseContentFromFile(
        tempFile,
        contentType,
        totalSize
      );

      const result: StreamingResult<T> = {
        data,
        tempFile,
        size: totalSize,
        contentType,
      };

      // Add cleanup function
      if (this.autoCleanup) {
        result.cleanup = async () => {
          try {
            const fs = await import('fs').then((m) => m.promises);
            await fs.unlink(tempFile);
          } catch (error) {
            // Ignore cleanup errors
          }
        };
      }

      return result;
    } catch (error) {
      clearTimeout(timeout);

      // Cleanup on error
      try {
        const fs = await import('fs').then((m) => m.promises);
        await fs.unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }

      throw error;
    }
  }

  private async parseContentFromFile(
    filePath: string,
    contentType: string,
    size: number
  ): Promise<T> {
    const fs = await import('fs').then((m) => m.promises);

    if (contentType.includes('application/json')) {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content) as T;
    }

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const content = await fs.readFile(filePath, 'utf8');
      return this.parseUrlEncoded(content) as T;
    }

    if (contentType.includes('text/')) {
      const content = await fs.readFile(filePath, 'utf8');
      return content as unknown as T;
    }

    // For binary data, return file info
    return {
      filePath,
      size,
      contentType,
      buffer: await fs.readFile(filePath),
    } as unknown as T;
  }

  private parseUrlEncoded(content: string): Record<string, any> {
    const result: Record<string, any> = {};
    const pairs = content.split('&');

    for (const pair of pairs) {
      const [key, value] = pair.split('=').map(decodeURIComponent);
      if (key) {
        if (result[key]) {
          if (Array.isArray(result[key])) {
            result[key].push(value || '');
          } else {
            result[key] = [result[key], value || ''];
          }
        } else {
          result[key] = value || '';
        }
      }
    }

    return result;
  }

  /**
   * 📊 Create a progress monitoring transform stream
   */
  createProgressMonitor(
    onProgress?: (bytes: number, total?: number) => void
  ): Transform {
    let bytesRead = 0;

    return new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytesRead += chunk.length;
        onProgress?.(bytesRead);
        callback(null, chunk);
      },
      highWaterMark: this.highWaterMark,
    });
  }

  /**
   * 🔄 Create a chunked processing transform
   */
  createChunkedProcessor<U>(
    processor: (chunk: Buffer) => Promise<U> | U,
    options: { objectMode?: boolean } = {}
  ): Transform {
    return new Transform({
      objectMode: options.objectMode,
      async transform(chunk: Buffer, _encoding, callback) {
        try {
          const result = await processor(chunk);
          callback(null, result);
        } catch (error) {
          callback(error instanceof Error ? error : new Error(String(error)));
        }
      },
      highWaterMark: this.highWaterMark,
    });
  }

  /**
   * 🎯 Parse stream with custom processing pipeline
   */
  async parseWithPipeline<U>(
    stream: Readable,
    contentType: string,
    transforms: Transform[]
  ): Promise<StreamingResult<U>> {
    const tempFile = join(
      this.tempDir,
      `pipeline-${randomBytes(16).toString('hex')}.tmp`
    );
    const writeStream = createWriteStream(tempFile);

    try {
      // Build pipeline step by step to handle types properly
      let currentStream = stream;
      for (const transform of transforms) {
        currentStream = currentStream.pipe(transform);
      }
      await pipelineAsync(currentStream, writeStream);

      // Read the processed result
      const fs = await import('fs').then((m) => m.promises);
      const stats = await fs.stat(tempFile);
      const data = await this.parseContentFromFile(
        tempFile,
        contentType,
        stats.size
      );

      const result: StreamingResult<U> = {
        data: data as U,
        tempFile,
        size: stats.size,
        contentType,
      };

      if (this.autoCleanup) {
        result.cleanup = async () => {
          try {
            await fs.unlink(tempFile);
          } catch {
            // Ignore
          }
        };
      }

      return result;
    } catch (error) {
      // Cleanup on error
      try {
        const fs = await import('fs').then((m) => m.promises);
        await fs.unlink(tempFile);
      } catch {
        // Ignore
      }
      throw error;
    }
  }
}
