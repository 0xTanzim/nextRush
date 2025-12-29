/**
 * @nextrush/compression - Middleware
 *
 * Compression middleware for NextRush applications.
 *
 * @packageDocumentation
 */

import type { Context, Middleware } from '@nextrush/types';
import {
    compress,
    detectCapabilities,
    isEncodingSupported,
} from './compressor.js';
import {
    DEFAULT_OPTIONS,
    NO_BODY_METHODS,
    NO_COMPRESS_STATUS_CODES,
    VARY_HEADER,
} from './constants.js';
import { isCompressible } from './content-type.js';
import { selectEncoding } from './negotiation.js';
import type {
    CompressionInfo,
    CompressionMiddleware as CompressionMiddlewareFn,
    CompressionOptions,
    ResolvedCompressionOptions,
} from './types.js';

// ============================================================================
// Type Helpers
// ============================================================================

/**
 * Extended context with Node.js raw response.
 */
interface NodeRawContext extends Context {
  raw: {
    req: unknown;
    res: {
      body?: unknown;
      getHeader?: (name: string) => string | number | string[] | undefined;
      setHeader?: (name: string, value: string | number) => void;
    };
  };
}

/**
 * Context with body property for direct body access.
 */
interface BodyContext extends Context {
  body: unknown;
}

// ============================================================================
// Options Resolution
// ============================================================================

/**
 * Resolve compression options with defaults.
 *
 * @param options - User-provided options
 * @returns Resolved options with all defaults applied
 */
function resolveOptions(options: CompressionOptions = {}): ResolvedCompressionOptions {
  const caps = detectCapabilities();

  return {
    gzip: options.gzip ?? DEFAULT_OPTIONS.gzip,
    deflate: options.deflate ?? DEFAULT_OPTIONS.deflate,
    // Only enable brotli if runtime supports it
    brotli: (options.brotli ?? DEFAULT_OPTIONS.brotli) && caps.hasBrotli,
    level: options.level ?? DEFAULT_OPTIONS.level,
    threshold: options.threshold ?? DEFAULT_OPTIONS.threshold,
    contentTypes: options.contentTypes ?? DEFAULT_OPTIONS.contentTypes,
    exclude: options.exclude ?? DEFAULT_OPTIONS.exclude,
    filter: options.filter,
    breachMitigation: options.breachMitigation ?? false,
  };
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Get header value from context (handles different adapter shapes).
 */
function getResponseHeader(ctx: Context, name: string): string | undefined {
  // Try Node.js adapter style
  const nodeCtx = ctx as NodeRawContext;
  if (nodeCtx.raw?.res?.getHeader) {
    const value = nodeCtx.raw.res.getHeader(name);
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value)) return value[0];
  }

  return undefined;
}

/**
 * Check if response should be compressed.
 *
 * @param ctx - Request context
 * @param options - Resolved options
 * @returns Whether compression should be applied
 */
function shouldCompressResponse(
  ctx: Context,
  options: ResolvedCompressionOptions
): boolean {
  // Skip methods without body
  if (NO_BODY_METHODS.includes(ctx.method)) {
    return false;
  }

  // Skip certain status codes
  if (NO_COMPRESS_STATUS_CODES.includes(ctx.status)) {
    return false;
  }

  // Check custom filter
  if (options.filter && !options.filter(ctx)) {
    return false;
  }

  // Check if already encoded
  const contentEncoding = getResponseHeader(ctx, 'content-encoding');
  if (contentEncoding && contentEncoding !== 'identity') {
    return false;
  }

  // Check content type
  const contentType = getResponseHeader(ctx, 'content-type');

  return isCompressible(contentType, {
    contentTypes: options.contentTypes,
    exclude: options.exclude,
  });
}

/**
 * Get response body from context.
 *
 * Handles different context shapes from various adapters.
 */
