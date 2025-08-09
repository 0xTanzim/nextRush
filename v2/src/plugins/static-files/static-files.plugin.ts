/**
 * Static Files Plugin for NextRush v2
 *
 * Express/Koa/Fastify-inspired static file serving with strong DX and security.
 *
 * - Prefix-based mounting (virtual path)
 * - Safe path resolution (prevents traversal)
 * - ETag/Last-Modified + 304 handling
 * - Range requests (single range)
 * - Cache-Control with maxAge/immutable
 * - HEAD support
 * - Optional index.html serving and directory redirect
 * - Dotfiles policy (ignore/deny/allow)
 * - Optional custom header hook
 *
 * @packageDocumentation
 */

import { BasePlugin } from '@/plugins/core/base-plugin';
import type { Application, Context, Middleware } from '@/types/context';
import { createReadStream, promises as fsp } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

/** Dotfiles policy */
type DotfilesPolicy = 'ignore' | 'deny' | 'allow';

/** Options for StaticFilesPlugin */
export interface StaticFilesOptions {
  /** Absolute directory to serve files from */
  root: string;
  /** URL prefix to mount under, e.g., "/static"; default: '' (root) */
  prefix?: `/${string}` | '';
  /** Default index file to serve for directories; set false to disable */
  index?: string | false;
  /** If true, call next() on 404 instead of sending 404; default: false */
  fallthrough?: boolean;
  /** If true, redirect directory request without trailing slash to slash; default: true */
  redirect?: boolean;
  /** Send Cache-Control max-age seconds; default: 0 (no explicit caching) */
  maxAge?: number;
  /** Add immutable directive to Cache-Control when maxAge > 0; default: false */
  immutable?: boolean;
  /** Control dotfiles serving; default: 'ignore' (404) */
  dotfiles?: DotfilesPolicy;
  /** Additional extensions to try when file not found (e.g., ['.html']); default: [] */
  extensions?: string[];
  /** Hook to customize headers */
  // Optional in source options, normalized as undefined or a function
  setHeaders?:
    | ((ctx: Context, absolutePath: string, stat: StatsLike) => void)
    | undefined;
}

interface StatsLike {
  size: number;
  mtime: Date;
  isFile(): boolean;
  isDirectory(): boolean;
}

type NormalizedStaticFilesOptions = {
  root: string;
  prefix: `/${string}` | '';
  index: string | false;
  fallthrough: boolean;
  redirect: boolean;
  maxAge: number;
  immutable: boolean;
  dotfiles: DotfilesPolicy;
  extensions: string[];
  setHeaders?: (ctx: Context, absolutePath: string, stat: StatsLike) => void;
};

/**
 * StaticFilesPlugin
 */
export class StaticFilesPlugin extends BasePlugin {
  public override name = 'StaticFilesPlugin';
  public override version = '2.0.0-alpha.1';
  public override description =
    'High-performance static assets server with strong DX';

  private options!: NormalizedStaticFilesOptions;

  constructor(private readonly userOptions: StaticFilesOptions) {
    super();
  }

  public override onInstall(app: Application): void {
    this.options = this.normalizeOptions(this.userOptions);
    const middleware = this.createStaticMiddleware(this.options);
    app.use(middleware);
  }

  private normalizeOptions(
    options: StaticFilesOptions
  ): NormalizedStaticFilesOptions {
    if (!options.root) {
      throw new Error('[StaticFilesPlugin] "root" directory is required');
    }
    const rootResolved = resolve(options.root);
    const normalized: NormalizedStaticFilesOptions = {
      root: rootResolved,
      prefix: options.prefix === '/' ? '' : (options.prefix ?? ''),
      index: options.index === undefined ? 'index.html' : options.index,
      fallthrough: options.fallthrough ?? false,
      redirect: options.redirect ?? true,
      maxAge: Math.max(0, options.maxAge ?? 0),
      immutable: options.immutable ?? false,
      dotfiles: options.dotfiles ?? 'ignore',
      extensions: options.extensions ?? [],
    };
    if (typeof options.setHeaders === 'function') {
      normalized.setHeaders = options.setHeaders;
    }
    return normalized;
  }

