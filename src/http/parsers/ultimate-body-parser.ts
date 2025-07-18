/**
 * 🎯 Ultimate Body Parser - A unified parser that handles everything
 * Extends BaseParser and integrates all specialized parsers
 */

import {
  BaseParser,
  ParsedResult,
  ParseError,
  ParserOptions,
} from './base-parser';
import {
  JsonParser,
  RawParser,
  TextParser,
  UrlEncodedParser,
} from './content-parsers';
import {
  FileUpload,
  MultipartParser,
  MultipartResult,
} from './multipart-parser';

export interface UnifiedParserOptions extends ParserOptions {
  // JSON options
  jsonReviver?: (key: string, value: any) => any;

  // URL-encoded options
  urlEncodedExtended?: boolean;

  // Multipart options
  maxFiles?: number;
  maxFileSize?: number;
  maxFieldSize?: number;
  maxFields?: number;
  uploadDir?: string;
  keepExtensions?: boolean;
  allowedMimeTypes?: string[];
  memoryStorage?: boolean;

  // Auto-detection
  autoDetectContentType?: boolean;
}

export interface UnifiedParsedResult extends ParsedResult {
  // File uploads (for multipart)
  files?: Record<string, FileUpload | FileUpload[]>;
  fields?: Record<string, string | string[]>;

  // Helper properties
  hasFiles: boolean;
  isEmpty: boolean;
  parser: string;
}

export class UltimateBodyParser extends BaseParser<UnifiedParsedResult> {
  private unifiedOptions: UnifiedParserOptions;

  constructor(options: UnifiedParserOptions = {}) {
    super(options);
    this.unifiedOptions = {
      autoDetectContentType: true,
      urlEncodedExtended: true,
      maxFiles: 10,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      maxFieldSize: 1024 * 1024, // 1MB
      maxFields: 100,
      memoryStorage: true,
      keepExtensions: true,
      allowedMimeTypes: [],
      uploadDir: require('os').tmpdir(),
      ...options,
    };
  }

  protected override shouldReturnBuffer(): boolean {
    // We handle both string and buffer based on content type
    return false;
  }

  protected async parseData(
    data: string | Buffer,
    contentType: string
  ): Promise<UnifiedParsedResult> {
    const buffer = Buffer.isBuffer(data)
      ? data
      : Buffer.from(data, this.options.encoding);
    const normalizedContentType = this.normalizeContentType(contentType);

    // Auto-detect content type if enabled and unknown
    let finalContentType = normalizedContentType;
    if (
      this.unifiedOptions.autoDetectContentType &&
      normalizedContentType === 'application/octet-stream'
    ) {
      const detected = this.detectContentType(buffer);
      if (detected) {
        finalContentType = detected;
      }
    }

    // Route to appropriate parser based on content type
    let parsedData: any;
    let parser = 'unknown';
    let files: Record<string, FileUpload | FileUpload[]> | undefined;
    let fields: Record<string, string | string[]> | undefined;

    try {
      if (finalContentType.includes('application/json')) {
        parsedData = await this.parseJson(buffer);
        parser = 'json';
      } else if (
        finalContentType.includes('application/x-www-form-urlencoded')
      ) {
        parsedData = await this.parseUrlEncoded(buffer);
        parser = 'urlencoded';
      } else if (finalContentType.includes('multipart/form-data')) {
        const multipartResult = await this.parseMultipart(
          buffer,
          finalContentType
        );
        parsedData = multipartResult.fields;
        files = multipartResult.files;
        fields = multipartResult.fields;
        parser = 'multipart';
      } else if (finalContentType.includes('text/')) {
        parsedData = await this.parseText(buffer);
        parser = 'text';
      } else {
        parsedData = await this.parseRaw(buffer);
        parser = 'raw';
      }
    } catch (error) {
      if (error instanceof ParseError) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new ParseError(`Failed to parse ${parser} data: ${errorMessage}`);
    }

    const result: UnifiedParsedResult = {
      data: parsedData,
      raw: data,
      contentType: finalContentType,
      size: buffer.length,
      encoding: this.options.encoding,
      hasFiles: Boolean(files && Object.keys(files).length > 0),
      isEmpty: this.isEmpty(parsedData),
      parser,
    };

    if (files) {
      result.files = files;
    }
    if (fields) {
      result.fields = fields;
    }

    return result;
  }

