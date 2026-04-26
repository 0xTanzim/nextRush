/**
 * @nextrush/body-parser - Buffer Utilities
 *
 * Optimized buffer operations for body parsing.
 *
 * @packageDocumentation
 */

import { StringDecoder } from 'node:string_decoder';
import { STRING_DECODER_THRESHOLD } from '../constants.js';

/**
 * Encodings supported by StringDecoder.
 * Module-level constant to avoid per-call allocation.
 */
const STRING_DECODER_ENCODINGS = new Set([
  'utf8',
  'utf-8',
  'utf16le',
  'ucs2',
  'base64',
  'latin1',
  'ascii',
  'hex',
]);

/**
 * Convert buffer to string with encoding support.
 *
 * Uses StringDecoder for UTF-8 buffers larger than threshold
 * for better performance with large payloads.
 *
 * @param buffer - Buffer to convert
 * @param encoding - Character encoding (default: 'utf8')
 * @returns Decoded string
 */
export function bufferToString(buffer: Buffer, encoding: BufferEncoding = 'utf8'): string {
  if (buffer.length === 0) {
    return '';
  }

  // Fast path for small buffers
  if (buffer.length < STRING_DECODER_THRESHOLD) {
    return buffer.toString(encoding);
  }

  // StringDecoder only supports certain encodings
  if (!STRING_DECODER_ENCODINGS.has(encoding)) {
    return buffer.toString(encoding);
  }

  // StringDecoder handles multi-byte sequences correctly
  // and has better performance for large buffers
  const decoder = new StringDecoder(encoding);
  return decoder.write(buffer) + decoder.end();
}

/**
 * Concatenate buffers with optimization for common cases.
 *
 * @param chunks - Array of buffer chunks
 * @param totalLength - Pre-calculated total length
 * @returns Concatenated buffer
 */
export function concatBuffers(chunks: Buffer[], totalLength: number): Buffer {
  // Empty case
  if (chunks.length === 0) {
    return Buffer.alloc(0);
  }

  // Single chunk optimization - avoid allocation
  if (chunks.length === 1) {
    const chunk = chunks[0];
    if (chunk !== undefined) {
      return chunk;
    }
    return Buffer.alloc(0);
  }

  // Multiple chunks - use concat
  return Buffer.concat(chunks, totalLength);
}
