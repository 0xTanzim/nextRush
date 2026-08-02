/**
 * SWC-based build with decorator metadata emission
 *
 * Features:
 * - TypeScript (.ts, .tsx, .mts, .cts) and JSX support
 * - Atomic file writes (temp + rename)
 * - Incremental build cache with content hashing (stored OUTSIDE outDir so it
 *   survives `--clean` — RFC-019 D5, F-02)
 * - CPU-scaled bounded concurrency pool for transforms (RFC-019, F-16)
 * - Deterministic local TypeScript declaration emit, gated on `dts` only (F-03)
 */

import { getCwd, resolvePath, existsSync } from '../../runtime/index.js';
import { getNodeFsPromises, getNodeOs, getNodePath } from '../../runtime/node-modules.js';
import { error, log, success, formatSize } from '../../utils/logger.js';
import type { BuildOptions } from './types.js';
import { findTypeScriptFiles, mapExtension, type TypeScriptFile } from './file-scanner.js';
import { generateDeclarations } from './declaration-builder.js';
import { writeFileAtomic } from './atomic-write.js';
import { loadCache, saveCache, createEmptyCache, isCached, updateCacheEntry, hashSourceAndOptions, hashString } from './cache.js';
import { runConcurrent } from './concurrency.js';
import { buildSwcTransformOptions } from './swc-transform-options.js';

/** Hard cap on parallel transforms — high enough to use a dev box, low enough to bound memory. */
const MAX_BUILD_CONCURRENCY = 8;

/** Derive transform concurrency from the host's available parallelism, capped (F-16). */
async function resolveConcurrency(): Promise<number> {
  try {
    const os = await getNodeOs();
    const cores = os.availableParallelism();
    return Math.max(1, Math.min(cores, MAX_BUILD_CONCURRENCY));
  } catch {
    return 4;
  }
}

export async function buildWithSwc(entry: string, outDir: string, options: BuildOptions): Promise<void> {
  log('Building with SWC...');

  try {
    // Import SWC dynamically
    const swc = await import('@swc/core');

    const cwd = getCwd();
    const target = options.target ?? 'es2022';
    const sourcemap = options.sourcemap ?? true;
    const minify = options.minify ?? false;
    const decoratorMetadata = options.decoratorMetadata ?? true;
    const useCache = options.cache ?? true;
    const verbose = options.verbose ?? false;

    // Find all TypeScript files
    const files = await findTypeScriptFiles(cwd, entry);
    log(`Found ${String(files.length)} TypeScript file(s)`);

    // Ensure output directory exists
    const fs = await getNodeFsPromises();
    const path = await getNodePath();
    const outPath = resolvePath(cwd, outDir);
    await fs.mkdir(outPath, { recursive: true });

    // Get source directory from entry to strip from output paths
    const srcDir = path.dirname(resolvePath(cwd, entry));

    // Prepare cache
    const optionsHash = hashSourceAndOptions('', {
      target,
      decoratorMetadata,
      sourcemap,
      minify,
    });

    // Cache lives OUTSIDE outDir so `--clean` (which wipes outDir) and `--cache` are
    // orthogonal — otherwise the cache is destroyed before every build (RFC-019 D5, F-02).
    const cacheFile = path.join(cwd, 'node_modules', '.cache', 'nextrush', 'build-cache.json');
    let cache = useCache ? await loadCache(cacheFile) : null;

    // Invalidate cache if options changed
    if (cache && cache.optionsHash !== optionsHash) {
      if (verbose) log('Cache invalidated (options changed)');
      cache = null;
    }

    cache ??= createEmptyCache(optionsHash);
    // Bound to a new `const` so the type is a definite `BuildCache` (not `BuildCache |
    // null`) inside the `files.map(...)` closure below — TS cannot narrow a `let`
    // across a closure boundary, which would otherwise require non-null assertions.
    const resolvedCache = cache;

    // Build transform tasks with caching
    let skipped = 0;
    const transformTasks = files.map((file) => async () => {
      // Check cache
      if (useCache) {
        const sourceContent = await fs.readFile(file.path, 'utf-8');
        const sourceHash = hashString(sourceContent);
        const relativePath = path.relative(srcDir, file.path);
        const outFile = path.join(outPath, relativePath).replace(/\.\w+$/, mapExtension(file.ext));

        if (isCached(resolvedCache, file.path, sourceHash, optionsHash) && existsSync(outFile)) {
          skipped++;
          if (verbose) log(`  ${relativePath} (cached)`);
          return;
        }

        // Not cached — transform
        await transformFile(swc, fs, path, srcDir, outPath, file, sourceContent, options);

        // Update cache
        updateCacheEntry(resolvedCache, file.path, sourceHash, true);
        return;
      }

      // No cache — always transform
      const sourceContent = await fs.readFile(file.path, 'utf-8');
      await transformFile(swc, fs, path, srcDir, outPath, file, sourceContent, options);
    });

    // Execute transforms with CPU-scaled bounded concurrency
    const concurrency = await resolveConcurrency();
    await runConcurrent(transformTasks, { concurrency });

    if (useCache) {
      // Save cache
      await fs.mkdir(path.dirname(cacheFile), { recursive: true });
      await saveCache(cacheFile, resolvedCache);
    }

    // Generate declaration files with local tsc. Gated on `dts` ONLY — independent of
    // decorator metadata, so `--no-decorator-metadata` still emits .d.ts (F-03).
    if (options.dts ?? true) {
      await generateDeclarations(cwd, outDir, srcDir, files);
    }

    const message =
      skipped > 0
        ? `${String(files.length)} file(s) (${String(skipped)} cached)`
        : `${String(files.length)} file(s)`;
    success(`Built ${message} to ${outDir}/`);
  } catch (err) {
    error(`Build failed: ${(err as Error).message}`);
    throw err;
  }
}

/**
 * Transform a single TypeScript file
 */
async function transformFile(
  swc: typeof import('@swc/core'),
  fs: typeof import('node:fs/promises'),
  path: typeof import('node:path'),
  srcDir: string,
  outPath: string,
  file: TypeScriptFile,
  sourceContent: string,
  options: BuildOptions
): Promise<void> {
  const relativePath = path.relative(srcDir, file.path);
  const outExt = mapExtension(file.ext);
  const outFile = path.join(outPath, relativePath).replace(/\.\w+$/, outExt);

  // Ensure output directory exists
  await fs.mkdir(path.dirname(outFile), { recursive: true });

  // Determine if this is a JSX/TSX file
  const isTsx = file.ext === '.tsx';

  // Transform with SWC — options come from the shared helper (task 3.2) so this path
  // and deno-builder.ts's cannot silently diverge again.
  const result = await swc.transform(
    sourceContent,
    buildSwcTransformOptions(file.path, isTsx, options)
  );

  // Write output atomically
  await writeFileAtomic(outFile, result.code);

  // Write sourcemap atomically
  if (options.sourcemap && result.map) {
    await writeFileAtomic(`${outFile}.map`, result.map);
  }

  if (options.verbose) {
    const stats = await fs.stat(outFile);
    log(`  ${relativePath} → ${formatSize(stats.size)}`);
  }
}
