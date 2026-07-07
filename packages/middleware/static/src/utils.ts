/**
 * @nextrush/static - Utility Functions
 *
 * Path safety, file stats, caching, and MIME type utilities.
 *
 * @packageDocumentation
 */

import type { Context } from '@nextrush/types';
import { promises as fsp } from 'node:fs';
import { extname, normalize, resolve, sep } from 'node:path';
import type { RangeResult, StatsLike } from './static.types';

/**
 * Maximum safe integer for range parsing to prevent overflow
 */
const MAX_RANGE_VALUE = Number.MAX_SAFE_INTEGER;

/**
 * Strip prefix from path
 */
export function stripPrefix(pathname: string, prefix: string): string {
  if (!prefix) return pathname;
  if (pathname === prefix) return '/';
  if (pathname.startsWith(prefix + '/')) return pathname.slice(prefix.length);
  if (pathname.startsWith(prefix)) return pathname.slice(prefix.length) || '/';
  return pathname;
}

/**
 * Safely join root directory with URL path
 * Returns null if path traversal is detected
 *
 * Security: Prevents directory traversal attacks
 */
export function safeJoin(root: string, urlPath: string): string | null {
  const cleaned = normalize(urlPath).replace(/^\/+/, '');

  // Block obvious traversal
  if (cleaned.startsWith('..') || cleaned.includes(`..${sep}`)) {
    return null;
  }

  const abs = resolve(root, cleaned);

  // Verify result is within root
  if (abs !== root && !abs.startsWith(root + sep)) {
    return null;
  }

  return abs;
}

/**
 * Safely stat a file, returning null on error
 * Uses lstat by default to not follow symlinks
 *
 * @param path - Absolute path to stat
 * @param followSymlinks - Whether to follow symlinks (default: false)
 * @param root - Root directory for symlink validation (required if followSymlinks=true)
 */
export async function statSafe(
  path: string,
  followSymlinks = false,
  root?: string
): Promise<StatsLike | null> {
  try {
    // Use lstat to check if it's a symlink first
    const lstats = await fsp.lstat(path);

    if (lstats.isSymbolicLink()) {
      if (!followSymlinks) {
        // Symlinks not allowed - treat as not found
        return null;
      }

      // Resolve the symlink and verify it's within root
      if (!root) {
        // Safety: if no root provided, reject symlinks
        return null;
      }

      const realPath = await fsp.realpath(path);
      const normalizedRoot = resolve(root);

      // Verify resolved path is within root
      if (realPath !== normalizedRoot && !realPath.startsWith(normalizedRoot + sep)) {
        // Symlink points outside root - security violation
        return null;
      }

      // Now safe to stat the resolved path
      const s = await fsp.stat(path);
      return {
        size: s.size,
        mtime: s.mtime,
        isFile: () => s.isFile(),
        isDirectory: () => s.isDirectory(),
      };
    }

    // Not a symlink, return lstats directly
    return {
      size: lstats.size,
      mtime: lstats.mtime,
      isFile: () => lstats.isFile(),
      isDirectory: () => lstats.isDirectory(),
    };
  } catch {
    return null;
  }
}

/**
 * Generate weak ETag from file stats
 * Uses FNV-1a hash for speed
 */
export function generateETag(stat: StatsLike): string {
  const base = `${stat.size}-${stat.mtime.getTime()}`;
  let hash = 2166136261; // FNV offset basis

  for (let i = 0; i < base.length; i++) {
    hash ^= base.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, keep unsigned
  }

  return `W/"${hash.toString(16)}"`;
}

/**
 * Check if request is fresh (304 eligible)
 * Supports If-None-Match (ETag) and If-Modified-Since
 */
export function isFresh(ctx: Context, stat: StatsLike, etag: string): boolean {
  const ifNoneMatch = ctx.headers['if-none-match'];
  const ifModifiedSince = ctx.headers['if-modified-since'];

  // ETag match takes precedence
  if (typeof ifNoneMatch === 'string') {
    // Handle multiple ETags: "tag1", "tag2", ...
    const tags = ifNoneMatch.split(',').map((t) => t.trim());
    if (tags.includes(etag) || tags.includes('*')) {
      return true;
    }
  }

  // Fall back to Last-Modified check
  if (typeof ifModifiedSince === 'string') {
    const since = Date.parse(ifModifiedSince);
    if (!Number.isNaN(since) && stat.mtime.getTime() <= since) {
      return true;
    }
  }

  return false;
}

/**
 * Parse Range header
 * Returns null for invalid/unsatisfiable ranges
 *
 * Supports: bytes=start-end, bytes=start-, bytes=-suffix
 *
 * Security: Validates integers are within safe bounds to prevent overflow
 */
export function parseRange(
  rangeHeader: string,
  size: number
): RangeResult | null {
  if (!rangeHeader.startsWith('bytes=')) {
    return null;
  }

  const spec = rangeHeader.slice(6); // Remove 'bytes='
  const ranges = spec.split(',');

  // Only support single range for simplicity
  if (ranges.length !== 1) {
    return null;
  }

  const rangePart = ranges[0]?.trim();
  if (!rangePart) {
    return null;
  }

  const parts = rangePart.split('-');
  const startStr = parts[0] ?? '';
  const endStr = parts[1] ?? '';

  let start: number;
  let end: number;

  if (startStr === '') {
    // Suffix range: -500 means last 500 bytes
    const suffix = parseInt(endStr, 10);
    if (Number.isNaN(suffix) || suffix <= 0 || suffix > MAX_RANGE_VALUE) {
      return null;
    }
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = parseInt(startStr, 10);
    if (Number.isNaN(start) || start < 0 || start > MAX_RANGE_VALUE) {
      return null;
    }

    if (endStr === '') {
      // Open-ended: start-
      end = size - 1;
    } else {
      end = parseInt(endStr, 10);
      if (Number.isNaN(end) || end > MAX_RANGE_VALUE) {
        return null;
      }
    }
  }

  // Validate range
  if (start > end || start >= size) {
    return null;
  }

  // Clamp end to file size
  if (end >= size) {
    end = size - 1;
  }

  return { start, end };
}

/**
 * MIME type map for common extensions
 */
const MIME_TYPES: Record<string, string> = {
  // Text
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.xml': 'text/xml; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',

  // JavaScript/JSON
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',

  // TypeScript (served as JS)
  '.ts': 'application/typescript; charset=utf-8',
  '.tsx': 'application/typescript; charset=utf-8',
  '.jsx': 'application/javascript; charset=utf-8',

  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',

  // Fonts
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',

  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',

  // Video
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',

  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx':
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',

  // Archives
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed',

  // Web
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',

  // Data
  '.yaml': 'text/yaml; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
  '.toml': 'text/toml; charset=utf-8',
};

/**
 * Get MIME type for file extension
 */
export function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Check if filename is a dotfile
 */
export function isDotfile(filePath: string): boolean {
  const parts = filePath.split(sep);
  return parts.some((part) => part.startsWith('.') && part !== '.' && part !== '..');
}

/**
 * Normalize prefix to ensure consistent format
 * - '' stays as ''
 * - '/' becomes ''
 * - '/static' stays as '/static'
 * - '/static/' becomes '/static'
 */
export function normalizePrefix(prefix: string | undefined): string {
  if (!prefix || prefix === '/') return '';
  return prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
}
