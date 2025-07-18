/**
 * 🎯 Enhanced NextRush Request - Perfect OOP request handling
 * Integrates Ultimate Body Parser with Express-style API
 */

import { IncomingMessage } from 'http';
import { parse as parseUrl } from 'url';
import { NextRushRequest } from '../../types/express';
import {
  FileUpload,
  UltimateBodyParser,
  UnifiedParsedResult,
} from '../parsers';

export interface EnhancedRequestOptions {
  maxBodySize?: number;
  timeout?: number;
  autoParseBody?: boolean;
  enableFileUploads?: boolean;
  uploadDir?: string;
  maxFiles?: number;
  maxFileSize?: number;
  allowedMimeTypes?: string[];
}

export class NextRushRequestEnhancer {
  private bodyParser: UltimateBodyParser;
  private options: Required<EnhancedRequestOptions>;

  constructor(options: EnhancedRequestOptions = {}) {
    this.options = {
      maxBodySize: 10 * 1024 * 1024, // 10MB
      timeout: 30000, // 30 seconds
      autoParseBody: true,
      enableFileUploads: true,
      uploadDir: require('os').tmpdir(),
      maxFiles: 10,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: [],
      ...options,
    };

    this.bodyParser = new UltimateBodyParser({
      maxSize: this.options.maxBodySize,
      timeout: this.options.timeout,
      autoDetectContentType: true,
      maxFiles: this.options.maxFiles,
      maxFileSize: this.options.maxFileSize,
      uploadDir: this.options.uploadDir,
      allowedMimeTypes: this.options.allowedMimeTypes,
      memoryStorage: true,
      keepExtensions: true,
    });
  }

  /**
   * 🎯 Enhance an IncomingMessage into a full NextRushRequest
   */
  async enhance(req: IncomingMessage): Promise<NextRushRequest> {
    const enhanced = req as NextRushRequest;

    // Basic URL parsing
    this.enhanceUrlParsing(enhanced);

    // Add utility methods
    this.addUtilityMethods(enhanced);

    // Add body parsing methods
    this.addBodyMethods(enhanced);

    // Add file handling methods
    this.addFileMethods(enhanced);

    // Auto-parse body if enabled and has content
    if (this.options.autoParseBody && this.hasBody(enhanced)) {
      await this.parseBody(enhanced);
    }

    return enhanced;
  }

  private enhanceUrlParsing(req: NextRushRequest): void {
    const parsed = parseUrl(req.url || '', true);
    req.query = parsed.query;
    req.pathname = parsed.pathname || '/';
    req.path = req.pathname;
    req.originalUrl = req.url || '/';

    // Initialize empty params if not set
    if (!req.params) {
      req.params = {};
    }
  }

