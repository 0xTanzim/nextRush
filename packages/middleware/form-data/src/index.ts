/**
 * @nextrush/form-data
 *
 * Zero-dependency multipart/form-data middleware for NextRush.
 * Uses Web Streams API — works on Node.js, Bun, Deno, and Edge runtimes.
 *
 * @packageDocumentation
 */

// Middleware factory
export { formData } from './middleware.js';

// Storage strategies
export { DiskStorage } from './storage/disk.js';
export type { DiskStorageOptions } from './storage/disk.js';
export { MemoryStorage } from './storage/memory.js';

// Parser (for advanced usage)
export { parseMultipart } from './parser.js';
export type { ParsedResult } from './parser.js';

// Scanner (for advanced/custom parsing)
export { BoundaryScanner } from './scanner.js';
export type { ScanResult } from './scanner.js';

// Errors
export { FormDataError } from './errors.js';

// Types
export type {
  FileInfo,
  FormDataErrorCode,
  FormDataField,
  FormDataLimits,
  FormDataOptions,
  FormDataState,
  StorageResult,
  StorageStrategy,
  UploadedFile
} from './types.js';
