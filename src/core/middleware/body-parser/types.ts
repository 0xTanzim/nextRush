/**
 * 🚀 Body Parser Types - NextRush v2
 *
 * Shared type definitions for all body parsers
 *
 * @author NextRush Framework Team
 * @version 2.0.0
 */

/**
 * 🎯 Parse result with metadata
 */
export interface BodyParseResult {
  /** Parsed data */
  data: unknown;

  /** Raw buffer data */
  raw: Buffer;

  /** Detected content type */
  contentType: string;

  /** Data size in bytes */
  size: number;

  /** Parser used (json, urlencoded, multipart, text, raw) */
  parser: string;

  /** Whether result contains files */
  hasFiles: boolean;

  /** Whether result is empty */
  isEmpty: boolean;

  /** File uploads (for multipart) */
  files?: Record<string, unknown> | undefined;

  /** Form fields (for multipart/urlencoded) */
  fields?: Record<string, unknown> | undefined;

  /** Parse time in milliseconds */
  parseTime: number;
}

/**
 * 🔧 Enhanced parser configuration with enterprise-grade settings
 */
export interface EnhancedBodyParserOptions {
  /** Maximum body size in bytes (default: 10MB) */
  maxSize?: number;

  /** Request timeout in milliseconds (default: 5s) */
  timeout?: number;

  /** Enable streaming for large payloads (default: true) */
  enableStreaming?: boolean;

  /** Streaming threshold in bytes (default: 50MB) */
  streamingThreshold?: number;

  /** Buffer pool size for optimization (default: 100) */
  poolSize?: number;

  /** Enable fast validation (default: true) */
  fastValidation?: boolean;

  /** Auto-detect content type (default: true) */
  autoDetectContentType?: boolean;

  /** Strict content type checking (default: false) */
  strictContentType?: boolean;

  /** Enable metrics collection (default: true) */
  enableMetrics?: boolean;

  /** Encoding for text-based content (default: 'utf8') */
  encoding?: BufferEncoding;

  /** Custom error messages */
  errorMessages?: {
    maxSizeExceeded?: string;
    timeoutError?: string;
    invalidContentType?: string;
    parseError?: string;
  };
}

/**
 * 📊 Body parser performance metrics
 */
export interface BodyParserMetrics {
  /** Total requests processed */
  totalRequests: number;

  /** Total bytes processed */
  totalBytes: number;

  /** Average parse time in milliseconds */
  averageParseTime: number;

  /** Success count for precise rate calculation */
  successCount: number;

  /** Failure count for precise rate calculation */
  failureCount: number;

  /** Parser type usage statistics */
  parserUsage: {
    json: number;
    urlencoded: number;
    multipart: number;
    text: number;
    raw: number;
  };

  /** Memory usage statistics */
  memoryUsage: {
    bufferPoolSize: number;
    activeBuffers: number;
    peakMemory: number;
  };
}

/**
 * 🎯 Content type detection patterns
 */
export interface ContentTypePatterns {
  json: RegExp;
  urlencoded: RegExp;
  multipart: RegExp;
  text: RegExp;
  binary: RegExp;
}

/**
 * 🔍 Parser factory interface
 */
export interface BodyParser {
  parse(
    rawData: Buffer,
    contentType: string
  ): Promise<Partial<BodyParseResult>>;
  getMetrics?(): Record<string, number>;
}

/**
 * 📦 Multipart file upload interface
 */
export interface UploadedFile {
  /** Original filename */
  filename: string;

  /** Field name in the form */
  fieldname: string;

  /** MIME type */
  mimetype: string;

  /** File size in bytes */
  size: number;

  /** File buffer data */
  buffer: Buffer;

  /** File encoding */
  encoding: string;
}

/**
 * 🌊 Stream processing options
 */
export interface StreamOptions {
  /** Enable streaming mode */
  enabled: boolean;

  /** Chunk size for processing */
  chunkSize: number;

  /** Maximum buffer size before streaming */
  maxBufferSize: number;

  /** Backpressure threshold */
  backpressureThreshold: number;
}
