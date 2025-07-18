/**
 * 🔄 Base Parser - Abstract foundation for all body parsers
 * Uses OOP inheritance for extensible parser architecture
 */

import { IncomingMessage } from 'http';

export interface ParsedResult<T = any> {
  data: T;
  raw: string | Buffer;
  contentType: string;
  size: number;
  encoding?: string;
}

export interface ParserOptions {
  maxSize?: number;
  timeout?: number;
  encoding?: BufferEncoding;
  strict?: boolean;
}

export abstract class BaseParser<T = any> {
  protected options: Required<ParserOptions>;

  constructor(options: ParserOptions = {}) {
    this.options = {
      maxSize: 1024 * 1024, // 1MB default
      timeout: 30000, // 30 seconds
      encoding: 'utf8',
      strict: false,
      ...options,
    };
  }

  /**
   * 🎯 Main parsing method - template pattern
   */
  async parse(request: IncomingMessage): Promise<ParsedResult<T>> {
    const contentType = this.getContentType(request);
    const contentLength = this.getContentLength(request);

    // Validate before parsing
    this.validateRequest(request, contentLength);

    // Read raw data
    const rawData = await this.readRequestBody(request);

    // Parse the data using specific parser implementation
    const parsedData = await this.parseData(rawData, contentType);

    return {
      data: parsedData,
      raw: rawData,
      contentType,
      size:
        typeof rawData === 'string'
          ? Buffer.byteLength(rawData)
          : rawData.length,
      encoding: this.options.encoding,
    };
  }

  /**
   * 🔍 Abstract method - each parser implements its own logic
   */
  protected abstract parseData(
    data: string | Buffer,
    contentType: string
  ): Promise<T>;

  /**
   * 🛡️ Validation method - can be overridden
   */
  protected validateRequest(
    request: IncomingMessage,
    contentLength: number
  ): void {
    if (contentLength > this.options.maxSize) {
      throw new PayloadTooLargeError(
        `Request body too large. Maximum size: ${this.options.maxSize} bytes`
      );
    }
  }

  /**
   * 📖 Read request body with streaming support
   */
  protected readRequestBody(
    request: IncomingMessage
  ): Promise<string | Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;

      const timeout = setTimeout(() => {
        request.destroy();
        reject(new RequestTimeoutError('Request timeout'));
      }, this.options.timeout);

      request.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;

        if (totalSize > this.options.maxSize) {
          clearTimeout(timeout);
          request.destroy();
          reject(new PayloadTooLargeError('Request body too large'));
          return;
        }

        chunks.push(chunk);
      });

      request.on('end', () => {
        clearTimeout(timeout);
        const buffer = Buffer.concat(chunks);

        // Return as string for text parsers, buffer for binary
        if (this.shouldReturnBuffer()) {
          resolve(buffer);
        } else {
          resolve(buffer.toString(this.options.encoding));
        }
      });

      request.on('error', (error) => {
        clearTimeout(timeout);
        reject(new ParseError(`Request error: ${error.message}`));
      });

      request.on('aborted', () => {
        clearTimeout(timeout);
        reject(new ParseError('Request aborted'));
      });
    });
  }

  /**
   * 🎛️ Helper methods
   */
  protected getContentType(request: IncomingMessage): string {
    return request.headers['content-type'] || 'application/octet-stream';
  }

  protected getContentLength(request: IncomingMessage): number {
    return parseInt(request.headers['content-length'] || '0', 10);
  }

  protected shouldReturnBuffer(): boolean {
    return false; // Override in binary parsers
  }

  /**
   * ⚙️ Configuration management
   */
  configure(options: Partial<ParserOptions>): this {
    this.options = { ...this.options, ...options };
    return this;
  }
}

/**
 * 🚨 Custom Error Classes
 */
export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

export class PayloadTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayloadTooLargeError';
  }
}

export class RequestTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestTimeoutError';
  }
}

export class UnsupportedMediaTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedMediaTypeError';
  }
}
