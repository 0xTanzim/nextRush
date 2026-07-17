/**
 * SWC-based build with decorator metadata emission
 *
 * Features:
 * - TypeScript (.ts, .tsx, .mts, .cts) and JSX support
 * - Atomic file writes (temp + rename)
 * - Incremental build cache with content hashing
 * - Bounded concurrency pool for transforms
 * - Deterministic local TypeScript compilation
 */

import { createHash } from 'node:crypto';
import { getCwd, resolvePath, existsSync } from '../../runtime/index.js';
import { NODE_CHILD_PROCESS, NODE_FS_PROMISES, NODE_PATH, NODE_MODULE } from '../../runtime/node-modules.js';
import { error, log, success, formatSize } from '../../utils/logger.js';
import type { BuildOptions } from './types.js';
import { findTypeScriptFiles, mapExtension, type TypeScriptFile } from './file-scanner.js';
import { writeFileAtomic } from './atomic-write.js';
import { loadCache, saveCache, createEmptyCache, isCached, updateCacheEntry, hashSourceAndOptions } from './cache.js';
import { runConcurrent } from './concurrency.js';

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
    log(`Found ${files.length} TypeScript file(s)`);

    // Ensure output directory exists
    const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
    const path = await import(/* @vite-ignore */ NODE_PATH);
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

    const cacheFile = path.join(outPath, '.nextrush', 'build-cache.json');
    let cache = useCache ? await loadCache(cacheFile) : null;

    // Invalidate cache if options changed
    if (cache && cache.optionsHash !== optionsHash) {
      if (verbose) log('Cache invalidated (options changed)');
      cache = null;
    }

    if (!cache) {
      cache = createEmptyCache(optionsHash);
    }

    // Build transform tasks with caching
    let skipped = 0;
    const transformTasks = files.map((file) => async () => {
      // Check cache
      if (useCache) {
        const sourceContent = await fs.readFile(file.path, 'utf-8');
        const sourceHash = createHash('sha256').update(sourceContent).digest('hex');
        const relativePath = path.relative(srcDir, file.path);
        const outFile = path.join(outPath, relativePath).replace(/\.\w+$/, mapExtension(file.ext));

        if (isCached(cache!, file.path, sourceHash, optionsHash) && existsSync(outFile)) {
          skipped++;
          if (verbose) log(`  ${relativePath} (cached)`);
          return;
        }

        // Not cached — transform
        await transformFile(swc, fs, path, srcDir, outPath, file, sourceContent, options);

        // Update cache
        updateCacheEntry(cache!, file.path, sourceHash, true);
        return;
      }

      // No cache — always transform
      const sourceContent = await fs.readFile(file.path, 'utf-8');
      await transformFile(swc, fs, path, srcDir, outPath, file, sourceContent, options);
    });

    // Execute transforms with bounded concurrency
    await runConcurrent(transformTasks, { concurrency: 4 });

    if (useCache) {
      // Save cache
      await fs.mkdir(path.dirname(cacheFile), { recursive: true });
      await saveCache(cacheFile, cache!);
    }

    // Generate declaration files with local tsc (if enabled)
    if (decoratorMetadata !== false) {
      await generateDeclarations(cwd, outDir, options.dts ?? true);
    }

    const message = skipped > 0 ? `${files.length} file(s) (${skipped} cached)` : `${files.length} file(s)`;
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

  // Transform with SWC
  const result = await swc.transform(sourceContent, {
    filename: file.path,
    jsc: {
      parser: {
        syntax: 'typescript',
        tsx: isTsx,
        decorators: true,
      },
      target: options.target,
      transform: {
        legacyDecorator: true,
        decoratorMetadata: options.decoratorMetadata,
      },
      keepClassNames: true,
      minify: options.minify
        ? {
            compress: true,
            mangle: true,
          }
        : undefined,
    },
    module: {
      type: 'es6',
    },
    sourceMaps: options.sourcemap,
  });

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

/**
 * Generate TypeScript declarations using local tsc
 *
 * Resolves the locally installed typescript package deterministically,
 * avoiding npx (which requires network/downloads) and Windows fragility.
 */
export async function generateDeclarations(cwd: string, outDir: string, enabled: boolean = true): Promise<void> {
  if (!enabled) {
    log('Skipping type declarations (--no-dts)');
    return;
  }

  log('Generating type declarations...');

  try {
    // Resolve TypeScript location using createRequire
    const nodeModule = await import(/* @vite-ignore */ NODE_MODULE);
    const requireFromThis = nodeModule.createRequire(import.meta.url);

    let tscPath: string;
    try {
      // Resolve typescript package.json to find its bin/tsc
      const tsPkgPath = requireFromThis.resolve('typescript/package.json');

      // Read package.json using dynamic import from node:fs/promises
      const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
      const path = await import(/* @vite-ignore */ NODE_PATH);

      const tsPkgContent = await fs.readFile(tsPkgPath, 'utf-8');
      const tsPkg = JSON.parse(tsPkgContent) as { bin?: { tsc?: string } };

      if (!tsPkg.bin?.tsc) {
        throw new Error('TypeScript bin/tsc not found in package.json');
      }

      tscPath = path.resolve(path.dirname(tsPkgPath), tsPkg.bin.tsc);
    } catch (err) {
      throw new Error(
        `Cannot find local TypeScript compiler. Please install TypeScript: npm install --save-dev typescript\n` +
        `Original error: ${(err as Error).message}`
      );
    }

    // Run tsc via node:child_process
    const { spawn: nodeSpawn } = await import(/* @vite-ignore */ NODE_CHILD_PROCESS);

    await new Promise<void>((resolve, reject) => {
      // Run via process.execPath (node binary) to avoid relying on PATH
      const tsc = nodeSpawn(process.execPath, [tscPath, '--declaration', '--emitDeclarationOnly', '--outDir', outDir], {
        cwd,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      tsc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      tsc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      tsc.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `Type declaration generation failed (code ${code})\n` +
              (stderr || stdout || 'No output from tsc')
            )
          );
        }
      });

      tsc.on('error', (err: Error) => {
        reject(new Error(`Failed to spawn tsc: ${err.message}`));
      });
    });

    success('Type declarations generated');
  } catch (err) {
    error(`Declaration generation failed: ${(err as Error).message}`);
    throw err;
  }
}