function getResponseBody(ctx: Context): string | Uint8Array | Buffer | object | null {
  // Try context body property
  const bodyCtx = ctx as BodyContext;
  if (bodyCtx.body !== undefined && bodyCtx.body !== null) {
    // Skip if body is already being handled
    if (typeof bodyCtx.body === 'function') return null;
    return bodyCtx.body as string | Uint8Array | Buffer | object;
  }

  // Try raw response body (Node.js adapter)
  const nodeCtx = ctx as NodeRawContext;
  if (nodeCtx.raw?.res?.body !== undefined && nodeCtx.raw.res.body !== null) {
    return nodeCtx.raw.res.body as string | Uint8Array | Buffer | object;
  }

  return null;
}

/**
 * Get body size in bytes.
 */
function getBodySize(body: unknown): number {
  if (body === null || body === undefined) {
    return 0;
  }

  if (typeof body === 'string') {
    return new TextEncoder().encode(body).length;
  }

  if (body instanceof Uint8Array) {
    return body.length;
  }

  if (Buffer.isBuffer(body)) {
    return body.length;
  }

  if (typeof body === 'object') {
    return new TextEncoder().encode(JSON.stringify(body)).length;
  }

  return 0;
}

/**
 * Convert body to Uint8Array for compression.
 */
function bodyToUint8Array(body: unknown): Uint8Array {
  if (typeof body === 'string') {
    return new TextEncoder().encode(body);
  }

  if (body instanceof Uint8Array) {
    return body;
  }

  if (Buffer.isBuffer(body)) {
    return new Uint8Array(body);
  }

  if (typeof body === 'object') {
    return new TextEncoder().encode(JSON.stringify(body));
  }

  return new Uint8Array(0);
}

/**
 * Add random padding for BREACH mitigation.
 *
 * BREACH attack exploits compression ratio to leak secrets.
 * Adding random-length padding prevents attackers from measuring compression ratios.
 */
function addBreachPadding(data: Uint8Array): Uint8Array {
  // Add 0-255 random bytes of padding
  const paddingLength = Math.floor(Math.random() * 256);
  const padding = new Uint8Array(paddingLength);
  crypto.getRandomValues(padding);

  // Combine original data with padding
  const result = new Uint8Array(data.length + paddingLength);
  result.set(data);
  result.set(padding, data.length);

  return result;
}

/**
 * Set compressed body on context.
 */
function setCompressedBody(ctx: Context, data: Buffer): void {
  // Try Node.js adapter style
  const nodeCtx = ctx as NodeRawContext;
  if (nodeCtx.raw?.res) {
    nodeCtx.raw.res.body = data;
    return;
  }

  // Try direct body assignment
  (ctx as BodyContext).body = data;
}

// ============================================================================
// Main Middleware
// ============================================================================

/**
 * Create compression middleware.
 *
 * Automatically compresses responses based on:
 * - Accept-Encoding header from client
 * - Content-Type of response
 * - Response size (threshold)
 * - Custom filter function
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
 *   brotli: true,          // Enable Brotli (where supported)
 * }));
 *
 * // Filter specific routes
 * app.use(compression({
 *   filter: (ctx) => !ctx.path.startsWith('/api/stream'),
 * }));
 * ```
 *
 * @param options - Compression options
 * @returns Compression middleware function
 */
