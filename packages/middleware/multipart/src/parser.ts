/**
 * @nextrush/multipart - Streaming Multipart Parser
 *
 * Zero-dependency multipart/form-data parser built on Web Streams API.
 * Works on Node.js, Bun, Deno, and Edge runtimes.
 *
 * Implements RFC 7578 boundary parsing using Boyer-Moore-Horspool
 * byte scanning on Uint8Array — no Node.js-specific APIs.
 *
 * @packageDocumentation
 */

import {
  DEFAULT_MAX_BODY_SIZE,
  DEFAULT_MAX_FIELD_NAME_SIZE,
  DEFAULT_MAX_FIELD_SIZE,
  DEFAULT_MAX_FIELDS,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_HEADER_PAIRS,
  DEFAULT_MAX_PARTS,
  FORBIDDEN_KEYS,
  MAX_BOUNDARY_LENGTH,
} from './constants.js';
import { Errors } from './errors.js';
import { BoundaryScanner } from './scanner.js';
import { MemoryStorage } from './storage/memory.js';
import type { MultipartOptions, StorageResult, StorageStrategy, UploadedFile } from './types.js';
import { isAllowedType, parseLimit, sanitizeFilename } from './utils/index.js';

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

export interface ParsedResult {
  files: UploadedFile[];
  fields: Record<string, string>;
}

interface ResolvedLimits {
  maxFileSize: number;
  maxFiles: number;
  maxFields: number;
  maxParts: number;
  maxFieldNameSize: number;
  maxFieldSize: number;
  maxHeaderPairs: number;
  maxBodySize: number;
}

// ---------------------------------------------------------------------------
// Internal Constants
// ---------------------------------------------------------------------------

const DOUBLE_CRLF = new Uint8Array([0x0d, 0x0a, 0x0d, 0x0a]); // \r\n\r\n

const decoder = new TextDecoder();
const encoder = new TextEncoder();

// ---------------------------------------------------------------------------
// Main Parse Function
// ---------------------------------------------------------------------------

/**
 * Parse a multipart/form-data request body from a ReadableStream.
 *
 * @param body - The request body as a ReadableStream or Uint8Array
 * @param boundary - The boundary string from the Content-Type header
 * @param options - Multipart parsing configuration
 * @returns Parsed files and fields
 */
