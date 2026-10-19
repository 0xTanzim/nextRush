/**
 * @nextrush/compression - Middleware
 *
 * Compression middleware for NextRush applications.
 *
 * @remarks
 * Compression rewrites the outgoing body, so it needs the response the adapter
 * is about to send. Every shipped adapter records that response on the context
 * (RFC-041) and flushes it once the middleware chain unwinds, so this middleware
 * reads and replaces the recorded body through {@link outgoingResponseOf}. It
 * never reads the parsed request body as a substitute.
 *
 * @packageDocumentation
 */

import type { Context, Middleware } from '@nextrush/types';
import { compress, detectCapabilities, isEncodingSupported } from './compressor.js';
import { warnNoOutgoingBodyOnce } from './warnings.js';
import {
  DEFAULT_OPTIONS,
  MAX_IN_MEMORY_SIZE,
  NO_BODY_METHODS,
  NO_COMPRESS_STATUS_CODES,
  VARY_HEADER,
} from './constants.js';
import { isCompressible } from './content-type.js';
import { selectEncoding } from './negotiation.js';
import { outgoingResponseOf, type OutgoingBody, type OutgoingResponseView } from './outgoing.js';
import type {
  CompressionInfo,
  CompressionMiddleware as CompressionMiddlewareFn,
  CompressionOptions,
  ResolvedCompressionOptions,
} from './types.js';

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
    skip: options.skip,
    breachMitigation: options.breachMitigation ?? false,
  };
}

// ============================================================================
// Compression Eligibility
// ============================================================================

/**
 * Whether the request is a compression candidate at all, judged from the
 * request alone so a response this middleware cannot see is not reported for a
 * request that never asked for compression.
 */
function isCompressionCandidate(ctx: Context, options: ResolvedCompressionOptions): boolean {
  if (NO_BODY_METHODS.includes(ctx.method)) {
    return false;
  }

  if (NO_COMPRESS_STATUS_CODES.includes(ctx.status)) {
    return false;
  }

  // Check custom filter
  if (options.filter && !options.filter(ctx)) {
    return false;
  }

  // SEC-17: per-response skip predicate — checked independently of filter
  // so either one opting out is sufficient.
  if (options.skip?.(ctx)) {
    return false;
  }

  return true;
}

/**
 * Whether the response headers allow compression.
 *
 * @param response - The outgoing response view
 * @param options - Resolved options
 * @returns Whether compression should be applied
 */
function shouldCompressResponse(
  response: OutgoingResponseView,
  options: ResolvedCompressionOptions
): boolean {
  // SEC-17: Cache-Control: no-transform is an explicit instruction that no
  // intermediary may transform the entity body — compression is exactly
  // such a transform.
  const cacheControl = response.header('cache-control');
  if (cacheControl && hasNoTransformDirective(cacheControl)) {
    return false;
  }

  // Check if already encoded
  const contentEncoding = response.header('content-encoding');
  if (contentEncoding && contentEncoding !== 'identity') {
    return false;
  }

  // Check content type
  const contentType = response.header('content-type');

  return isCompressible(contentType, {
    contentTypes: options.contentTypes,
    exclude: options.exclude,
  });
}

/**
 * Whether a `Cache-Control` header value contains the `no-transform`
 * directive (SEC-17), matched case-insensitively and independent of
 * neighboring directives or whitespace.
 */
function hasNoTransformDirective(cacheControl: string): boolean {
  return cacheControl
    .split(',')
    .some((directive) => directive.trim().toLowerCase() === 'no-transform');
}

/**
 * Convert body to Uint8Array for compression.
 */
function bodyToBytes(body: OutgoingBody): Uint8Array {
  if (typeof body === 'string') {
    return new TextEncoder().encode(body);
  }

  if (body instanceof Uint8Array) {
    return body;
  }

  if (typeof body === 'object' && body !== null) {
    return new TextEncoder().encode(JSON.stringify(body));
  }

  return new Uint8Array(0);
}

/**
 * Apply BREACH mitigation by adding a random-length padding header.
 *
 * BREACH attacks exploit compression ratio differences to extract secrets.
 * A random-length header adds entropy without corrupting the response body.
 */
function applyBreachMitigation(ctx: Context): void {
  const paddingLength = Math.floor(Math.random() * 256) + 1;
  ctx.set('X-Pad', 'x'.repeat(paddingLength));
}

// ============================================================================
// Main Middleware
// ============================================================================

/**
 * Create compression middleware.
 *
 * Compresses responses based on:
 * - Accept-Encoding header from client
 * - Content-Type of response
 * - Response size (threshold)
 * - Custom filter function
 *
 * @remarks
 * Compression reads the response the adapter recorded and rewrites its body
 * after the handler ran, so it behaves the same on every shipped adapter: Node,
 * Bun, Deno, the edge runtimes and serverless all flush the recorded response
 * once the middleware chain unwinds. The parsed request body is never used as a
 * substitute. A streamed response has no recorded body to rewrite and is left
 * untouched.
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
    if (!isCompressionCandidate(ctx, opts)) {
      return;
    }

    const outgoing = outgoingResponseOf(ctx);
    if (outgoing === null) {
      // No adapter-visible response at all: the one case where this middleware
      // genuinely cannot act, and the one worth reporting.
      warnNoOutgoingBodyOnce();
      return;
    }

    const outgoingBody = outgoing.body();
    if (outgoingBody === null) {
      // A bodyless or streamed response: nothing to rewrite, and nothing wrong —
      // the adapter sends it as the handler produced it.
      return;
    }

    if (!shouldCompressResponse(outgoing, opts)) {
      return;
    }

    // Negotiate encoding
    const acceptEncoding = ctx.get('accept-encoding');
    const encoding = selectEncoding(acceptEncoding, opts);

    if (!encoding || !isEncodingSupported(encoding)) {
      return;
    }

    // Convert body once — avoids double serialization for objects
    const data = bodyToBytes(outgoingBody);
    const bodySize = data.length;

    // Check threshold
    if (bodySize < opts.threshold) {
      return;
    }

    // Skip compression for very large responses to avoid OOM
    if (bodySize > MAX_IN_MEMORY_SIZE) {
      return;
    }

    try {
      // Compress
      const result = await compress(data, encoding, { level: opts.level });

      // Set response headers
      ctx.set('Content-Encoding', encoding);

      // Update Vary header
      const vary = outgoing.header('vary');
      if (!vary?.toLowerCase().includes('accept-encoding')) {
        ctx.set('Vary', vary ? `${vary}, ${VARY_HEADER}` : VARY_HEADER);
      }

      // Store compression info in state
      if (ctx.state) {
        ctx.state.compression = result.info;
      }

      // Apply BREACH mitigation if enabled (safe header-based padding)
      if (opts.breachMitigation) {
        applyBreachMitigation(ctx);
      }

      // Replace the recorded body, then describe it. The order matters: a body
      // replacement invalidates the length recorded for the body it replaced, so
      // the compressed length is written after the swap.
      outgoing.replaceBody(result.data);
      ctx.set('Content-Length', String(result.data.length));
    } catch (error: unknown) {
      // Compression failed — graceful degradation: send the original uncompressed response.
      // Make the failure observable via state for logging/monitoring middleware.
      ctx.state.compressionError =
        error instanceof Error ? error.message : 'Unknown compression error';
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
