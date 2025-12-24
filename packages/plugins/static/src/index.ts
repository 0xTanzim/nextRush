/**
 * @nextrush/static - Static File Serving Middleware
 *
 * High-performance static file middleware with:
 * - Path traversal protection
 * - ETag/Last-Modified caching
 * - Range request support
 * - Dotfile handling
 * - Extension fallbacks
 * - Directory index serving
 *
 * @packageDocumentation
 * @module @nextrush/static
 */

import type { Context, Middleware, Next } from '@nextrush/types';
import { join, resolve } from 'node:path';
import { sendFile } from './send-file';
import type { NormalizedStaticOptions, StaticOptions } from './static.types';
import {
  isDotfile,
  normalizePrefix,
  safeJoin,
  statSafe,
  stripPrefix,
} from './utils';

// Re-export types
export type {
  DotfilesPolicy,
  NormalizedStaticOptions,
  RangeResult,
  StaticContext,
  StaticOptions,
  StatsLike
} from './static.types';

// Re-export utilities
export {
  generateETag,
  getMimeType,
  isDotfile,
  isFresh,
  normalizePrefix,
  parseRange,
  safeJoin,
  statSafe,
  stripPrefix
} from './utils';

export { sendFile } from './send-file';

/**
 * Default options for static middleware
 */
const DEFAULT_OPTIONS: Omit<NormalizedStaticOptions, 'root'> = {
  prefix: '',
  index: 'index.html',
  fallthrough: false,
  redirect: true,
  maxAge: 0,
  immutable: false,
  dotfiles: 'ignore',
  extensions: [],
  etag: true,
  lastModified: true,
  acceptRanges: true,
  highWaterMark: 1048576, // 1MB
};

/**
 * Normalize user options with defaults
 */
function normalizeOptions(options: StaticOptions): NormalizedStaticOptions {
  if (!options.root) {
    throw new Error('[static] "root" option is required');
  }

  const root = resolve(options.root);

  return {
    ...DEFAULT_OPTIONS,
    ...options,
    root,
    prefix: normalizePrefix(options.prefix),
    maxAge: Math.max(0, options.maxAge ?? 0),
  };
}

/**
 * Send error response or call next middleware
 */
async function failOrNext(
  ctx: Context,
  next: Next,
  status: number,
  message: string,
  fallthrough: boolean
): Promise<void> {
  if (fallthrough) {
    return next();
  }
  ctx.status = status;
  ctx.json({ error: message });
}

/**
 * Create static file serving middleware
 *
 * @param options - Configuration options
 * @returns Middleware function
 *
 * @example Basic usage
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { serveStatic } from '@nextrush/static';
 *
 * const app = createApp();
 *
 * // Serve files from 'public' directory at root
 * app.use(serveStatic({ root: './public' }));
 *
 * // Serve at /static prefix
 * app.use(serveStatic({
 *   root: './public',
 *   prefix: '/static',
 *   maxAge: 86400, // 1 day
 * }));
 * ```
 *
 * @example With caching
 * ```typescript
 * app.use(serveStatic({
 *   root: './public',
 *   maxAge: 31536000, // 1 year
 *   immutable: true,  // For fingerprinted assets
 * }));
 * ```
 *
 * @example SPA fallback
 * ```typescript
 * app.use(serveStatic({
 *   root: './dist',
 *   fallthrough: true, // Let 404s fall through to app routes
 * }));
 * ```
 */