  private async parseJson(buffer: Buffer): Promise<any> {
    const options: any = {
      maxSize: this.options.maxSize,
      timeout: this.options.timeout,
    };

    if (this.unifiedOptions.jsonReviver) {
      options.reviver = this.unifiedOptions.jsonReviver;
    }

    const jsonParser = new JsonParser(options);
    const mockRequest = this.createMockRequest(buffer, 'application/json');
    const result = await jsonParser.parse(mockRequest);
    return result.data;
  }

  private async parseUrlEncoded(buffer: Buffer): Promise<Record<string, any>> {
    const urlParser = new UrlEncodedParser({
      maxSize: this.options.maxSize,
      timeout: this.options.timeout,
      extended: this.unifiedOptions.urlEncodedExtended ?? true,
    });

    const mockRequest = this.createMockRequest(
      buffer,
      'application/x-www-form-urlencoded'
    );
    const result = await urlParser.parse(mockRequest);
    return result.data;
  }

  private async parseMultipart(
    buffer: Buffer,
    contentType: string
  ): Promise<MultipartResult> {
    const multipartParser = new MultipartParser({
      maxSize: this.options.maxSize,
      timeout: this.options.timeout,
      maxFiles: this.unifiedOptions.maxFiles ?? 10,
      maxFileSize: this.unifiedOptions.maxFileSize ?? 5 * 1024 * 1024,
      maxFieldSize: this.unifiedOptions.maxFieldSize ?? 1024 * 1024,
      maxFields: this.unifiedOptions.maxFields ?? 100,
      uploadDir: this.unifiedOptions.uploadDir ?? require('os').tmpdir(),
      keepExtensions: this.unifiedOptions.keepExtensions ?? true,
      allowedMimeTypes: this.unifiedOptions.allowedMimeTypes ?? [],
      memoryStorage: this.unifiedOptions.memoryStorage ?? true,
    });

    const mockRequest = this.createMockRequest(buffer, contentType);
    const result = await multipartParser.parse(mockRequest);
    return result.data;
  }

  private async parseText(buffer: Buffer): Promise<string> {
    const textParser = new TextParser({
      maxSize: this.options.maxSize,
      timeout: this.options.timeout,
      encoding: this.options.encoding,
    });

    const mockRequest = this.createMockRequest(buffer, 'text/plain');
    const result = await textParser.parse(mockRequest);
    return result.data;
  }

  private async parseRaw(buffer: Buffer): Promise<Buffer> {
    const rawParser = new RawParser({
      maxSize: this.options.maxSize,
      timeout: this.options.timeout,
    });

    const mockRequest = this.createMockRequest(
      buffer,
      'application/octet-stream'
    );
    const result = await rawParser.parse(mockRequest);
    return result.data;
  }

  private createMockRequest(buffer: Buffer, contentType: string): any {
    let dataIndex = 0;
    const chunks = [buffer];

    return {
      headers: {
        'content-type': contentType,
        'content-length': buffer.length.toString(),
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
          // Store error callback
        }
      },
      destroy: () => {},
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

  private detectContentType(buffer: Buffer): string | null {
    if (buffer.length === 0) return null;

    // Check for JSON
    const sample = buffer
      .toString('utf8', 0, Math.min(100, buffer.length))
      .trim();
    if (
      (sample.startsWith('{') && sample.includes('"')) ||
      (sample.startsWith('[') && sample.includes('"'))
    ) {
      return 'application/json';
    }

    // Check for URL-encoded (contains = and &)
    if (
      sample.includes('=') &&
      (sample.includes('&') || !sample.includes(' '))
    ) {
      return 'application/x-www-form-urlencoded';
    }

    // Check for multipart boundary
    if (sample.includes('--') && sample.includes('Content-Disposition')) {
      return 'multipart/form-data';
    }

    // Check if it's printable text
    const isPrintableText = /^[\x20-\x7E\s]*$/.test(sample);
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
   * 🎯 Quick parse method for buffer + content type
   */
  async parseBuffer(
    buffer: Buffer,
    contentType: string = 'application/octet-stream'
  ): Promise<UnifiedParsedResult> {
    return this.parseData(buffer, contentType);
  }

  /**
   * 📊 Get parsing statistics
   */
  getStats() {
    return {
      maxSize: this.options.maxSize,
      autoDetection: this.unifiedOptions.autoDetectContentType,
      supportedTypes: [
        'application/json',
        'application/x-www-form-urlencoded',
        'multipart/form-data',
        'text/*',
        'application/octet-stream',
      ],
    };
  }
}
