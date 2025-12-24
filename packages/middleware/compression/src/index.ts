/**
 * @nextrush/compression
 *
 * High-performance response compression middleware for NextRush.
 * Supports Gzip, Brotli, and Deflate with automatic content negotiation.
 *
 * @packageDocumentation
 */

import type { Context } from '@nextrush/types';
import type { CompressionEncoding, CompressionMiddleware, CompressionOptions } from './types';
import {
    compressData,
    DEFAULT_COMPRESSIBLE_TYPES,
    DEFAULT_EXCLUDED_TYPES,
    meetsThreshold,
    negotiateEncoding,
    shouldCompress,
} from './utils';

export type {
    CompressionAlgorithm, CompressionEncoding, CompressionInfo, CompressionMiddleware, CompressionOptions
} from './types';

export {
    compressData,
    createCompressionStream,
    DEFAULT_COMPRESSIBLE_TYPES,
    DEFAULT_EXCLUDED_TYPES, meetsThreshold, negotiateEncoding,
    shouldCompress
} from './utils';

/**
 * Default compression options
 */
const DEFAULT_OPTIONS: Required<Omit<CompressionOptions, 'filter' | 'flush'>> = {
  gzip: true,
  deflate: true,
  brotli: true,
  level: 6,
  threshold: 1024,
  contentTypes: DEFAULT_COMPRESSIBLE_TYPES,
  exclude: DEFAULT_EXCLUDED_TYPES,
  memLevel: 8,
};

/**
 * Create compression middleware
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { compression } from '@nextrush/compression';
 *
 * const app = createApp();
 *
 * // Basic usage - auto-selects best encoding
 * app.use(compression());
 *
 * // Custom options
 * app.use(compression({
 *   level: 9,              // Maximum compression
 *   threshold: 512,        // Compress responses > 512 bytes
 *   brotli: true,          // Enable Brotli (best compression)
 * }));
 *
 * // Filter specific routes
 * app.use(compression({
 *   filter: (ctx) => !ctx.path.startsWith('/api/stream'),
 * }));
 * ```
 */
export function compression(options: CompressionOptions = {}): CompressionMiddleware {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return async function compressionMiddleware(
    ctx: Context,
    next?: () => Promise<void>
  ): Promise<void> {
    if (next) {
      await next();
    } else if (ctx.next) {
      await ctx.next();
    }

    if (!shouldCompressResponse(ctx, opts)) {
      return;
    }

    const acceptEncoding = ctx.get('accept-encoding');
    const encoding = negotiateEncoding(acceptEncoding, opts);

    if (!encoding) {
      return;
    }

    const body = getResponseBody(ctx);
    if (!body) {
      return;
    }

    if (!meetsThreshold(body, opts.threshold)) {
      return;
    }

    try {
      const data = typeof body === 'string' ? body : Buffer.isBuffer(body) ? body : JSON.stringify(body);
      const compressed = await compressData(data, encoding, opts);

      setCompressedResponse(ctx, compressed, encoding);
    } catch {
      // Compression failed, send uncompressed
    }
  };
}

/**
 * Check if response should be compressed
 */
function shouldCompressResponse(ctx: Context, options: CompressionOptions): boolean {
  if (ctx.method === 'HEAD') return false;

  const status = ctx.status;
  if (status === 204 || status === 304) return false;

  if (options.filter && !options.filter(ctx)) {
    return false;
  }

  const contentEncoding = ctx.raw?.res?.getHeader?.('content-encoding');
  if (contentEncoding && contentEncoding !== 'identity') {
    return false;
  }

  const contentType = ctx.raw?.res?.getHeader?.('content-type') as string | undefined;
  return shouldCompress(contentType, options);
}

/**
 * Get response body from context
 */
function getResponseBody(ctx: Context): string | Buffer | object | null {
  const res = ctx.raw?.res as { body?: unknown } | undefined;
  if (res?.body !== undefined) {
    return res.body as string | Buffer | object;
  }

  return null;
}

/**
 * Set compressed response on context
 */
function setCompressedResponse(
  ctx: Context,
  compressed: Buffer,
  encoding: CompressionEncoding
): void {
  ctx.set('Content-Encoding', encoding);
  ctx.set('Content-Length', compressed.length);

  const vary = ctx.raw?.res?.getHeader?.('vary') as string | undefined;
  if (!vary?.includes('Accept-Encoding')) {
    ctx.set('Vary', vary ? `${vary}, Accept-Encoding` : 'Accept-Encoding');
  }

  const res = ctx.raw?.res as { body?: unknown } | undefined;
  if (res) {
    res.body = compressed;
  }
}

/**
 * Gzip-only compression middleware
 *
 * @example
 * ```typescript
 * app.use(gzip({ level: 9 }));
 * ```
 */
export function gzip(
  options: Omit<CompressionOptions, 'gzip' | 'deflate' | 'brotli'> = {}
): CompressionMiddleware {
  return compression({
    ...options,
    gzip: true,
    deflate: false,
    brotli: false,
  });
}

/**
 * Deflate-only compression middleware
 *
 * @example
 * ```typescript
 * app.use(deflate({ level: 6 }));
 * ```
 */
export function deflate(
  options: Omit<CompressionOptions, 'gzip' | 'deflate' | 'brotli'> = {}
): CompressionMiddleware {
  return compression({
    ...options,
    gzip: false,
    deflate: true,
    brotli: false,
  });
}

/**
 * Brotli-only compression middleware
 *
 * @example
 * ```typescript
 * app.use(brotli({ level: 4 })); // Level 4 is good balance for dynamic content
 * ```
 */
export function brotli(
  options: Omit<CompressionOptions, 'gzip' | 'deflate' | 'brotli'> = {}
): CompressionMiddleware {
  return compression({
    ...options,
    gzip: false,
    deflate: false,
    brotli: true,
  });
}

export default compression;
