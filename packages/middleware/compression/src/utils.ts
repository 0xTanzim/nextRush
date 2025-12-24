import type { Transform } from 'node:stream';
import { constants, createBrotliCompress, createDeflate, createGzip } from 'node:zlib';
import type { CompressionEncoding, CompressionOptions } from './types';

/**
 * Default compressible content types
 */
export const DEFAULT_COMPRESSIBLE_TYPES = [
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'text/xml',
  'application/json',
  'application/javascript',
  'application/xml',
  'application/xhtml+xml',
  'application/rss+xml',
  'application/atom+xml',
  'application/x-javascript',
  'application/x-font-ttf',
  'application/vnd.ms-fontobject',
  'font/opentype',
  'font/ttf',
  'font/eot',
  'font/otf',
  'image/svg+xml',
  'image/x-icon',
];

/**
 * Default excluded content types (already compressed)
 */
export const DEFAULT_EXCLUDED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'video/*',
  'audio/*',
  'application/zip',
  'application/gzip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
];

/**
 * Parse Accept-Encoding header and return preferred encoding
 */
export function negotiateEncoding(
  acceptEncoding: string | undefined,
  options: CompressionOptions
): CompressionEncoding | null {
  if (!acceptEncoding) return null;

  const encodings = parseAcceptEncoding(acceptEncoding);

  if (options.brotli !== false && encodings.has('br')) {
    return 'br';
  }

  if (options.gzip !== false && encodings.has('gzip')) {
    return 'gzip';
  }

  if (options.deflate !== false && encodings.has('deflate')) {
    return 'deflate';
  }

  return null;
}

/**
 * Parse Accept-Encoding header into a Set of encodings
 */
function parseAcceptEncoding(header: string): Set<string> {
  const encodings = new Set<string>();

  for (const part of header.split(',')) {
    const [encoding, quality] = part.trim().split(';');
    if (!encoding) continue;

    const q = quality?.match(/q=([\d.]+)/)?.[1];
    const qValue = q ? parseFloat(q) : 1;

    if (qValue > 0) {
      encodings.add(encoding.toLowerCase().trim());
    }
  }

  return encodings;
}

/**
 * Create compression stream for the given encoding
 */
export function createCompressionStream(
  encoding: CompressionEncoding,
  options: CompressionOptions
): Transform {
  const level = options.level ?? 6;

  switch (encoding) {
    case 'br':
      return createBrotliCompress({
        params: {
          [constants.BROTLI_PARAM_QUALITY]: Math.min(level, 11),
        },
      });

    case 'gzip':
      return createGzip({
        level: Math.min(level, 9),
        memLevel: options.memLevel ?? 8,
        flush: options.flush,
      });

    case 'deflate':
      return createDeflate({
        level: Math.min(level, 9),
        memLevel: options.memLevel ?? 8,
        flush: options.flush,
      });

    default:
      throw new Error(`Unsupported encoding: ${encoding}`);
  }
}

/**
 * Check if content type should be compressed
 */
export function shouldCompress(
  contentType: string | undefined,
  options: CompressionOptions
): boolean {
  if (!contentType) return false;

  const type = contentType.split(';')[0]?.trim().toLowerCase();
  if (!type) return false;

  const excludePatterns = options.exclude ?? DEFAULT_EXCLUDED_TYPES;
  if (matchesPattern(type, excludePatterns)) {
    return false;
  }

  const includePatterns = options.contentTypes ?? DEFAULT_COMPRESSIBLE_TYPES;
  return matchesPattern(type, includePatterns);
}

/**
 * Check if content type matches any pattern
 */
function matchesPattern(contentType: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern === contentType) return true;

    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -1);
      if (contentType.startsWith(prefix)) return true;
    }

    if (pattern.startsWith('*/')) {
      const suffix = pattern.slice(2);
      if (contentType.endsWith(suffix)) return true;
    }
  }

  return false;
}

/**
 * Check if response size meets threshold
 */
export function meetsThreshold(
  body: unknown,
  threshold: number
): boolean {
  if (body === null || body === undefined) return false;

  let size: number;

  if (typeof body === 'string') {
    size = Buffer.byteLength(body);
  } else if (Buffer.isBuffer(body)) {
    size = body.length;
  } else if (typeof body === 'object') {
    size = Buffer.byteLength(JSON.stringify(body));
  } else {
    return false;
  }

  return size >= threshold;
}

/**
 * Compress data synchronously (for non-streaming responses)
 */
export async function compressData(
  data: Buffer | string,
  encoding: CompressionEncoding,
  options: CompressionOptions
): Promise<Buffer> {
  const { promisify } = await import('node:util');
  const zlib = await import('node:zlib');

  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const level = options.level ?? 6;

  switch (encoding) {
    case 'br': {
      const brotliCompress = promisify(zlib.brotliCompress);
      return brotliCompress(buffer, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: Math.min(level, 11),
        },
      });
    }

    case 'gzip': {
      const gzip = promisify(zlib.gzip);
      return gzip(buffer, {
        level: Math.min(level, 9),
        memLevel: options.memLevel ?? 8,
      });
    }

    case 'deflate': {
      const deflate = promisify(zlib.deflate);
      return deflate(buffer, {
        level: Math.min(level, 9),
        memLevel: options.memLevel ?? 8,
      });
    }

    default:
      throw new Error(`Unsupported encoding: ${encoding}`);
  }
}
