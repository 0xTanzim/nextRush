/**
 * 🎯 Ultimate Body Parser Manager - Handles EVERYTHING automatically
 * Smart content-type detection and routing to appropriate parsers
 */

import { IncomingMessage } from 'http';
import { ParseError } from './base-parser';
import {
  JsonParser,
  RawParser,
  TextParser,
  UrlEncodedParser,
} from './content-parsers';
import { FileUpload, MultipartParser } from './multipart-parser';

export interface BodyParserOptions {
  // Size limits
  maxSize?: number;
  maxFileSize?: number;
  maxFiles?: number;
  maxFields?: number;
  maxFieldSize?: number;

  // Timeout settings
  timeout?: number;

  // JSON options
  jsonLimit?: number;
  jsonReviver?: (key: string, value: any) => any;

  // URL-encoded options
  urlEncodedLimit?: number;
  urlEncodedExtended?: boolean;

  // Text options
  textLimit?: number;
  textEncoding?: BufferEncoding;

  // Raw/binary options
  rawLimit?: number;
  rawMimeTypes?: string[];

  // Multipart options
  uploadDir?: string;
  keepExtensions?: boolean;
  allowedMimeTypes?: string[];
  memoryStorage?: boolean;

  // Streaming options
  enableStreaming?: boolean;
  streamingThreshold?: number;
  streamHighWaterMark?: number;

  // Auto-detection
  autoDetectContentType?: boolean;
  strictContentType?: boolean;
}

export interface ParsedBody {
  // Standard body content
  data?: any;

  // File uploads
  files?: Record<string, FileUpload | FileUpload[]>;
  fields?: Record<string, string | string[]>;

  // Metadata
  contentType: string;
  size: number;
  parser: string;

  // For streaming results
  tempFile?: string;
  cleanup?: () => Promise<void>;

  // Helper methods
  hasFiles: boolean;
  isEmpty: boolean;
}

export class BodyParserManager {
  private options: BodyParserOptions;

  constructor(options: BodyParserOptions = {}) {
    this.options = {
      // Size limits
      maxSize: 10 * 1024 * 1024, // 10MB default
      maxFileSize: 5 * 1024 * 1024, // 5MB per file
      maxFiles: 10,
      maxFields: 100,
      maxFieldSize: 1024 * 1024, // 1MB per field

      // Timeout
      timeout: 30000, // 30 seconds

      // JSON
      jsonLimit: 1024 * 1024, // 1MB

      // URL-encoded
      urlEncodedLimit: 1024 * 1024, // 1MB
      urlEncodedExtended: true,

      // Text
      textLimit: 1024 * 1024, // 1MB
      textEncoding: 'utf8',

      // Raw
      rawLimit: 10 * 1024 * 1024, // 10MB
      rawMimeTypes: ['application/octet-stream'],

      // Multipart
      uploadDir: require('os').tmpdir(),
      keepExtensions: true,
      allowedMimeTypes: [],
      memoryStorage: true,

      // Streaming
      enableStreaming: true,
      streamingThreshold: 50 * 1024 * 1024, // 50MB
      streamHighWaterMark: 64 * 1024, // 64KB

      // Auto-detection
      autoDetectContentType: true,
      strictContentType: false,
      ...options,
    };
  }

  /**
   * 🎯 Parse request body using mock request object
   */
  async parseBuffer(
    data: Buffer,
    contentType: string = 'application/octet-stream',
    contentLength?: number
  ): Promise<ParsedBody> {
    try {
      // Create a mock request object for the parsers
      const mockRequest = this.createMockRequest(
        data,
        contentType,
        contentLength
      );

      // Normalize content type
      const normalizedContentType = this.normalizeContentType(contentType);

      // Auto-detect if enabled and no explicit type
      if (
        this.options.autoDetectContentType &&
        normalizedContentType === 'application/octet-stream'
      ) {
        const detectedType = this.detectContentType(data);
        if (detectedType) {
          return this.parseBuffer(data, detectedType, contentLength);
        }
      }

      // Route to appropriate parser
      return this.parseWithParser(mockRequest, normalizedContentType, data);
    } catch (error) {
      if (error instanceof ParseError) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new ParseError(`Failed to parse request body: ${errorMessage}`);
    }
  }

  private createMockRequest(
    data: Buffer,
    contentType: string,
    contentLength?: number
  ): IncomingMessage {
    const mockRequest = {
      headers: {
        'content-type': contentType,
        'content-length': String(contentLength || data.length),
      },
      readable: false,
      _readableState: null,
      read: () => null,
      on: () => {},
      once: () => {},
      emit: () => false,
      _data: data, // Custom property to hold the data
    } as unknown as IncomingMessage;

    return mockRequest;
  }

  private createMockRequestForParsers(
    data: Buffer,
    contentType: string
  ): IncomingMessage {
    let dataIndex = 0;
    const chunks = [data];

    return {
      headers: {
        'content-type': contentType,
        'content-length': data.length.toString(),
      },
      on: (event: string, callback: Function) => {
        if (event === 'data') {
          // Simulate data chunks
          setImmediate(() => {
            if (dataIndex < chunks.length) {
              callback(chunks[dataIndex++]);
            }
          });
        } else if (event === 'end') {
          setImmediate(() => {
            if (dataIndex >= chunks.length) {
              callback();
            }
          });
        } else if (event === 'error') {
          // Store error callback for potential use
        }
      },
      destroy: () => {},
    } as unknown as IncomingMessage;
  }

