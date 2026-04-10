/**
 * @nextrush/multipart - Error Classes
 *
 * Custom error class for multipart parsing failures.
 *
 * @packageDocumentation
 */

import type { MultipartErrorCode } from './types.js';

const V8Error = Error as ErrorConstructor & {
  captureStackTrace?: (targetObject: object, constructorOpt?: Function) => void;
};

/**
 * Error thrown when multipart parsing fails.
 *
 * Includes HTTP status code, error code, and whether
 * the message is safe to expose to clients.
 */
export class MultipartError extends Error {
  public readonly status: number;
  public readonly code: MultipartErrorCode;
  public readonly expose: boolean;

  constructor(message: string, status: number, code: MultipartErrorCode) {
    super(message);
    this.name = 'MultipartError';
    this.status = status;
    this.code = code;
    this.expose = status < 500;

    if (V8Error.captureStackTrace) {
      V8Error.captureStackTrace(this, MultipartError);
    }
  }

  toJSON(): {
    name: string;
    message: string;
    status: number;
    code: MultipartErrorCode;
  } {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
    };
  }
}

export const Errors = {
  fileTooLarge(filename: string, limit: number): MultipartError {
    return new MultipartError(
      `File "${safeDisplay(filename)}" exceeds the ${formatBytes(limit)} size limit`,
      413,
      'FILE_TOO_LARGE'
    );
  },

  filesLimitExceeded(limit: number): MultipartError {
    return new MultipartError(
      `Maximum number of files (${limit}) exceeded`,
      413,
      'FILES_LIMIT_EXCEEDED'
    );
  },

  fieldsLimitExceeded(limit: number): MultipartError {
    return new MultipartError(
      `Maximum number of fields (${limit}) exceeded`,
      413,
      'FIELDS_LIMIT_EXCEEDED'
    );
  },

  partsLimitExceeded(limit: number): MultipartError {
    return new MultipartError(
      `Maximum number of parts (${limit}) exceeded`,
      413,
      'PARTS_LIMIT_EXCEEDED'
    );
  },

  invalidContentType(contentType: string): MultipartError {
    return new MultipartError(
      `Expected multipart/form-data but received "${safeDisplay(contentType)}"`,
      415,
      'INVALID_CONTENT_TYPE'
    );
  },

  invalidFieldName(name: string): MultipartError {
    return new MultipartError(
      `Invalid field name: "${safeDisplay(name)}"`,
      400,
      'INVALID_FIELD_NAME'
    );
  },

  invalidFileType(filename: string, mimeType: string, allowed: string[]): MultipartError {
    return new MultipartError(
      `File "${safeDisplay(filename)}" has type "${safeDisplay(mimeType)}" which is not in allowed types: ${allowed.join(', ')}`,
      415,
      'INVALID_FILE_TYPE'
    );
  },

  storageError(message: string): MultipartError {
    return new MultipartError(`Storage error: ${message}`, 500, 'STORAGE_ERROR');
  },

  parseError(message: string): MultipartError {
    return new MultipartError(`Multipart parse error: ${message}`, 400, 'PARSE_ERROR');
  },

  requestAborted(): MultipartError {
    return new MultipartError(
      'Request aborted by client during file upload',
      400,
      'REQUEST_ABORTED'
    );
  },

  bodySizeExceeded(limit: number): MultipartError {
    return new MultipartError(
      `Request body exceeds the ${formatBytes(limit)} size limit`,
      413,
      'BODY_SIZE_EXCEEDED'
    );
  },
} as const;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const base = 1024;
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1);
  const value = bytes / Math.pow(base, exponent);
  const unit = units[exponent] ?? 'B';
  return `${value.toFixed(exponent === 0 ? 0 : 2)} ${unit}`;
}

/** Truncate and strip control characters from user-supplied strings for safe error messages */
function safeDisplay(input: string, maxLen = 80): string {
  const cleaned = input.replace(/[\x00-\x1f]/g, '');
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen)}...`;
}
