/**
 * Incremental build cache using content hashing
 *
 * Tracks which files have been transformed and skips re-transformation
 * if the source hash matches and output exists. Invalidates on option changes.
 */

/**
 * Pure-JS content fingerprint (cyrb53-derived, hex) — deliberately NOT `node:crypto`, so
 * the bundle contains no static `node:*` import for the bundler to prefix-strip and thus
 * stays Deno-loadable (RFC-019, F-01). Cache keys need collision-resistance for a project's
 * file count, not cryptographic strength; a collision only causes a stale skip, and this
 * 64-bit fingerprint is far beyond any realistic collision for that use.
 */
export function hashString(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (n: number): string => (n >>> 0).toString(16).padStart(8, '0');
  return hex(h2) + hex(h1);
}

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
  return hashString(`${sourceContent}|${JSON.stringify(options)}`);
}

/**
 * Load cache from disk
 */
export async function loadCache(cacheFile: string): Promise<BuildCache | null> {
  try {
    const fs = await import(/* @vite-ignore */ 'node:fs/promises');
    const content = await fs.readFile(cacheFile, 'utf-8');
    return JSON.parse(content) as BuildCache;
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
  const suffix = `${String(Date.now())}.${Math.random().toString(36).slice(2, 10)}`;
  const tempPath = `${cacheFile}.${suffix}.tmp`;

  try {
    await fs.writeFile(tempPath, content, 'utf-8');
    await fs.rename(tempPath, cacheFile);
  } catch {
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
