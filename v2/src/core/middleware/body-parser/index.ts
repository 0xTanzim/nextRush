/**
 * 🚀 Smart Body Parser Dispatcher - NextRush v2
 *
 * INTELLIGENT CONTENT-TYPE AWARE PARSER LOADER
 *
 * 🎯 **PERFORMANCE BREAKTHROUGH:**
 * - 🔥 Only loads the parser you need based on Content-Type
 * - ⚡ JSON request → Only loads JSON parser (~150 lines)
 * - 🌊 Multipart request → Only loads multipart parser (~200 lines)
 * - 🎭 Form request → Only loads URL-encoded parser (~150 lines)
 * - 📄 Text request → Only loads text parser (~100 lines)
 * - 💾 Raw request → Only loads raw parser (~100 lines)
 *
 * OLD WAY: Every request loads 1,032 lines ❌
 * NEW WAY: Each request loads only 100-200 lines ✅
 *
 * @author NextRush Framework Team
 * @version 2.0.0
 */

import type { Context, Middleware } from '../../../types/context';
import { HttpError } from './http-error';
import type {
  BodyParser,
  BodyParseResult,
  EnhancedBodyParserOptions,
} from './types';
import {
  createTimeoutPromise,
  detectContentType,
  validateContentLength,
} from './utils';

export type BodyParserMetrics = {
  parser: string;
  parseTime: number;
  size: number;
  hasFiles: boolean;
};

export type ContextWithMetrics = Context & {
  bodyParserMetrics?: BodyParserMetrics;
};

export type SmartBodyParserOptions = EnhancedBodyParserOptions & {
  /** Enable intelligent parser selection (default: true) */
  enableSmartParsing?: boolean;

  /** Enable parser lazy loading (default: true) */
  enableLazyLoading?: boolean;

  /** Custom parser priority (default: auto-detected) */
  parserPriority?: ('json' | 'urlencoded' | 'multipart' | 'text' | 'raw')[];
};

/**
 * 🎯 Pre-compiled regex patterns for maximum speed
 */
const CONTENT_TYPE_PATTERNS = {
  json: /^application\/(?:json|.*\+json)$/i,
  urlencoded: /^application\/x-www-form-urlencoded$/i,
  multipart: /^multipart\/form-data/i,
  text: /^text\//i,
  xml: /^(?:application|text)\/(?:xml|.*\+xml)$/i,
} as const;

/**
 * 🚀 Smart body parser dispatcher class
 */
export class SmartBodyParser {
  private options: Required<EnhancedBodyParserOptions>;
  private metrics = {
    totalRequests: 0,
    parserLoads: {
      json: 0,
      urlencoded: 0,
      multipart: 0,
      text: 0,
      raw: 0,
    },
  };

  // 💾 Lazy-loaded parsers (only load when needed)
  private parsers = {
    json: null as BodyParser | null,
    urlencoded: null as BodyParser | null,
    multipart: null as BodyParser | null,
    text: null as BodyParser | null,
    raw: null as BodyParser | null,
  };

  constructor(options: EnhancedBodyParserOptions = {}) {
    this.options = {
      maxSize: 10 * 1024 * 1024, // 10MB
      timeout: 5000, // 5 seconds
      enableStreaming: true,
      streamingThreshold: 50 * 1024 * 1024, // 50MB
      poolSize: 100,
      fastValidation: true,
      autoDetectContentType: true,
      strictContentType: false,
      enableMetrics: true,
      encoding: 'utf8',
      errorMessages: {
        maxSizeExceeded: 'Request body too large',
        timeoutError: 'Body parsing timeout',
        invalidContentType: 'Unsupported content type',
        parseError: 'Failed to parse request body',
      },
      ...options,
    };
  }

