/**
 * @nextrush/compression - Content Negotiation
 *
 * Accept-Encoding header parsing and encoding negotiation.
 *
 * @packageDocumentation
 */

import { ENCODING_PRIORITY } from './constants.js';
import type {
  AcceptEncodingEntry,
  CompressionEncoding,
  CompressionOptions,
  NegotiationResult,
} from './types.js';

// ============================================================================
// Accept-Encoding Parsing
// ============================================================================

/**
 * Parse Accept-Encoding header into a list of encodings with quality values.
 *
 * @example
 * ```typescript
 * parseAcceptEncoding('gzip, deflate;q=0.5, br;q=0.9');
 * // [
 * //   { encoding: 'gzip', quality: 1 },
 * //   { encoding: 'br', quality: 0.9 },
 * //   { encoding: 'deflate', quality: 0.5 }
 * // ]
 * ```
 *
 * @param header - Accept-Encoding header value
 * @returns Sorted list of encodings with quality values (highest first)
 */
export function parseAcceptEncoding(header: string | null | undefined): AcceptEncodingEntry[] {
  if (!header) {
    return [];
  }

  const entries: AcceptEncodingEntry[] = [];

  for (const part of header.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const [encoding, ...params] = trimmed.split(';');
    if (!encoding) continue;

    const encodingName = encoding.trim().toLowerCase();
    if (!encodingName) continue;

    // Parse quality value (default is 1.0)
    let quality = 1.0;
    for (const param of params) {
      const match = param.trim().match(/^q\s*=\s*([\d.]+)$/i);
      if (match?.[1]) {
        const parsed = parseFloat(match[1]);
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          quality = parsed;
        }
      }
    }

    // Skip encodings with q=0 (explicitly rejected)
    if (quality > 0) {
      entries.push({ encoding: encodingName, quality });
    }
  }

  // Sort by quality (descending), then by encoding priority (higher index = higher priority)
  return entries.sort((a, b) => {
    if (b.quality !== a.quality) {
      return b.quality - a.quality;
    }
    // Same quality — use encoding priority.
    // indexOf returns -1 for unknown encodings; treat them as lowest priority.
    const aPriority = ENCODING_PRIORITY.indexOf(a.encoding);
    const bPriority = ENCODING_PRIORITY.indexOf(b.encoding);
    return (bPriority === -1 ? -Infinity : bPriority) - (aPriority === -1 ? -Infinity : aPriority);
  });
}

/**
 * Check if an encoding is accepted by the client.
 *
 * @param header - Accept-Encoding header value
 * @param encoding - Encoding to check
 * @returns Whether the encoding is accepted
 */
export function isEncodingAccepted(header: string | null | undefined, encoding: string): boolean {
  if (!header) return false;

  const entries = parseAcceptEncoding(header);
  const normalizedEncoding = encoding.toLowerCase();

  // Check for exact match or wildcard
  return entries.some((entry) => entry.encoding === normalizedEncoding || entry.encoding === '*');
}

/**
 * Get the quality value for a specific encoding.
 *
 * @param header - Accept-Encoding header value
 * @param encoding - Encoding to check
 * @returns Quality value (0-1), or 0 if not accepted
 */
export function getEncodingQuality(header: string | null | undefined, encoding: string): number {
  if (!header) return 0;

  const entries = parseAcceptEncoding(header);
  const normalizedEncoding = encoding.toLowerCase();

  // Check for exact match
  const exactMatch = entries.find((entry) => entry.encoding === normalizedEncoding);
  if (exactMatch) return exactMatch.quality;

  // Check for wildcard
  const wildcardMatch = entries.find((entry) => entry.encoding === '*');
  if (wildcardMatch) return wildcardMatch.quality;

  return 0;
}

// ============================================================================
// Encoding Negotiation
// ============================================================================

/**
 * Negotiate the best compression encoding based on client preferences
 * and server capabilities.
 *
 * @example
 * ```typescript
 * const result = negotiateEncoding('gzip, br;q=0.9', {
 *   brotli: true,
 *   gzip: true,
 *   deflate: true
 * });
 * // { encoding: 'gzip', accepted: [...] }
 *
 * // Brotli disabled on server
 * const result2 = negotiateEncoding('br, gzip;q=0.5', {
 *   brotli: false,
 *   gzip: true
 * });
 * // { encoding: 'gzip', accepted: [...] }
 * ```
 *
 * @param acceptEncoding - Accept-Encoding header value
 * @param options - Compression options with enabled encodings
 * @returns Negotiation result with selected encoding
 */
export function negotiateEncoding(
  acceptEncoding: string | null | undefined,
  options: Pick<CompressionOptions, 'brotli' | 'gzip' | 'deflate'>
): NegotiationResult {
  const accepted = parseAcceptEncoding(acceptEncoding);

  if (accepted.length === 0) {
    return { encoding: null, accepted };
  }

  // Build list of server-supported encodings
  const serverSupported = new Set<string>();
  if (options.brotli !== false) serverSupported.add('br');
  if (options.gzip !== false) serverSupported.add('gzip');
  if (options.deflate !== false) serverSupported.add('deflate');

  // Find first client-preferred encoding that server supports
  for (const entry of accepted) {
    if (serverSupported.has(entry.encoding)) {
      return {
        encoding: entry.encoding as CompressionEncoding,
        accepted,
      };
    }

    // Handle wildcard - return highest priority server encoding
    if (entry.encoding === '*') {
      // Return based on priority: br > gzip > deflate
      if (serverSupported.has('br')) {
        return { encoding: 'br', accepted };
      }
      if (serverSupported.has('gzip')) {
        return { encoding: 'gzip', accepted };
      }
      if (serverSupported.has('deflate')) {
        return { encoding: 'deflate', accepted };
      }
    }
  }

  return { encoding: null, accepted };
}

/**
 * Simple encoding negotiation - returns just the encoding name.
 *
 * @param acceptEncoding - Accept-Encoding header value
 * @param options - Compression options with enabled encodings
 * @returns Selected encoding or null
 */
export function selectEncoding(
  acceptEncoding: string | null | undefined,
  options: Pick<CompressionOptions, 'brotli' | 'gzip' | 'deflate'>
): CompressionEncoding | null {
  return negotiateEncoding(acceptEncoding, options).encoding;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if the client accepts any compression.
 *
 * @param header - Accept-Encoding header value
 * @returns Whether compression is acceptable
 */
export function acceptsCompression(header: string | null | undefined): boolean {
  if (!header) return false;

  const entries = parseAcceptEncoding(header);

  // Check if any compression encoding is accepted
  return entries.some(
    (entry) =>
      entry.encoding === 'gzip' ||
      entry.encoding === 'deflate' ||
      entry.encoding === 'br' ||
      entry.encoding === '*'
  );
}

/**
 * Get all accepted compression encodings.
 *
 * @param header - Accept-Encoding header value
 * @returns List of accepted compression encodings
 */
export function getAcceptedEncodings(header: string | null | undefined): CompressionEncoding[] {
  if (!header) return [];

  const entries = parseAcceptEncoding(header);
  const compressionEncodings: CompressionEncoding[] = [];

  for (const entry of entries) {
    if (entry.encoding === 'gzip' || entry.encoding === 'deflate' || entry.encoding === 'br') {
      compressionEncodings.push(entry.encoding);
    } else if (entry.encoding === '*') {
      // Wildcard accepts all - return all in priority order
      return ['br', 'gzip', 'deflate'];
    }
  }

  return compressionEncodings;
}