export async function parseMultipart(
  body: ReadableStream<Uint8Array> | Uint8Array,
  boundary: string,
  options: MultipartOptions = {}
): Promise<ParsedResult> {
  const storage: StorageStrategy = options.storage ?? new MemoryStorage();
  const limits = resolveLimits(options);
  const allowedTypes = options.allowedTypes;
  const abortOnError = options.abortOnError !== false;

  // RFC 2046 Section 5.1.1: boundary must not exceed 70 characters
  if (boundary.length > MAX_BOUNDARY_LENGTH) {
    throw Errors.parseError(
      `Boundary exceeds RFC 2046 maximum of ${MAX_BOUNDARY_LENGTH} characters`
    );
  }

  const files: UploadedFile[] = [];
  const fields: Record<string, string> = Object.create(null) as Record<string, string>;
  const storageResults: StorageResult[] = [];

  let fileCount = 0;
  let fieldCount = 0;
  let partCount = 0;

  // Collect the entire body into a single Uint8Array
  // For streaming large files, the StorageStrategy handles buffering/disk
  const data = body instanceof Uint8Array ? body : await streamToUint8Array(body, limits.maxBodySize);

  const scanner = new BoundaryScanner(boundary);

  // The first boundary in the body is `--<boundary>\r\n` (no leading \r\n)
  const firstBoundary = encoder.encode(`--${boundary}`);
  const firstIdx = findBytes(data, firstBoundary, 0);

  if (firstIdx === -1) {
    throw Errors.parseError('No boundary found in request body');
  }

  // Start parsing after the first boundary + CRLF
  let cursor = firstIdx + firstBoundary.length;

  // Check if this is already the final boundary
  if (cursor + 1 < data.length && data[cursor] === 0x2d && data[cursor + 1] === 0x2d) {
    // Empty multipart body — `--boundary--`
    return { files, fields };
  }

  // Skip CRLF after first boundary
  if (cursor + 1 < data.length && data[cursor] === 0x0d && data[cursor + 1] === 0x0a) {
    cursor += 2;
  }

  // Parse each part
  while (cursor < data.length) {
    partCount++;
    if (partCount > limits.maxParts) {
      if (abortOnError) {
        await cleanupOnError(storageResults, storage);
        throw Errors.partsLimitExceeded(limits.maxParts);
      }
      break;
    }

    // Find the end of headers (double CRLF)
    const headerEnd = findBytes(data, DOUBLE_CRLF, cursor);
    if (headerEnd === -1) {
      throw Errors.parseError('Malformed part: missing header terminator');
    }

    // Parse headers
    const headerBytes = data.subarray(cursor, headerEnd);
    const headers = parsePartHeaders(headerBytes, limits.maxHeaderPairs);
    cursor = headerEnd + DOUBLE_CRLF.length;

    // Extract Content-Disposition
    const disposition = headers.get('content-disposition');
    if (!disposition) {
      throw Errors.parseError('Part missing Content-Disposition header');
    }

    const { name, filename } = parseContentDisposition(disposition);
    if (!name) {
      throw Errors.parseError('Part missing name in Content-Disposition');
    }

    // Validate field name length
    if (encoder.encode(name).length > limits.maxFieldNameSize) {
      throw Errors.parseError(`Field name "${name}" exceeds maximum length`);
    }

    // Find the next boundary
    const nextBoundary = scanner.indexOf(data, cursor);
    let isFinal: boolean;
    let partEnd: number;

    if (nextBoundary === -1) {
      // No more boundaries — treat rest as the last part body
      // But strip trailing CRLF if present
      partEnd = data.length;
      isFinal = true;
    } else {
      partEnd = nextBoundary;
      const afterBoundary = nextBoundary + scanner.length;
      isFinal = scanner.isFinalBoundary(data, afterBoundary);
    }

    const partBody = data.subarray(cursor, partEnd);

    if (filename !== undefined) {
      // --- File part ---

      // Skip empty filename (empty file input)
      if (filename === '') {
        cursor = advancePastBoundary(data, nextBoundary, scanner.length, isFinal);
        if (isFinal || nextBoundary === -1) break;
        continue;
      }

      fileCount++;
      if (fileCount > limits.maxFiles) {
        if (abortOnError) {
          await cleanupOnError(storageResults, storage);
          throw Errors.filesLimitExceeded(limits.maxFiles);
        }
        cursor = advancePastBoundary(data, nextBoundary, scanner.length, isFinal);
        if (isFinal || nextBoundary === -1) break;
        continue;
      }

      // Validate field name
      if (FORBIDDEN_KEYS.has(name)) {
        if (abortOnError) {
          await cleanupOnError(storageResults, storage);
          throw Errors.invalidFieldName(name);
        }
        cursor = advancePastBoundary(data, nextBoundary, scanner.length, isFinal);
        if (isFinal || nextBoundary === -1) break;
        continue;
      }

      // Validate MIME type
      const contentType = headers.get('content-type') ?? 'application/octet-stream';
      if (allowedTypes && !isAllowedType(contentType, allowedTypes)) {
        if (abortOnError) {
          await cleanupOnError(storageResults, storage);
          throw Errors.invalidFileType(filename, contentType, allowedTypes);
        }
        cursor = advancePastBoundary(data, nextBoundary, scanner.length, isFinal);
        if (isFinal || nextBoundary === -1) break;
        continue;
      }

      // Check file size limit
      const truncated = partBody.length > limits.maxFileSize;
      if (truncated && abortOnError) {
        await cleanupOnError(storageResults, storage);
        throw Errors.fileTooLarge(filename, limits.maxFileSize);
      }

      const fileData = truncated ? partBody.subarray(0, limits.maxFileSize) : partBody;
      const sanitizedName = sanitizeFilename(filename);
      const encoding = headers.get('content-transfer-encoding') ?? '7bit';

      const fileInfo = {
        fieldName: name,
        originalName: filename,
        sanitizedName,
        encoding,
        mimeType: contentType,
      };

      // Create a ReadableStream from the file data for the storage strategy
      const fileStream = uint8ArrayToReadableStream(fileData);

      try {
        const result = await storage.handle(fileStream, fileInfo);
        storageResults.push(result);

        files.push({
          fieldName: name,
          originalName: filename,
          sanitizedName,
          encoding,
          mimeType: contentType,
          size: result.size,
          truncated,
          buffer: result.buffer,
          path: result.path,
        });
      } catch (error: unknown) {
        await cleanupOnError(storageResults, storage);
        const message = error instanceof Error ? error.message : 'Storage failed';
        throw Errors.storageError(message);
      }
    } else {
      // --- Field part ---
      fieldCount++;
      if (fieldCount > limits.maxFields) {
        if (abortOnError) {
          await cleanupOnError(storageResults, storage);
          throw Errors.fieldsLimitExceeded(limits.maxFields);
        }
        cursor = advancePastBoundary(data, nextBoundary, scanner.length, isFinal);
        if (isFinal || nextBoundary === -1) break;
        continue;
      }

      // Validate field name
      if (FORBIDDEN_KEYS.has(name)) {
        if (abortOnError) {
          await cleanupOnError(storageResults, storage);
          throw Errors.invalidFieldName(name);
        }
        cursor = advancePastBoundary(data, nextBoundary, scanner.length, isFinal);
        if (isFinal || nextBoundary === -1) break;
        continue;
      }

      // Enforce field value size limit
      if (partBody.length > limits.maxFieldSize) {
        throw Errors.parseError(`Field "${name}" value exceeds maximum size`);
      }

      fields[name] = decoder.decode(partBody);
    }

    // Advance cursor past the boundary
    cursor = advancePastBoundary(data, nextBoundary, scanner.length, isFinal);
    if (isFinal || nextBoundary === -1) break;
  }

  return { files, fields };
}