export function serveStatic(options: StaticOptions): Middleware {
  const opts = normalizeOptions(options);
  const { root, prefix, fallthrough } = opts;

  return async function staticMiddleware(ctx: Context, next: Next): Promise<void> {
    // Only handle GET and HEAD
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') {
      return next();
    }

    // Check prefix match
    if (prefix) {
      if (ctx.path !== prefix && !ctx.path.startsWith(prefix + '/')) {
        return next();
      }
    }

    // Extract relative path
    const urlPath = stripPrefix(ctx.path, prefix);

    // Decode URL (handle %20, etc.)
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(urlPath);
    } catch {
      // Invalid URL encoding
      return failOrNext(ctx, next, 400, 'Bad Request', fallthrough);
    }

    // Early traversal detection
    if (
      decodedPath.includes('..') ||
      decodedPath.includes('\0') ||
      decodedPath.includes('//') // Prevent double-slash tricks
    ) {
      return failOrNext(ctx, next, 403, 'Forbidden', fallthrough);
    }

    // Safe path join
    const absolutePath = safeJoin(root, decodedPath);
    if (!absolutePath) {
      return failOrNext(ctx, next, 403, 'Forbidden', fallthrough);
    }

    // Stat the file
    let stat = await statSafe(absolutePath);
    let finalPath = absolutePath;

    // Try extension fallbacks if not found
    if (!stat && opts.extensions.length > 0) {
      for (const ext of opts.extensions) {
        const extPath = absolutePath + (ext.startsWith('.') ? ext : `.${ext}`);
        const extStat = await statSafe(extPath);
        if (extStat?.isFile()) {
          stat = extStat;
          finalPath = extPath;
          break;
        }
      }
    }

    // Handle directory
    if (stat?.isDirectory()) {
      // Redirect to add trailing slash
      if (opts.redirect && !ctx.path.endsWith('/')) {
        const location = ctx.path + '/';
        ctx.status = 301;
        ctx.set('Location', location);
        ctx.raw.res.end();
        return;
      }

      // Serve index file
      if (opts.index) {
        const indexPath = join(finalPath, opts.index);
        const indexStat = await statSafe(indexPath);
        if (indexStat?.isFile()) {
          // Check dotfiles for index
          if (isDotfile(indexPath) && opts.dotfiles !== 'allow') {
            return failOrNext(
              ctx,
              next,
              opts.dotfiles === 'deny' ? 403 : 404,
              opts.dotfiles === 'deny' ? 'Forbidden' : 'Not Found',
              fallthrough
            );
          }
          return sendFile(ctx, indexPath, indexStat, opts);
        }
      }

      // No index file - forbidden
      return failOrNext(ctx, next, 403, 'Forbidden', fallthrough);
    }

    // Not found
    if (!stat || !stat.isFile()) {
      return failOrNext(ctx, next, 404, 'Not Found', fallthrough);
    }

    // Handle dotfiles
    if (isDotfile(finalPath)) {
      if (opts.dotfiles === 'deny') {
        return failOrNext(ctx, next, 403, 'Forbidden', fallthrough);
      }
      if (opts.dotfiles === 'ignore') {
        return failOrNext(ctx, next, 404, 'Not Found', fallthrough);
      }
    }

    // Serve the file
    return sendFile(ctx, finalPath, stat, opts);
  };
}

/**
 * Alias for serveStatic (Express-style naming)
 */
export const staticFiles = serveStatic;

/**
 * Create a simple send-file helper
 * Useful for serving specific files in route handlers
 *
 * @example
 * ```typescript
 * import { createSendFile } from '@nextrush/static';
 *
 * const sendPublicFile = createSendFile({ root: './public' });
 *
 * app.get('/download/:file', async (ctx) => {
 *   await sendPublicFile(ctx, ctx.params.file);
 * });
 * ```
 */
export function createSendFile(options: Omit<StaticOptions, 'prefix'>) {
  const opts = normalizeOptions({ ...options, prefix: '' });

  return async function send(ctx: Context, relativePath: string): Promise<boolean> {
    const absolutePath = safeJoin(opts.root, relativePath);
    if (!absolutePath) {
      return false;
    }

    const stat = await statSafe(absolutePath);
    if (!stat?.isFile()) {
      return false;
    }

    if (isDotfile(absolutePath) && opts.dotfiles !== 'allow') {
      return false;
    }

    await sendFile(ctx, absolutePath, stat, opts);
    return true;
  };
}
