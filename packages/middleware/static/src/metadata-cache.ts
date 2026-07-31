/**
 * @nextrush/static - Derived-metadata cache
 *
 * `setFileHeaders()` derived MIME type, `Last-Modified`, and `ETag` fresh on
 * every request. All three are pure functions of `stat` (size + mtime) and the
 * path's extension, so a file whose content hasn't changed recomputes the
 * identical answer on every request. Measured cost on the 36-byte benchmark
 * file: NextRush lost the `static-file` scenario to Express — the only
 * scenario in the comparison matrix where that happens.
 *
 * `serveStatic()` still calls `statSafe()` on every request (freshness is
 * never skipped); this cache only skips *re-deriving* the string fields that
 * map from an unchanged stat result. A cache hit still passes through
 * `isFresh()`'s own conditional-request check unchanged.
 *
 * @packageDocumentation
 */

import type { StatsLike } from './static.types';
import { generateETag, getMimeType } from './utils';

/** One cached, derived-from-stat header field set for one file. */
export interface CachedFileMetadata {
  readonly mimeType: string;
  readonly etag: string;
  readonly lastModifiedString: string;
}

interface CacheEntry extends CachedFileMetadata {
  readonly size: number;
  readonly mtimeMs: number;
}

/**
 * Bounded so a directory of many distinct files cannot grow this without
 * limit. Simple insertion-order eviction (a `Map` preserves insertion order,
 * and re-inserting on every hit keeps a hot entry from being evicted): this
 * favors recently-*requested* files over a strict LRU, which is the correct
 * bias for a static-file cache — the working set is the files clients are
 * actually asking for right now.
 */
const MAX_ENTRIES = 1000;

const cache = new Map<string, CacheEntry>();

/**
 * Get the derived metadata for `absolutePath` at the given `stat`, computing
 * and caching it on a miss. A cache HIT requires an exact match on both
 * `size` and `mtime` — either changing invalidates the entry, so an edited
 * file is never served stale metadata on the very next request.
 *
 * @param absolutePath - The file's resolved path (cache key).
 * @param stat - The freshly-taken stat result for this request.
 */
export function getCachedFileMetadata(absolutePath: string, stat: StatsLike): CachedFileMetadata {
  const mtimeMs = stat.mtime.getTime();
  const existing = cache.get(absolutePath);

  if (existing?.size === stat.size && existing.mtimeMs === mtimeMs) {
    // Re-insert to move this entry to the end (insertion-order = recency).
    cache.delete(absolutePath);
    cache.set(absolutePath, existing);
    return existing;
  }

  const entry: CacheEntry = {
    mimeType: getMimeType(absolutePath),
    etag: generateETag(stat),
    lastModifiedString: stat.mtime.toUTCString(),
    size: stat.size,
    mtimeMs,
  };

  cache.set(absolutePath, entry);
  if (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }

  return entry;
}

/**
 * Test-only reset so cache state from one test cannot leak into another.
 * @internal
 */
export function __resetMetadataCacheForTests(): void {
  cache.clear();
}