  private createStaticMiddleware(
    options: StaticFilesPlugin['options']
  ): Middleware {
    const { root, prefix } = options;

    return async (ctx, next) => {
      // Only handle GET/HEAD
      if (ctx.method !== 'GET' && ctx.method !== 'HEAD') {
        return next();
      }

      // Prefix check
      if (
        prefix &&
        !ctx.path.startsWith(prefix + (prefix.endsWith('/') ? '' : '/')) &&
        ctx.path !== prefix
      ) {
        return next();
      }

      // Map URL path to filesystem path
      const urlPath = this.stripPrefix(ctx.path, prefix);
      const decodedPath = decodeURIComponent(urlPath);

      // Early traversal guard (defense-in-depth)
      if (
        decodedPath.includes('/..') ||
        decodedPath.startsWith('..') ||
        decodedPath.includes('..' + sep)
      ) {
        return this.failOrNext(ctx, next, 403, 'Forbidden');
      }

      const joined = this.safeJoin(root, decodedPath);
      if (!joined) {
        return this.failOrNext(ctx, next, 403, 'Forbidden');
      }
      let candidate: string = joined;

      let stat: StatsLike | null = null;
      try {
        stat = await this.statSafe(candidate);
      } catch {
        // Try with extensions if configured
        for (const ext of options.extensions) {
          const withExt: string = candidate + ext;
          try {
            stat = await this.statSafe(withExt);
            if (stat) {
              candidate = withExt;
              break;
            }
          } catch {
            // continue
          }
        }
      }

      // Directory handling
      if (stat?.isDirectory()) {
        // Redirect to add trailing slash if enabled and missing
        if (options.redirect && !ctx.path.endsWith('/')) {
          const location = ctx.path + '/';
          ctx.res.status(301).setHeader('Location', location);
          ctx.res.end();
          return;
        }

        if (options.index) {
          const indexPath = join(candidate, options.index);
          try {
            const indexStat = await this.statSafe(indexPath);
            if (indexStat?.isFile()) {
              return this.sendFile(ctx, indexPath, indexStat, options);
            }
          } catch {
            // no index found
          }
        }

        return this.failOrNext(ctx, next, 403, 'Forbidden');
      }

      // Not found
      if (!stat) {
        return this.failOrNext(ctx, next, 404, 'Not Found');
      }

      // Dotfiles policy
      const baseName = candidate.split(sep).pop() || '';
      if (baseName.startsWith('.')) {
        if (options.dotfiles === 'deny') {
          return this.failOrNext(ctx, next, 403, 'Forbidden');
        }
        if (options.dotfiles === 'ignore') {
          return this.failOrNext(ctx, next, 404, 'Not Found');
        }
      }

      // Serve file
      return this.sendFile(ctx, candidate, stat, options);
    };
  }

  private stripPrefix(pathname: string, prefix: string): string {
    if (!prefix) return pathname;
    return pathname === prefix ? '/' : pathname.slice(prefix.length);
  }

  private safeJoin(root: string, urlPath: string): string | null {
    // Normalize and remove leading slash to avoid join ignoring root
    const cleaned = normalize(urlPath).replace(/^\/+/, '');
    const abs = resolve(root, cleaned);
    // Extra defense: block any parent traversal patterns even after normalize
    if (cleaned.startsWith('..') || cleaned.includes(`..${sep}`)) {
      return null;
    }
    if (!abs.startsWith(root + sep) && abs !== root) {
      return null; // path traversal attempt
    }
    return abs;
  }

  private async statSafe(path: string): Promise<StatsLike | null> {
    try {
      const s = await fsp.stat(path);
      return {
        size: s.size,
        mtime: s.mtime,
        isFile: () => s.isFile(),
        isDirectory: () => s.isDirectory(),
      } satisfies StatsLike;
    } catch {
      return null;
    }
  }

  private setCommonHeaders(
    ctx: Context,
    absolutePath: string,
    stat: StatsLike,
    options: StaticFilesPlugin['options']
  ): void {
    // Content-Type
    const ext = extname(absolutePath).toLowerCase();
    const contentType = (ctx.res as any).getContentTypeFromExtension
      ? (ctx.res as any).getContentTypeFromExtension(ext)
      : this.fallbackMime(ext);
    if (contentType) {
      ctx.res.setHeader('Content-Type', contentType);
    }

    // Length and modification
    ctx.res.setHeader('Content-Length', String(stat.size));
    ctx.res.setHeader('Last-Modified', stat.mtime.toUTCString());

    // ETag
    const etag = this.generateETag(stat);
    ctx.res.setHeader('ETag', etag);

    // Cache-Control
    if (options.maxAge > 0) {
      const parts = [
        `public`,
        `max-age=${Math.floor(options.maxAge)}`,
        options.immutable ? 'immutable' : undefined,
      ].filter(Boolean) as string[];
      ctx.res.setHeader('Cache-Control', parts.join(', '));
    }

    // Custom headers hook
    options.setHeaders?.(ctx, absolutePath, stat);
  }

