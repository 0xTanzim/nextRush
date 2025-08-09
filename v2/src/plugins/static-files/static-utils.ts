import { createReadStream, promises as fsp } from 'node:fs';
import { extname, normalize, resolve, sep } from 'node:path';
import type { Context } from '../../types/context';
import type { StaticFilesPlugin } from './static-files.plugin';

export interface StatsLike {
  size: number;
  mtime: Date;
  isFile(): boolean;
  isDirectory(): boolean;
}

export function stripPrefix(pathname: string, prefix: string): string {
  if (!prefix) return pathname;
  return pathname === prefix ? '/' : pathname.slice(prefix.length);
}

export function safeJoin(root: string, urlPath: string): string | null {
  const cleaned = normalize(urlPath).replace(/^\/+/, '');
  const abs = resolve(root, cleaned);
  if (cleaned.startsWith('..') || cleaned.includes(`..${sep}`)) {
    return null;
  }
  if (!abs.startsWith(root + sep) && abs !== root) {
    return null;
  }
  return abs;
}

export async function statSafe(path: string): Promise<StatsLike | null> {
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

export function generateETag(stat: StatsLike): string {
  const base = `${stat.size}-${stat.mtime.getTime()}`;
  let hash = 2166136261;
  for (let i = 0; i < base.length; i++) {
    hash ^= base.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return `"${hash.toString(16)}"`;
}

export function isFresh(ctx: Context, stat: StatsLike): boolean {
  const ifNoneMatch = ctx.headers['if-none-match'];
  const ifModifiedSince = ctx.headers['if-modified-since'];
  const etag = generateETag(stat);
  if (typeof ifNoneMatch === 'string' && ifNoneMatch === etag) return true;
  if (typeof ifModifiedSince === 'string') {
    const since = Date.parse(ifModifiedSince);
    if (!Number.isNaN(since) && stat.mtime.getTime() <= since) return true;
  }
  return false;
}

export function fallbackMime(ext: string): string {
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

export function setCommonHeaders(
  ctx: Context,
  absolutePath: string,
  stat: StatsLike,
  options: StaticFilesPlugin['options']
): void {
  const ext = extname(absolutePath).toLowerCase();
  const contentType = (ctx.res as any).getContentTypeFromExtension
    ? (ctx.res as any).getContentTypeFromExtension(ext)
    : fallbackMime(ext);
  if (contentType) ctx.res.setHeader('Content-Type', contentType);
  ctx.res.setHeader('Content-Length', String(stat.size));
  ctx.res.setHeader('Last-Modified', stat.mtime.toUTCString());
  const etag = generateETag(stat);
  ctx.res.setHeader('ETag', etag);
  if (options.maxAge > 0) {
    const parts = [
      'public',
      `max-age=${Math.floor(options.maxAge)}`,
      options.immutable ? 'immutable' : undefined,
    ].filter(Boolean) as string[];
    ctx.res.setHeader('Cache-Control', parts.join(', '));
  }
  options.setHeaders?.(ctx, absolutePath, stat);
}

export function parseRange(
  range: string,
  size: number
): { start: number; end: number } {
  const spec = range.replace(/^bytes=/, '');
  const [startStr, endStr] = spec.split('-');
  let start = startStr ? parseInt(startStr, 10) : NaN;
  let end = endStr ? parseInt(endStr, 10) : NaN;
  if (Number.isNaN(start)) {
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

export async function sendFile(
  ctx: Context,
  absolutePath: string,
  stat: StatsLike,
  options: StaticFilesPlugin['options']
): Promise<void> {
  if (isFresh(ctx, stat)) {
    setCommonHeaders(ctx, absolutePath, stat, options);
    ctx.res.statusCode = 304;
    ctx.res.end();
    return;
  }
  const range =
    typeof ctx.headers['range'] === 'string' ? ctx.headers['range'] : undefined;
  if (range && range.startsWith('bytes=')) {
    const { start, end } = parseRange(range, stat.size);
    if (start >= 0 && end >= start && end < stat.size) {
      setCommonHeaders(ctx, absolutePath, stat, options);
      ctx.res.setHeader('Accept-Ranges', 'bytes');
      ctx.res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
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
    ctx.res.statusCode = 416;
    ctx.res.setHeader('Content-Range', `bytes */${stat.size}`);
    ctx.res.end();
    return;
  }
  setCommonHeaders(ctx, absolutePath, stat, options);
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
