/**
 * Incremental build cache using content hashing
 *
 * Tracks which files have been transformed and skips re-transformation
 * if the source hash matches and output exists. Invalidates on option changes.
 */

import { createHash } from 'node:crypto';

export interface CacheEntry {
  sourceHash: string;
  outputExists: boolean;
  timestamp: number;
}

export interface BuildCache {
  version: 1;
  optionsHash: string;
  entries: Record<string, CacheEntry>;
}

/**
 * Hash source content + relevant build options
 */
export function hashSourceAndOptions(
  sourceContent: string,
  options: { target: string; decoratorMetadata: boolean; sourcemap: boolean; minify: boolean }
): string {
  const data = `${sourceContent}|${JSON.stringify(options)}`;
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Load cache from disk
 */
export async function loadCache(cacheFile: string): Promise<BuildCache | null> {
  try {
    const fs = await import(/* @vite-ignore */ 'node:fs/promises');
    const content = await fs.readFile(cacheFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Save cache to disk atomically
 */
export async function saveCache(cacheFile: string, cache: BuildCache): Promise<void> {
  const fs = await import(/* @vite-ignore */ 'node:fs/promises');
  const content = JSON.stringify(cache, null, 2);

  // Write atomically: temp file + rename
  const suffix = `${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;
  const tempPath = `${cacheFile}.${suffix}.tmp`;

  try {
    await fs.writeFile(tempPath, content, 'utf-8');
    await fs.rename(tempPath, cacheFile);
  } catch (err) {
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore
    }
    // Non-critical: cache write failures don't fail the build
  }
}

/**
 * Check if a file is cached and valid
 */
export function isCached(
  cache: BuildCache,
  filePath: string,
  sourceHash: string,
  optionsHash: string
): boolean {
  // Options changed — invalidate all entries
  if (cache.optionsHash !== optionsHash) {
    return false;
  }

  const entry = cache.entries[filePath];
  if (!entry) {
    return false;
  }

  // Source hash changed
  if (entry.sourceHash !== sourceHash) {
    return false;
  }

  // Output file was deleted
  if (!entry.outputExists) {
    return false;
  }

  return true;
}

/**
 * Update cache entry after successful transform
 */
export function updateCacheEntry(
  cache: BuildCache,
  filePath: string,
  sourceHash: string,
  outputExists: boolean
): void {
  cache.entries[filePath] = {
    sourceHash,
    outputExists,
    timestamp: Date.now(),
  };
}

/**
 * Create empty cache for new build
 */
export function createEmptyCache(optionsHash: string): BuildCache {
  return {
    version: 1,
    optionsHash,
    entries: {},
  };
}