  private isFresh(ctx: Context, stat: StatsLike): boolean {
    const ifNoneMatch = ctx.headers['if-none-match'];
    const ifModifiedSince = ctx.headers['if-modified-since'];
    const etag = this.generateETag(stat);

    if (typeof ifNoneMatch === 'string' && ifNoneMatch === etag) {
      return true;
    }
    if (typeof ifModifiedSince === 'string') {
      const since = Date.parse(ifModifiedSince);
      if (!Number.isNaN(since) && stat.mtime.getTime() <= since) {
        return true;
      }
    }
    return false;
  }

  private async sendFile(
    ctx: Context,
    absolutePath: string,
    stat: StatsLike,
    options: StaticFilesPlugin['options']
  ): Promise<void> {
    // Conditional GET
    if (this.isFresh(ctx, stat)) {
      this.setCommonHeaders(ctx, absolutePath, stat, options);
      ctx.res.statusCode = 304;
      ctx.res.end();
      return;
    }

    // Range requests
    const range =
      typeof ctx.headers['range'] === 'string'
        ? ctx.headers['range']
        : undefined;
    if (range && range.startsWith('bytes=')) {
      const { start, end } = this.parseRange(range, stat.size);
      if (start >= 0 && end >= start && end < stat.size) {
        this.setCommonHeaders(ctx, absolutePath, stat, options);
        ctx.res.setHeader('Accept-Ranges', 'bytes');
        ctx.res.setHeader(
          'Content-Range',
          `bytes ${start}-${end}/${stat.size}`
        );
        ctx.res.setHeader('Content-Length', String(end - start + 1));
        ctx.res.statusCode = 206;
        (ctx.res as any).flushHeaders?.();
        if (ctx.method === 'HEAD') {
          ctx.res.end();
          return;
        }
        const stream = createReadStream(absolutePath, { start, end });
        stream.on('error', () =>
          ctx.res.statusCode === 200 ? ctx.res.status(500).end() : ctx.res.end()
        );
        stream.pipe(ctx.res);
        return;
      }
      // Invalid range
      ctx.res.statusCode = 416;
      ctx.res.setHeader('Content-Range', `bytes */${stat.size}`);
      ctx.res.end();
      return;
    }

    // Full file
    this.setCommonHeaders(ctx, absolutePath, stat, options);
    (ctx.res as any).flushHeaders?.();
    if (ctx.method === 'HEAD') {
      ctx.res.end();
      return;
    }
    const stream = createReadStream(absolutePath);
    stream.on('error', () =>
      ctx.res.statusCode === 200 ? ctx.res.status(500).end() : ctx.res.end()
    );
    stream.pipe(ctx.res);
  }

  private fallbackMime(ext: string): string {
    switch (ext) {
      case '.html':
        return 'text/html';
      case '.css':
        return 'text/css';
      case '.js':
        return 'application/javascript';
      case '.json':
        return 'application/json';
      case '.txt':
        return 'text/plain';
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.gif':
        return 'image/gif';
      case '.svg':
        return 'image/svg+xml';
      default:
        return 'application/octet-stream';
    }
  }

  private generateETag(stat: StatsLike): string {
    // Fast weak ETag approximation based on size and mtime
    const base = `${stat.size}-${stat.mtime.getTime()}`;
    // Simple FNV-1a 32-bit
    let hash = 2166136261;
    for (let i = 0; i < base.length; i++) {
      hash ^= base.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    return `"${hash.toString(16)}"`;
  }

  private parseRange(
    range: string,
    size: number
  ): { start: number; end: number } {
    // bytes=start-end
    const spec = range.replace(/^bytes=/, '');
    const [startStr, endStr] = spec.split('-');
    let start = startStr ? parseInt(startStr, 10) : NaN;
    let end = endStr ? parseInt(endStr, 10) : NaN;

    if (Number.isNaN(start)) {
      // suffix range "-N"
      const suffix = Number.isNaN(end) ? 0 : end;
      start = Math.max(0, size - suffix);
      end = size - 1;
    } else if (Number.isNaN(end)) {
      end = size - 1;
    }

    if (start < 0) start = 0;
    if (end >= size) end = size - 1;
    return { start, end };
  }

  private async failOrNext(
    ctx: Context,
    next: () => Promise<void>,
    status: number,
    message: string
  ): Promise<void> {
    if (this.options.fallthrough) {
      return next();
    }
    ctx.res.status(status).json({ error: message });
  }
}