  /**
   * 🎯 Main parsing dispatcher - SMART LOADING
   */
  async parse(ctx: Context): Promise<BodyParseResult> {
    const startTime = performance.now();
    this.metrics.totalRequests++;

    try {
      // Get raw body data
      const rawData = await this.getRawBody(ctx);

      // Detect content type
      const contentType = this.getContentType(ctx, rawData);

      // Validate content length
      validateContentLength(rawData, this.options.maxSize);

      // 🚀 SMART PARSER SELECTION - Only load what we need!
      const parser = await this.getParser(contentType);

      // Parse with timeout protection
      const parsePromise = parser.parse(rawData, contentType);
      const timeoutPromise = createTimeoutPromise(this.options.timeout);

      const partialResult = await Promise.race([parsePromise, timeoutPromise]);

      // Build complete result
      const result: BodyParseResult = {
        raw: rawData,
        size: rawData.length,
        ...partialResult,
        parseTime: performance.now() - startTime,
      } as BodyParseResult;

      return result;
    } catch (error) {
      // Handle JSON parsing errors with appropriate HTTP status codes
      if (error instanceof Error) {
        // Check if it's a JSON syntax error and return 400 (Bad Request)
        if (
          error.message.includes('JSON') ||
          error.message.includes('syntax') ||
          error.message.includes('Invalid JSON') ||
          error.message.includes('Unexpected token')
        ) {
          throw new HttpError(
            `${this.options.errorMessages.parseError}: ${error.message}`,
            400,
            'VALIDATION_ERROR'
          );
        }
      }

      throw new HttpError(
        `${this.options.errorMessages.parseError}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        500,
        'INTERNAL_SERVER_ERROR'
      );
    }
  }

  /**
   * 🎯 SMART PARSER LOADER - Only loads the parser you need!
   */
  private async getParser(contentType: string): Promise<BodyParser> {
    // 🔥 JSON parser (most common - load first)
    if (CONTENT_TYPE_PATTERNS.json.test(contentType)) {
      if (!this.parsers.json) {
        const { getJsonParser } = await import('./json-parser');
        this.parsers.json = getJsonParser();
        this.metrics.parserLoads.json++;
      }
      return this.parsers.json!;
    }

    // 🌊 URL-encoded parser
    if (CONTENT_TYPE_PATTERNS.urlencoded.test(contentType)) {
      if (!this.parsers.urlencoded) {
        const { getUrlEncodedParser } = await import('./url-encoded-parser');
        this.parsers.urlencoded = getUrlEncodedParser();
        this.metrics.parserLoads.urlencoded++;
      }
      return this.parsers.urlencoded!;
    }

    // 📁 Multipart parser (file uploads)
    if (CONTENT_TYPE_PATTERNS.multipart.test(contentType)) {
      if (!this.parsers.multipart) {
        const { getMultipartParser } = await import('./multipart-parser');
        this.parsers.multipart = getMultipartParser();
        this.metrics.parserLoads.multipart++;
      }
      return this.parsers.multipart!;
    }

    // 📄 Text parser
    if (
      CONTENT_TYPE_PATTERNS.text.test(contentType) ||
      CONTENT_TYPE_PATTERNS.xml.test(contentType)
    ) {
      if (!this.parsers.text) {
        const { getTextParser } = await import('./text-raw-parsers');
        this.parsers.text = getTextParser();
        this.metrics.parserLoads.text++;
      }
      return this.parsers.text!;
    }

    // 💾 Raw parser (fallback for binary data)
    if (!this.parsers.raw) {
      const { getRawParser } = await import('./text-raw-parsers');
      this.parsers.raw = getRawParser();
      this.metrics.parserLoads.raw++;
    }
    return this.parsers.raw!;
  }

  /**
   * 🔍 Get content type with auto-detection
   */
  private getContentType(ctx: Context, rawData: Buffer): string {
    const headerContentType = ctx.headers['content-type'] || '';

    // Use header content type if available
    if (headerContentType && !this.options.autoDetectContentType) {
      return headerContentType.split(';')[0]?.trim().toLowerCase() || '';
    }

    // Auto-detect if enabled or no header present
    if (this.options.autoDetectContentType || !headerContentType) {
      const detected = detectContentType(rawData);
      return headerContentType || detected;
    }

    return headerContentType.split(';')[0]?.trim().toLowerCase() || '';
  }

  /**
   * 📥 Get raw body data from request
   */
  private async getRawBody(ctx: Context): Promise<Buffer> {
    // If body already exists on context, return it
    if (ctx.req.body && Buffer.isBuffer(ctx.req.body)) {
      return ctx.req.body;
    }

    // Read from request stream
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;

      ctx.req.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;

        if (totalSize > this.options.maxSize) {
          reject(new Error(this.options.errorMessages.maxSizeExceeded!));
          return;
        }

        chunks.push(chunk);
      });

      ctx.req.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      ctx.req.on('error', (error: Error) => {
        reject(error);
      });

      // Set timeout
      const timeout = setTimeout(() => {
        reject(new Error(this.options.errorMessages.timeoutError!));
      }, this.options.timeout);

      ctx.req.on('end', () => clearTimeout(timeout));
      ctx.req.on('error', () => clearTimeout(timeout));
    });
  }

  /**
   * 📊 Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      efficiency: {
        totalRequests: this.metrics.totalRequests,
        averageParserLoads:
          Object.values(this.metrics.parserLoads).reduce((a, b) => a + b, 0) /
          this.metrics.totalRequests,
        parserUsage: this.metrics.parserLoads,
      },
    };
  }
}

/**
 * 🌍 Global smart parser instance (removed unused variable)
 */

/**
 * 🚀 Create smart body parser middleware
 */
export function smartBodyParser(
  options?: EnhancedBodyParserOptions
): Middleware {
  const parser = new SmartBodyParser(options);

  return async (ctx: Context, next: () => Promise<void>) => {
    // Skip if body already parsed
    if (ctx.body !== undefined) {
      await next();
      return;
    }

    // Skip if no body expected
    const method = ctx.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'DELETE') {
      await next();
      return;
    }

    try {
      // 🚀 SMART PARSING - Only loads needed parser!
      const result = await parser.parse(ctx);

      // Set parsed data on context (handle empty body case)
      ctx.body = result.data !== undefined ? result.data : null;

      // Add metadata for debugging
      if (options?.enableMetrics) {
        (ctx as ContextWithMetrics).bodyParserMetrics = {
          parser: result.parser,
          parseTime: result.parseTime,
          size: result.size,
          hasFiles: result.hasFiles,
        };
      }

      await next();
    } catch (error) {
      // Convert specific errors to HttpError if they aren't already
      let httpError: HttpError;

      if (error instanceof HttpError) {
        httpError = error;
      } else if (error instanceof Error) {
        // Check if it's a JSON validation error or other client error
        if (
          error.message.includes('JSON parse error') ||
          error.message.includes('Invalid JSON') ||
          error.message.includes('invalid character') ||
          error.message.includes('Unexpected') ||
          error.message.includes('too large') ||
          error.message.includes('maxSize') ||
          error.message.includes('structure detected')
        ) {
          httpError = new HttpError(error.message, 400, 'VALIDATION_ERROR');
        } else {
          httpError = new HttpError(
            error.message,
            500,
            'INTERNAL_SERVER_ERROR'
          );
        }
      } else {
        httpError = new HttpError(
          'Unknown error occurred',
          500,
          'INTERNAL_SERVER_ERROR'
        );
      }

      // Always throw the error to let exception filters handle it
      throw httpError;
    }
  };
}

/**
 * 📦 Default exports for easy import
 */
export { SmartBodyParser as BodyParser };
export default smartBodyParser;
