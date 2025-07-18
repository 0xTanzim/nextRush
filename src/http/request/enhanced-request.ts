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

    // Get client IP with enhanced proxy support
    req.ip = function (): string {
      return (
        (this.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        (this.headers['x-real-ip'] as string) ||
        this.connection?.remoteAddress ||
        this.socket?.remoteAddress ||
        '127.0.0.1'
      );
    };

    // Check if request is secure (HTTPS)
    req.secure = function (): boolean {
      return (
        this.headers['x-forwarded-proto'] === 'https' ||
        (this.connection as any)?.encrypted === true
      );
    };

    // Get protocol
    req.protocol = function (): string {
      return this.secure() ? 'https' : 'http';
    };

    // Get hostname
    req.hostname = function (): string {
      return (this.headers.host as string)?.split(':')[0] || 'localhost';
    };

    // Get full URL
    req.fullUrl = function (): string {
      return `${this.protocol()}://${this.headers.host}${this.originalUrl}`;
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

    // 🍪 Cookie support
    req.parseCookies = function (): Record<string, string> {
      if (this.cookies && Object.keys(this.cookies).length > 0) {
        return this.cookies;
      }

      const cookies: Record<string, string> = {};
      const cookieHeader = this.headers.cookie as string;

      if (cookieHeader) {
        cookieHeader.split(';').forEach((cookie) => {
          const [name, ...rest] = cookie.trim().split('=');
          if (name && rest.length > 0) {
            cookies[name] = decodeURIComponent(rest.join('=') || '');
          }
        });
      }

      this.cookies = cookies;
      return cookies;
    };

    // Parse cookies automatically
    req.parseCookies();

    // 🛡️ Enhanced validation methods
    req.validate = function (rules: Record<string, any>): {
      isValid: boolean;
      errors: Record<string, string[]>;
      sanitized: Record<string, any>;
    } {
      const errors: Record<string, string[]> = {};
      const sanitized: Record<string, any> = {};

      for (const [field, rule] of Object.entries(rules)) {
        const value = this.body?.[field];
        const fieldErrors: string[] = [];

        // Required validation
        if (
          rule.required &&
          (value === undefined || value === null || value === '')
        ) {
          fieldErrors.push(`${field} is required`);
        }

        // Type validation
        if (value !== undefined && value !== null && rule.type) {
          switch (rule.type) {
            case 'email':
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                fieldErrors.push(`${field} must be a valid email`);
              }
              break;
            case 'number':
              if (isNaN(Number(value))) {
                fieldErrors.push(`${field} must be a number`);
              } else {
                sanitized[field] = Number(value);
              }
              break;
            case 'string':
              if (typeof value !== 'string') {
                fieldErrors.push(`${field} must be a string`);
              }
              break;
            case 'url':
              try {
                new URL(value);
              } catch {
                fieldErrors.push(`${field} must be a valid URL`);
              }
              break;
            case 'boolean':
              if (
                typeof value !== 'boolean' &&
                value !== 'true' &&
                value !== 'false'
              ) {
                fieldErrors.push(`${field} must be a boolean`);
              } else {
                sanitized[field] =
                  typeof value === 'boolean' ? value : value === 'true';
              }
              break;
          }
        }

        // Length validation
        if (value && typeof value === 'string') {
          if (rule.minLength && value.length < rule.minLength) {
            fieldErrors.push(
              `${field} must be at least ${rule.minLength} characters`
            );
          }
          if (rule.maxLength && value.length > rule.maxLength) {
            fieldErrors.push(
              `${field} must be at most ${rule.maxLength} characters`
            );
          }
        }

        // Number range validation
        if (
          value !== undefined &&
          rule.type === 'number' &&
          !isNaN(Number(value))
        ) {
          const numValue = Number(value);
          if (rule.min !== undefined && numValue < rule.min) {
            fieldErrors.push(`${field} must be at least ${rule.min}`);
          }
          if (rule.max !== undefined && numValue > rule.max) {
            fieldErrors.push(`${field} must be at most ${rule.max}`);
          }
        }

        // Custom validation
        if (rule.custom && typeof rule.custom === 'function') {
          const customResult = rule.custom(value);
          if (customResult !== true) {
            fieldErrors.push(
              typeof customResult === 'string'
                ? customResult
                : `${field} is invalid`
            );
          }
        }

        if (fieldErrors.length > 0) {
          errors[field] = fieldErrors;
        }

        // Add to sanitized data if no type conversion happened
        if (value !== undefined && !sanitized[field]) {
          sanitized[field] = value;
        }
      }

      return {
        isValid: Object.keys(errors).length === 0,
        errors,
        sanitized,
      };
    };

    // 🧹 Enhanced sanitization
    req.sanitize = function (options: any = {}): void {
      if (this.body && typeof this.body === 'object') {
        this.body = this.sanitizeObject(this.body, options);
      }
    };

    req.sanitizeObject = function (obj: any, options: any = {}): any {
      if (!obj || typeof obj !== 'object') return obj;

      const sanitized: any = Array.isArray(obj) ? [] : {};

      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          let sanitizedValue = value.trim();

          if (options.removeHtml !== false) {
            // Basic HTML sanitization
            sanitizedValue = sanitizedValue.replace(/<[^>]*>/g, '');
          }

          if (options.escapeHtml) {
            sanitizedValue = sanitizedValue
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#x27;');
          }

          sanitized[key] = sanitizedValue;
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeObject(value, options);
        } else {
          sanitized[key] = value;
        }
      }

      return sanitized;
    };

    // 🔍 Enhanced validation helpers
    req.isValidEmail = function (email: string): boolean {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    req.isValidUrl = function (url: string): boolean {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };

    // JSON validation utility
    (req as any).isValidJSON = function (str: string): boolean {
      try {
        JSON.parse(str);
        return true;
      } catch {
        return false;
      }
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
