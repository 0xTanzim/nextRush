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
import type {
  Application,
  Context,
  DotfilesPolicy,
  Middleware,
  StaticFilesOptions,
  StatsLike,
} from '@/types/context';
import { join, resolve, sep } from 'node:path';
import { safeJoin, sendFile, statSafe, stripPrefix } from './static-utils';

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
      const urlPath = stripPrefix(ctx.path, prefix);
      const decodedPath = decodeURIComponent(urlPath);

      // Early traversal guard (defense-in-depth)
      if (
        decodedPath.includes('/..') ||
        decodedPath.startsWith('..') ||
        decodedPath.includes('..' + sep)
      ) {
        return this.failOrNext(ctx, next, 403, 'Forbidden');
      }

      const joined = safeJoin(root, decodedPath);
      if (!joined) {
        return this.failOrNext(ctx, next, 403, 'Forbidden');
      }
      let candidate: string = joined;

      // Initial stat attempt
      let stat: StatsLike | null = await statSafe(candidate);

      // If not found, try extension fallbacks (e.g. request for "/test" -> test.html)
      if (!stat && options.extensions.length > 0) {
        for (const ext of options.extensions) {
          const withExt = candidate + ext;
          const extStat = await statSafe(withExt);
          if (extStat) {
            stat = extStat;
            candidate = withExt;
            break;
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
          const indexStat = await statSafe(indexPath);
          if (indexStat?.isFile()) {
            return sendFile(ctx, indexPath, indexStat, options);
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
      return sendFile(ctx, candidate, stat, options);
    };
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
