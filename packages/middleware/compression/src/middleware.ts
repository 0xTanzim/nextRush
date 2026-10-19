/**
 * @nextrush/compression - Middleware
 *
 * Compression middleware for NextRush applications.
 *
 * @remarks
 * Compression rewrites the outgoing body, so it needs an adapter that still
 * exposes that body after the handler ran. Both shipped adapter families commit
 * the response before the middleware chain unwinds — the Node adapter writes and
 * ends it inside the handler, the Web adapters record it privately and build the
 * `Response` afterwards — so a response produced with `ctx.json()`/`send()` is
 * already gone by the time this middleware looks. It never reads the parsed
 * request body as a substitute, and it reports the situation once per process
 * rather than failing silently. See the package README's compatibility notes.
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
import type {
  CompressionInfo,
  CompressionMiddleware as CompressionMiddlewareFn,
  CompressionOptions,
  ResolvedCompressionOptions,
} from './types.js';

// ============================================================================
// Outgoing Response Shape
// ============================================================================

/**
 * The outgoing response an adapter still exposes after the handler ran.
 *
 * `body` is the buffered outgoing body — the only thing compression can rewrite.
 * An adapter that has already written the body out leaves it `undefined`, which
 * is information, not a failure: it says the body can no longer be transformed.
 */
interface OutgoingResponse {
  body?: unknown;
  getHeader?: (name: string) => string | number | string[] | undefined;
}

/**
 * Resolve the adapter's outgoing response, or `null` when the adapter exposes
 * none.
 *
 * Header access is the marker. The Web context reports `res` as `undefined` on
 * every request, because its response is recorded privately and materialised
 * after the chain, so there is nothing here to inspect or rewrite.
 */
function outgoingResponseOf(ctx: Context): OutgoingResponse | null {
  const res = ctx.raw?.res as OutgoingResponse | undefined;
  return typeof res?.getHeader === 'function' ? res : null;
}

/**
 * Read a response header from the same shape everything else is read from.
 */
function responseHeaderOf(res: OutgoingResponse, name: string): string | undefined {
  const value = res.getHeader?.(name);
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value[0];
  return undefined;
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
 * @param res - The adapter's outgoing response
 * @param options - Resolved options
 * @returns Whether compression should be applied
 */
function shouldCompressResponse(res: OutgoingResponse, options: ResolvedCompressionOptions): boolean {
  // SEC-17: Cache-Control: no-transform is an explicit instruction that no
  // intermediary may transform the entity body — compression is exactly
  // such a transform.
  const cacheControl = responseHeaderOf(res, 'cache-control');
  if (cacheControl && hasNoTransformDirective(cacheControl)) {
    return false;
  }

  // Check if already encoded
  const contentEncoding = responseHeaderOf(res, 'content-encoding');
  if (contentEncoding && contentEncoding !== 'identity') {
    return false;
  }

  // Check content type
  const contentType = responseHeaderOf(res, 'content-type');

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
 * Read the buffered outgoing body, or `null` when the adapter has none.
 *
 * Deliberately narrow: `ctx.body` carries the *parsed request body*, so reading
 * it here would compress the request the client sent back to it. Only the body
 * the adapter still holds for the response is eligible.
 */
function getResponseBody(res: OutgoingResponse): string | Uint8Array | Buffer | object | null {
  const body = res.body;

  if (body === undefined || body === null || typeof body === 'function') {
    return null;
  }

  return body as string | Uint8Array | Buffer | object;
}

/**
 * Convert body to Uint8Array for compression.
 */
function bodyToBytes(body: unknown): Uint8Array {
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

/**
 * Set the compressed body on the adapter's outgoing response.
 */
function setCompressedBody(res: OutgoingResponse, data: Uint8Array): void {
  res.body = data;
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
 * Compression needs the outgoing body, so it applies only where the adapter
 * still exposes it after the handler ran. On the shipped adapters a response
 * written with `ctx.json()`/`send()`/`html()` has already been committed by
 * then: nothing is compressed, the request body is never used as a substitute,
 * and the situation is reported once per process. See the package README's
 * compatibility notes.
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
    const outgoingBody = outgoing === null ? null : getResponseBody(outgoing);

    if (outgoing === null || outgoingBody === null) {
      warnNoOutgoingBodyOnce();
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
      ctx.set('Content-Length', String(result.data.length));

      // Update Vary header
      const vary = responseHeaderOf(outgoing, 'vary');
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

      // Set compressed body
      setCompressedBody(outgoing, result.data);
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
