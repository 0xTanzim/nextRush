/**
 * @nextrush/multipart - Type Definitions
 *
 * All interfaces and types for multipart file upload handling.
 * Uses Web APIs exclusively — works on Node.js, Bun, Deno, and Edge.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------

export type MultipartErrorCode =
  | 'FILE_TOO_LARGE'
  | 'FILES_LIMIT_EXCEEDED'
  | 'FIELDS_LIMIT_EXCEEDED'
  | 'PARTS_LIMIT_EXCEEDED'
  | 'INVALID_CONTENT_TYPE'
  | 'INVALID_FIELD_NAME'
  | 'INVALID_FILE_TYPE'
  | 'STORAGE_ERROR'
  | 'PARSE_ERROR'
  | 'REQUEST_ABORTED'
  | 'BODY_SIZE_EXCEEDED';

// ---------------------------------------------------------------------------
// File & Field Results
// ---------------------------------------------------------------------------

/** Represents a successfully uploaded file */
export interface UploadedFile {
  /** Form field name */
  readonly fieldName: string;
  /** Original filename from the client (unsanitized) */
  readonly originalName: string;
  /** Sanitized filename (safe for filesystem use) */
  readonly sanitizedName: string;
  /** Transfer encoding */
  readonly encoding: string;
  /** MIME type from the Content-Type header */
  readonly mimeType: string;
  /** File size in bytes */
  readonly size: number;
  /** Whether the file was truncated due to size limits */
  readonly truncated: boolean;
  /** In-memory buffer (MemoryStorage only) */
  readonly buffer?: Uint8Array;
  /** Filesystem path (DiskStorage only) */
  readonly path?: string;
}

/** Represents a non-file form field */
export interface MultipartField {
  readonly name: string;
  readonly value: string;
  readonly encoding: string;
  readonly mimeType: string;
  readonly truncated: boolean;
}

// ---------------------------------------------------------------------------
// Storage Strategy
// ---------------------------------------------------------------------------

/** Information about a file being uploaded, before storage */
export interface FileInfo {
  readonly fieldName: string;
  readonly originalName: string;
  readonly sanitizedName: string;
  readonly encoding: string;
  readonly mimeType: string;
}

/** Result returned by a storage strategy after handling a file */
export interface StorageResult {
  /** File size in bytes */
  readonly size: number;
  /** In-memory buffer (MemoryStorage) */
  readonly buffer?: Uint8Array;
  /** Filesystem path (DiskStorage) */
  readonly path?: string;
}

/** Interface for custom storage strategies */
export interface StorageStrategy {
  /** Handle an incoming file stream and return the storage result */
  handle(stream: ReadableStream<Uint8Array>, info: FileInfo): Promise<StorageResult>;
  /** Optional cleanup method for removing stored files */
  remove?(result: StorageResult): Promise<void>;
}

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export interface MultipartLimits {
  /** Maximum file size in bytes or human-readable string (e.g., '10mb'). Default: '5mb' */
  maxFileSize?: number | string;
  /** Maximum number of files. Default: 10 */
  maxFiles?: number;
  /** Maximum number of non-file fields. Default: 50 */
  maxFields?: number;
  /** Maximum total parts (files + fields). Default: 100 */
  maxParts?: number;
  /** Maximum field name size in bytes. Default: 200 */
  maxFieldNameSize?: number;
  /** Maximum field value size in bytes. Default: '1mb' */
  maxFieldSize?: number | string;
  /** Maximum header pairs per part. Default: 2000 */
  maxHeaderPairs?: number;
  /** Maximum total request body size in bytes or human-readable string (e.g., '10mb'). Default: '10mb' */
  maxBodySize?: number | string;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MultipartOptions {
  /** Storage strategy for uploaded files. Default: MemoryStorage */
  storage?: StorageStrategy;
  /** Upload limits */
  limits?: MultipartLimits;
  /**
   * Allowed MIME types. Supports wildcards (e.g., 'image/*').
   * If not set, all file types are accepted.
   */
  allowedTypes?: string[];
  /**
   * Custom filename generator. Receives sanitized name, returns final name.
   * Used by DiskStorage to determine the filename on disk.
   */
  filename?: (info: FileInfo) => string;
  /**
   * Whether to abort the upload on the first error.
   * If true (default), errors cause immediate rejection.
   * If false, truncated files are included in results with truncated=true.
   */
  abortOnError?: boolean;
}

// ---------------------------------------------------------------------------
// Context Extension
// ---------------------------------------------------------------------------

/** Shape of ctx.state after multipart middleware runs */
export interface MultipartState {
  /** Uploaded files */
  files: UploadedFile[];
  /** Non-file form fields */
  fields: Record<string, string>;
}