  private async parseWithParser(
    request: IncomingMessage,
    contentType: string,
    rawData: Buffer
  ): Promise<ParsedBody> {
    let result: any;
    let parser: string;
    let hasFiles = false;

    // Create proper mock request for parsers
    const mockRequest = this.createMockRequestForParsers(rawData, contentType);

    if (contentType.includes('application/json')) {
      const jsonParser = new JsonParser({
        maxSize: this.options.jsonLimit || 1024 * 1024,
        timeout: this.options.timeout || 30000,
        ...(this.options.jsonReviver && { reviver: this.options.jsonReviver }),
      });
      const parsedResult = await jsonParser.parse(mockRequest);
      result = parsedResult.data;
      parser = 'json';
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const urlParser = new UrlEncodedParser({
        maxSize: this.options.urlEncodedLimit || 1024 * 1024,
        timeout: this.options.timeout || 30000,
        extended: this.options.urlEncodedExtended ?? true,
      });
      const parsedResult = await urlParser.parse(mockRequest);
      result = parsedResult.data;
      parser = 'urlencoded';
    } else if (contentType.includes('multipart/form-data')) {
      const multipartParser = new MultipartParser({
        maxSize: this.options.maxSize || 10 * 1024 * 1024,
        timeout: this.options.timeout || 30000,
        maxFiles: this.options.maxFiles || 10,
        maxFileSize: this.options.maxFileSize || 5 * 1024 * 1024,
        maxFieldSize: this.options.maxFieldSize || 1024 * 1024,
        maxFields: this.options.maxFields || 100,
        uploadDir: this.options.uploadDir || require('os').tmpdir(),
        keepExtensions: this.options.keepExtensions ?? true,
        allowedMimeTypes: this.options.allowedMimeTypes || [],
        memoryStorage: this.options.memoryStorage ?? true,
      });
      const parsedResult = await multipartParser.parse(mockRequest);
      const multipartResult = parsedResult.data;
      result = multipartResult.fields;
      hasFiles = Object.keys(multipartResult.files).length > 0;
      parser = 'multipart';

      return {
        data: result,
        files: multipartResult.files,
        fields: multipartResult.fields,
        contentType,
        size: rawData.length,
        parser,
        hasFiles,
        isEmpty: Object.keys(result).length === 0 && !hasFiles,
      };
    } else if (contentType.includes('text/')) {
      const textParser = new TextParser({
        maxSize: this.options.textLimit || 1024 * 1024,
        timeout: this.options.timeout || 30000,
        encoding: this.options.textEncoding || 'utf8',
      });
      const parsedResult = await textParser.parse(mockRequest);
      result = parsedResult.data;
      parser = 'text';
    } else {
      // Fall back to raw parser
      const rawParser = new RawParser({
        maxSize: this.options.rawLimit || 10 * 1024 * 1024,
        timeout: this.options.timeout || 30000,
      });
      const parsedResult = await rawParser.parse(mockRequest);
      result = parsedResult.data;
      parser = 'raw';
    }

    return {
      data: result,
      contentType,
      size: rawData.length,
      parser,
      hasFiles,
      isEmpty: this.isEmpty(result),
    };
  }

  private normalizeContentType(contentType: string): string {
    if (!contentType) return 'application/octet-stream';

    // Extract main type (remove charset, boundary, etc.)
    const mainType = contentType.split(';')[0].trim().toLowerCase();

    // Handle common variations
    const typeMap: Record<string, string> = {
      'application/x-json': 'application/json',
      'text/json': 'application/json',
      'application/form-data': 'multipart/form-data',
      'application/x-www-urlencoded': 'application/x-www-form-urlencoded',
    };

    return typeMap[mainType] || mainType;
  }

  private detectContentType(data: Buffer): string | null {
    if (data.length === 0) return null;

    // Check for JSON
    const trimmed = data.toString('utf8', 0, Math.min(100, data.length)).trim();
    if (
      (trimmed.startsWith('{') && trimmed.includes('"')) ||
      (trimmed.startsWith('[') && trimmed.includes('"'))
    ) {
      return 'application/json';
    }

    // Check for URL-encoded (contains = and &)
    if (
      trimmed.includes('=') &&
      (trimmed.includes('&') || !trimmed.includes(' '))
    ) {
      return 'application/x-www-form-urlencoded';
    }

    // Check for multipart boundary
    if (trimmed.includes('--') && trimmed.includes('Content-Disposition')) {
      return 'multipart/form-data';
    }

    // Check if it's printable text
    const isPrintableText = /^[\x20-\x7E\s]*$/.test(trimmed);
    if (isPrintableText) {
      return 'text/plain';
    }

    return null;
  }

  private isEmpty(data: any): boolean {
    if (data === null || data === undefined) return true;
    if (typeof data === 'string') return data.length === 0;
    if (typeof data === 'object') return Object.keys(data).length === 0;
    if (Buffer.isBuffer(data)) return data.length === 0;
    return false;
  }

  /**
   * 🔧 Update parser options at runtime
   */
  updateOptions(newOptions: Partial<BodyParserOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * 📊 Get parser statistics
   */
  getStats(): {
    maxSize: number;
    enabledParsers: string[];
    autoDetectionEnabled: boolean;
  } {
    return {
      maxSize: this.options.maxSize || 10 * 1024 * 1024,
      enabledParsers: ['json', 'urlencoded', 'text', 'raw', 'multipart'],
      autoDetectionEnabled: this.options.autoDetectContentType || false,
    };
  }

  /**
   * 🧹 Cleanup any temporary resources
   */
  async cleanup(): Promise<void> {
    // Cleanup is handled by individual parsers and their results
    // This method exists for API consistency
  }
}