// ---------------------------------------------------------------------------
// Header Parsing
// ---------------------------------------------------------------------------

/**
 * Parse part headers from raw bytes.
 *
 * Headers are separated by CRLF within the header block.
 * Each header line is `Name: Value`.
 */
function parsePartHeaders(headerBytes: Uint8Array, maxPairs: number): Map<string, string> {
  const headers = new Map<string, string>();
  const headerText = decoder.decode(headerBytes);
  const lines = headerText.split('\r\n');
  let count = 0;

  for (const line of lines) {
    if (line.length === 0) continue;

    count++;
    if (count > maxPairs) break;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();
    headers.set(key, value);
  }

  return headers;
}

/**
 * Parse the Content-Disposition header to extract name and filename.
 *
 * Handles quoted and unquoted values, and RFC 5987 encoded filenames.
 */
function parseContentDisposition(header: string): { name?: string; filename?: string } {
  let name: string | undefined;
  let filename: string | undefined;

  // Match name="value" or name=value
  const nameMatch = /\bname="([^"]*)"/.exec(header) ?? /\bname=([^\s;]+)/.exec(header);
  if (nameMatch) {
    name = nameMatch[1];
  }

  // Match filename="value" or filename=value
  // Also check for filename*= (RFC 5987) encoding
  const filenameStarMatch = /\bfilename\*=(?:UTF-8''|utf-8'')([^\s;]+)/i.exec(header);
  if (filenameStarMatch && filenameStarMatch[1]) {
    try {
      filename = decodeURIComponent(filenameStarMatch[1]);
    } catch {
      filename = filenameStarMatch[1];
    }
  } else {
    const filenameMatch =
      /\bfilename="([^"]*)"/.exec(header) ?? /\bfilename=([^\s;]+)/.exec(header);
    if (filenameMatch) {
      filename = filenameMatch[1];
    }
  }

  return { name, filename };
}

// ---------------------------------------------------------------------------
// Binary Utilities
// ---------------------------------------------------------------------------

/**
 * Find a byte pattern within data, starting at offset.
 * Simple linear scan — used only for the first boundary and CRLF markers.
 */
function findBytes(data: Uint8Array, pattern: Uint8Array, offset: number): number {
  const dataLen = data.length;
  const patLen = pattern.length;

  if (patLen === 0) return offset;

  const end = dataLen - patLen;
  for (let i = offset; i <= end; i++) {
    let match = true;
    for (let j = 0; j < patLen; j++) {
      if (data[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }

  return -1;
}

/**
 * Read a ReadableStream into a single Uint8Array.
 *
 * Enforces a maximum body size to prevent memory exhaustion DoS.
 */
async function streamToUint8Array(
  stream: ReadableStream<Uint8Array>,
  maxBodySize: number
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalLength += value.length;
      if (totalLength > maxBodySize) {
        throw Errors.bodySizeExceeded(maxBodySize);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (chunks.length === 1) return chunks[0]!;

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Create a ReadableStream from a Uint8Array.
 * Used to pass file data to StorageStrategy.handle().
 */
function uint8ArrayToReadableStream(data: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

/**
 * Advance the cursor past a boundary marker and the following CRLF.
 */
function advancePastBoundary(
  data: Uint8Array,
  boundaryStart: number,
  boundaryLength: number,
  isFinal: boolean
): number {
  if (boundaryStart === -1) return data.length;

  let pos = boundaryStart + boundaryLength;

  // Skip `--` for final boundary
  if (isFinal) {
    pos += 2;
  }

  // Skip CRLF after boundary
  if (pos + 1 < data.length && data[pos] === 0x0d && data[pos + 1] === 0x0a) {
    pos += 2;
  }

  return pos;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveLimits(options: MultipartOptions): ResolvedLimits {
  const limits = options.limits ?? {};

  return {
    maxFileSize: parseLimit(limits.maxFileSize, DEFAULT_MAX_FILE_SIZE),
    maxFiles: limits.maxFiles ?? DEFAULT_MAX_FILES,
    maxFields: limits.maxFields ?? DEFAULT_MAX_FIELDS,
    maxParts: limits.maxParts ?? DEFAULT_MAX_PARTS,
    maxFieldNameSize: limits.maxFieldNameSize ?? DEFAULT_MAX_FIELD_NAME_SIZE,
    maxFieldSize: parseLimit(limits.maxFieldSize, DEFAULT_MAX_FIELD_SIZE),
    maxHeaderPairs: limits.maxHeaderPairs ?? DEFAULT_MAX_HEADER_PAIRS,
    maxBodySize: parseLimit(limits.maxBodySize, DEFAULT_MAX_BODY_SIZE),
  };
}

/**
 * Clean up any stored files on error.
 */
async function cleanupOnError(
  storageResults: StorageResult[],
  storage: StorageStrategy
): Promise<void> {
  if (!storage.remove) return;

  for (const result of storageResults) {
    try {
      await storage.remove(result);
    } catch {
      // Best-effort cleanup
    }
  }
}

// Re-export boundary extractor for middleware
export { extractBoundary } from './constants.js';