  private addUtilityMethods(req: NextRushRequest): void {
    // Get parameter by name
    req.param = function (name: string): string | undefined {
      return this.params?.[name];
    };

    // Get header value
    req.header = function (name: string): string | undefined {
      return this.headers[name.toLowerCase()] as string;
    };

    // Alias for header
    req.get = req.header;

    // Get client IP
    req.ip = function (): string {
      return (
        (this.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        this.connection?.remoteAddress ||
        this.socket?.remoteAddress ||
        'unknown'
      );
    };

    // Check if request is secure (HTTPS)
    req.secure = function (): boolean {
      return (
        this.headers['x-forwarded-proto'] === 'https' ||
        (this.connection as any)?.encrypted === true
      );
    };

    // Check if request accepts certain content type
    req.accepts = function (types: string | string[]): string | false {
      const acceptHeader = this.headers.accept as string;
      if (!acceptHeader) return false;

      const typeArray = Array.isArray(types) ? types : [types];
      for (const type of typeArray) {
        if (acceptHeader.includes(type) || acceptHeader.includes('*/*')) {
          return type;
        }
      }
      return false;
    };

    // Get request content type
    req.is = function (type: string): boolean {
      const contentType = this.headers['content-type'] as string;
      if (!contentType) return false;
      return contentType.includes(type);
    };

    // Additional utility methods not in interface
    (req as any).isJson = function (): boolean {
      return this.is('application/json');
    };

    (req as any).isForm = function (): boolean {
      return this.is('application/x-www-form-urlencoded');
    };

    (req as any).isMultipart = function (): boolean {
      return this.is('multipart/form-data');
    };

    // Initialize required properties
    if (!req.files) {
      req.files = {};
    }
    if (!req.cookies) {
      req.cookies = {};
    }
    if (!req.session) {
      req.session = {};
    }
    if (!req.locals) {
      req.locals = {};
    }
    if (!req.startTime) {
      req.startTime = Date.now();
    }
  }

  private addBodyMethods(req: NextRushRequest): void {
    let bodyParsed = false;
    let parsedResult: UnifiedParsedResult | null = null;

    // Parse request body
    (req as any).parseBody = async (): Promise<UnifiedParsedResult> => {
      if (!bodyParsed) {
        parsedResult = await this.parseBody(req);
        bodyParsed = true;
      }
      return parsedResult!;
    };

    // Get parsed body data
    (req as any).getBody = async (): Promise<any> => {
      const result = await (req as any).parseBody();
      return result.data;
    };

    // Get body as JSON
    (req as any).json = async (): Promise<any> => {
      const result = await (req as any).parseBody();
      if (result.parser !== 'json') {
        throw new Error('Request body is not JSON');
      }
      return result.data;
    };

    // Get body as text
    (req as any).text = async (): Promise<string> => {
      const result = await (req as any).parseBody();
      if (typeof result.data === 'string') {
        return result.data;
      }
      return String(result.data);
    };

    // Get body as buffer
    (req as any).buffer = async (): Promise<Buffer> => {
      const result = await (req as any).parseBody();
      if (Buffer.isBuffer(result.raw)) {
        return result.raw;
      }
      return Buffer.from(String(result.raw));
    };

    // Check if body is empty
    (req as any).isEmpty = function (): boolean {
      const contentLength = parseInt(
        (this.headers['content-length'] as string) || '0'
      );
      return contentLength === 0;
    };

    // Get content length
    (req as any).contentLength = function (): number {
      return parseInt((this.headers['content-length'] as string) || '0');
    };
  }

  private addFileMethods(req: NextRushRequest): void {
    // Get uploaded files
    (req as any).getFiles = async (): Promise<
      Record<string, FileUpload | FileUpload[]>
    > => {
      const result = await (req as any).parseBody();
      return result.files || {};
    };

    // Get single file by field name
    (req as any).getFile = async (
      fieldname: string
    ): Promise<FileUpload | null> => {
      const files = await (req as any).getFiles();
      const file = files[fieldname];
      if (!file) return null;
      return Array.isArray(file) ? file[0] : file;
    };

    // Get all files as array
    (req as any).allFiles = async (): Promise<FileUpload[]> => {
      const files = await (req as any).getFiles();
      const allFiles: FileUpload[] = [];

      for (const file of Object.values(files)) {
        if (Array.isArray(file)) {
          allFiles.push(...(file as FileUpload[]));
        } else {
          allFiles.push(file as FileUpload);
        }
      }

      return allFiles;
    };

    // Check if request has files
    (req as any).hasFiles = async (): Promise<boolean> => {
      const result = await (req as any).parseBody();
      return result.hasFiles;
    };

    // Get form fields (for multipart)
    (req as any).getFields = async (): Promise<
      Record<string, string | string[]>
    > => {
      const result = await (req as any).parseBody();
      return result.fields || {};
    };

    // Get single field value
    (req as any).getField = async (name: string): Promise<string | null> => {
      const fields = await (req as any).getFields();
      const field = fields[name];
      if (!field) return null;
      return Array.isArray(field) ? field[0] : field;
    };

    // Update the standard files property with parsed files
    (req as any)._updateFilesProperty = async () => {
      const parsedFiles = await (req as any).getFiles();
      req.files = parsedFiles;
    };
  }

  private async parseBody(req: NextRushRequest): Promise<UnifiedParsedResult> {
    try {
      const result = await this.bodyParser.parse(req);

      // Store parsed data for easy access
      req.body = result.data;

      // Cast to our enhanced type to access additional properties
      const enhancedResult = result.data as UnifiedParsedResult;

      // Update the files property if available
      if (enhancedResult.files) {
        req.files = enhancedResult.files;
      }

      return enhancedResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse request body: ${errorMessage}`);
    }
  }

  private hasBody(req: NextRushRequest): boolean {
    const method = req.method?.toUpperCase();
    const hasContentLength =
      req.headers['content-length'] &&
      parseInt(req.headers['content-length'] as string) > 0;
    const hasTransferEncoding = req.headers['transfer-encoding'];

    return (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method || '') &&
      Boolean(hasContentLength || hasTransferEncoding)
    );
  }

  /**
   * 🔧 Update parser options
   */
  updateOptions(newOptions: Partial<EnhancedRequestOptions>): void {
    this.options = { ...this.options, ...newOptions };

    // Recreate body parser with new options
    this.bodyParser = new UltimateBodyParser({
      maxSize: this.options.maxBodySize,
      timeout: this.options.timeout,
      autoDetectContentType: true,
      maxFiles: this.options.maxFiles,
      maxFileSize: this.options.maxFileSize,
      uploadDir: this.options.uploadDir,
      allowedMimeTypes: this.options.allowedMimeTypes,
      memoryStorage: true,
      keepExtensions: true,
    });
  }

  /**
   * 📊 Get parser statistics
   */
  getStats() {
    return {
      ...this.bodyParser.getStats(),
      options: this.options,
    };
  }
}

/**
 * 🎯 Default request enhancer instance
 */
export const defaultRequestEnhancer = new NextRushRequestEnhancer();

/**
 * 🎯 Helper function to enhance a request
 */
export async function enhanceRequest(
  req: IncomingMessage,
  options?: EnhancedRequestOptions
): Promise<NextRushRequest> {
  if (options) {
    const enhancer = new NextRushRequestEnhancer(options);
    return enhancer.enhance(req);
  }
  return defaultRequestEnhancer.enhance(req);
}