export function compression(options: CompressionOptions = {}): CompressionMiddlewareFn {
  const opts = resolveOptions(options);

  return async function compressionMiddleware(
    ctx: Context,
    next?: () => Promise<void>
  ): Promise<void> {
    // Call next middleware first
    if (next) {
      await next();
    } else if ((ctx as { next?: () => Promise<void> }).next) {
      await (ctx as { next: () => Promise<void> }).next();
    }

    // Check if we should compress
    if (!shouldCompressResponse(ctx, opts)) {
      return;
    }

    // Negotiate encoding
    const acceptEncoding = ctx.get('accept-encoding');
    const encoding = selectEncoding(acceptEncoding, opts);

    if (!encoding || !isEncodingSupported(encoding)) {
      return;
    }

    // Get response body
    const body = getResponseBody(ctx);
    if (body === null) {
      return;
    }

    // Check threshold
    const bodySize = getBodySize(body);
    if (bodySize < opts.threshold) {
      return;
    }

    try {
      // Convert body to Uint8Array
      let data = bodyToUint8Array(body);

      // Apply BREACH mitigation if enabled
      if (opts.breachMitigation) {
        data = addBreachPadding(data);
      }

      // Compress
      const result = await compress(data, encoding, { level: opts.level });

      // Set response headers
      ctx.set('Content-Encoding', encoding);
      ctx.set('Content-Length', String(result.data.length));

      // Update Vary header
      const vary = getResponseHeader(ctx, 'vary');
      if (!vary?.toLowerCase().includes('accept-encoding')) {
        ctx.set('Vary', vary ? `${vary}, ${VARY_HEADER}` : VARY_HEADER);
      }

      // Store compression info in state
      if (ctx.state) {
        ctx.state.compression = result.info;
      }

      // Set compressed body
      const compressed = Buffer.from(result.data);
      setCompressedBody(ctx, compressed);
    } catch {
      // Compression failed - send uncompressed response
      // Don't throw error, just skip compression
    }
  };
}

// ============================================================================
// Convenience Middleware
// ============================================================================

/**
 * Gzip-only compression middleware.
 *
 * @example
 * ```typescript
 * app.use(gzip({ level: 9 }));
 * ```
 *
 * @param options - Compression options (gzip, deflate, brotli ignored)
 * @returns Gzip compression middleware
 */
export function gzip(
  options: Omit<CompressionOptions, 'gzip' | 'deflate' | 'brotli'> = {}
): Middleware {
  return compression({
    ...options,
    gzip: true,
    deflate: false,
    brotli: false,
  });
}

/**
 * Deflate-only compression middleware.
 *
 * @example
 * ```typescript
 * app.use(deflate({ level: 6 }));
 * ```
 *
 * @param options - Compression options (gzip, deflate, brotli ignored)
 * @returns Deflate compression middleware
 */
export function deflate(
  options: Omit<CompressionOptions, 'gzip' | 'deflate' | 'brotli'> = {}
): Middleware {
  return compression({
    ...options,
    gzip: false,
    deflate: true,
    brotli: false,
  });
}

/**
 * Brotli-only compression middleware.
 *
 * Note: Brotli is only available in Node.js and Bun.
 * In other runtimes, this middleware will not compress responses.
 *
 * @example
 * ```typescript
 * app.use(brotli({ level: 4 })); // Level 4 is good balance for dynamic content
 * ```
 *
 * @param options - Compression options (gzip, deflate, brotli ignored)
 * @returns Brotli compression middleware
 */
export function brotli(
  options: Omit<CompressionOptions, 'gzip' | 'deflate' | 'brotli'> = {}
): Middleware {
  return compression({
    ...options,
    gzip: false,
    deflate: false,
    brotli: true,
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get compression info from context state.
 *
 * @param ctx - Request context
 * @returns Compression info or undefined
 */
export function getCompressionInfo(ctx: Context): CompressionInfo | undefined {
  return ctx.state?.compression as CompressionInfo | undefined;
}

/**
 * Check if response was compressed.
 *
 * @param ctx - Request context
 * @returns Whether response was compressed
 */
export function wasCompressed(ctx: Context): boolean {
  return getCompressionInfo(ctx) !== undefined;
}

/**
 * Create secure compression options for sensitive responses.
 *
 * Enables BREACH mitigation and uses moderate compression level
 * to balance security and performance.
 *
 * @param options - Additional options
 * @returns Secure compression options
 */
export function secureCompressionOptions(
  options: Omit<CompressionOptions, 'breachMitigation'> = {}
): CompressionOptions {
  return {
    ...options,
    breachMitigation: true,
    level: options.level ?? 4, // Lower level for faster compression
  };
}

export default compression;
