/**
 * @nextrush/dev - Build Command
 *
 * Production build with SWC for decorator metadata emission.
 * Critical for DI systems that rely on emitDecoratorMetadata.
 *
 * @packageDocumentation
 */

import {
  detectRuntime,
  existsSync,
  getCwd,
  getRuntimeInfo,
  initFsSync,
  joinPath,
  resolvePath,
} from '../runtime/index.js';
import {
  NODE_CHILD_PROCESS,
  NODE_FS_PROMISES,
  NODE_PATH,
} from '../runtime/node-modules.js';
import { findEntry } from '../utils/config.js';
import {
  banner,
  error,
  formatDuration,
  formatSize,
  info,
  log,
  success,
  warn,
} from '../utils/logger.js';

/**
 * Build options
 */
export interface BuildOptions {
  /** Entry file path */
  entry?: string;
  /** Output directory */
  outDir?: string;
  /** Target ES version */
  target?: 'es2020' | 'es2021' | 'es2022' | 'esnext';
  /** Generate sourcemaps */
  sourcemap?: boolean;
  /** Minify output */
  minify?: boolean;
  /** Emit decorator metadata (required for DI) */
  decoratorMetadata?: boolean;
  /** Clean output directory before build */
  clean?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Build the application with SWC
 *
 * Uses SWC to compile TypeScript with decorator metadata emission,
 * which is required for dependency injection systems like tsyringe.
 *
 * @example
 * ```typescript
 * import { build } from '@nextrush/dev';
 *
 * // Simple usage
 * await build();
 *
 * // With options
 * await build('./src/index.ts', { outDir: 'dist', minify: true });
 * ```
 */
export async function build(
  entry?: string,
  options: BuildOptions = {},
): Promise<void> {
  // Initialize fs module for sync operations (required in ESM context)
  await initFsSync();

  const startTime = Date.now();
  const cwd = getCwd();
  const resolvedEntry = entry ?? options.entry ?? findEntry();
  const outDir = options.outDir ?? 'dist';
  const target = options.target ?? 'es2022';
  const sourcemap = options.sourcemap ?? true;
  const minify = options.minify ?? false;
  const decoratorMetadata = options.decoratorMetadata ?? true;
  const clean = options.clean ?? true;

  // Get runtime info
  const runtimeInfo = getRuntimeInfo();
  const runtime = detectRuntime();

  // Show banner
  banner('Build');
  info('Runtime', `${runtimeInfo.runtime} v${runtimeInfo.version}`);
  info('Entry', resolvedEntry);
  info('Output', outDir);
  info('Target', target);
  info('Decorator Metadata', decoratorMetadata ? 'enabled' : 'disabled');
  info('Sourcemap', sourcemap ? 'enabled' : 'disabled');
  info('Minify', minify ? 'enabled' : 'disabled');
  console.log();

  // Validate entry file exists
  const entryPath = resolvePath(cwd, resolvedEntry);
  if (!existsSync(entryPath)) {
    error(`Entry file not found: ${resolvedEntry}`);
    error(`Looked in: ${entryPath}`);
    process.exit(1);
  }

  // Check for tsconfig.json
  const tsconfigPath = joinPath(cwd, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) {
    warn('No tsconfig.json found, using default settings');
  }

  // Clean output directory if requested
  if (clean) {
    const outPath = resolvePath(cwd, outDir);
    if (existsSync(outPath)) {
      log(`Cleaning ${outDir}...`);
      await cleanDirectory(outPath);
    }
  }

  // Build based on runtime
  if (runtime === 'bun') {
    await buildWithBun(resolvedEntry, outDir, options);
  } else if (runtime === 'deno') {
    await buildWithDeno(resolvedEntry, outDir, options);
  } else {
    await buildWithSwc(resolvedEntry, outDir, options);
  }

  const duration = Date.now() - startTime;
  console.log();
  success(`Build completed in ${formatDuration(duration)}`);
}

/**
 * Build with SWC (Node.js)
 *
 * SWC is used because:
 * 1. It supports emitDecoratorMetadata (unlike esbuild)
 * 2. It's fast (written in Rust)
 * 3. It has full TypeScript support
 */
async function buildWithSwc(
  entry: string,
  outDir: string,
  options: BuildOptions,
): Promise<void> {
  log('Building with SWC...');

  try {
    // Import SWC dynamically
    const swc = await import('@swc/core');

    const cwd = getCwd();
    const target = options.target ?? 'es2022';
    const sourcemap = options.sourcemap ?? true;
    const minify = options.minify ?? false;
    const decoratorMetadata = options.decoratorMetadata ?? true;

    // Find all TypeScript files
    const files = await findTypeScriptFiles(cwd, entry);
    log(`Found ${files.length} TypeScript file(s)`);

    // Ensure output directory exists
    // Use constant variables to prevent bundler from stripping node: prefix
    const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
    const path = await import(/* @vite-ignore */ NODE_PATH);
    const outPath = resolvePath(cwd, outDir);
    await fs.mkdir(outPath, { recursive: true });

    // Get source directory from entry to strip from output paths
    const srcDir = path.dirname(resolvePath(cwd, entry));

    // Transform each file
    for (const file of files) {
      // Calculate relative path from source dir, not cwd
      // This ensures output goes to dist/index.js not dist/src/index.js
      const relativePath = path.relative(srcDir, file);
      const outFile = path
        .join(outPath, relativePath)
        .replace(/\.ts$/, '.js');

      // Ensure output directory exists
      await fs.mkdir(path.dirname(outFile), { recursive: true });

      // Read source
      const source = await fs.readFile(file, 'utf-8');

      // Transform with SWC
      const result = await swc.transform(source, {
        filename: file,
        jsc: {
          parser: {
            syntax: 'typescript',
            decorators: true,
          },
          target: target,
          transform: {
            legacyDecorator: true,
            decoratorMetadata: decoratorMetadata,
          },
          keepClassNames: true,
          minify: minify
            ? {
                compress: true,
                mangle: true,
              }
            : undefined,
        },
        module: {
          type: 'es6',
        },
        sourceMaps: sourcemap,
      });

      // Write output
      await fs.writeFile(outFile, result.code);

      // Write sourcemap
      if (sourcemap && result.map) {
        await fs.writeFile(`${outFile}.map`, result.map);
      }

      if (options.verbose) {
        const stats = await fs.stat(outFile);
        log(`  ${relativePath} → ${formatSize(stats.size)}`);
      }
    }

    // Generate declaration files with tsc
    await generateDeclarations(cwd, outDir);

    success(`Built ${files.length} file(s) to ${outDir}/`);
  } catch (err) {
    error(`Build failed: ${(err as Error).message}`);
    throw err;
  }
}

/**
 * Build with Bun
 *
 * Bun has native TypeScript and decorator support.
 */
async function buildWithBun(
  entry: string,
  outDir: string,
  options: BuildOptions,
): Promise<void> {
  log('Building with Bun...');

  try {
    // @ts-expect-error Bun global exists in Bun runtime
    const Bun = globalThis.Bun;

    const cwd = getCwd();
    const target = options.target ?? 'browser';
    const sourcemap = options.sourcemap ?? true;
    const minify = options.minify ?? false;

    const result = await Bun.build({
      entrypoints: [resolvePath(cwd, entry)],
      outdir: resolvePath(cwd, outDir),
      target: target === 'esnext' ? 'browser' : 'bun',
      sourcemap: sourcemap ? 'external' : 'none',
      minify: minify,
    });

    if (!result.success) {
      for (const log of result.logs) {
        error(log.message);
      }
      throw new Error('Build failed');
    }

    success(`Built to ${outDir}/`);
  } catch (err) {
    error(`Build failed: ${(err as Error).message}`);
    throw err;
  }
}

/**
 * Build with Deno
 *
 * Deno 2.0+ has native TypeScript support and npm compatibility.
 * Uses @swc/core through npm: specifier for consistent decorator metadata emission.
 */
async function buildWithDeno(
  entry: string,
  outDir: string,
  options: BuildOptions,
): Promise<void> {
  log('Building with Deno + SWC...');

  try {
    // @ts-expect-error Deno global exists in Deno runtime
    const Deno = globalThis.Deno;

    const cwd = getCwd();
    const target = options.target ?? 'es2022';
    const sourcemap = options.sourcemap ?? true;
    const minify = options.minify ?? false;
    const decoratorMetadata = options.decoratorMetadata ?? true;

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

    // Try to use @swc/core via npm: specifier
    // This provides consistent decorator metadata emission across all runtimes
    try {
      // Import SWC dynamically via npm: specifier
      // @ts-expect-error npm: specifier is Deno-specific
      const swc = await import('npm:@swc/core@1.11.1');

      info('Using', '@swc/core via npm: specifier');

      // Transform each file (same logic as Node.js build)
      for (const file of files) {
        const relativePath = path.relative(srcDir, file);
        const outFile = path
          .join(outPath, relativePath)
          .replace(/\.ts$/, '.js');

        // Ensure output directory exists
        await fs.mkdir(path.dirname(outFile), { recursive: true });

        // Read source
        const source = await fs.readFile(file, 'utf-8');

        // Transform with SWC
        const result = await swc.transform(source, {
          filename: file,
          jsc: {
            parser: {
              syntax: 'typescript',
              decorators: true,
            },
            target: target,
            transform: {
              legacyDecorator: true,
              decoratorMetadata: decoratorMetadata,
            },
            keepClassNames: true,
            minify: minify
              ? {
                  compress: true,
                  mangle: true,
                }
              : undefined,
          },
          module: {
            type: 'es6',
          },
          sourceMaps: sourcemap,
        });

        // Write output
        await fs.writeFile(outFile, result.code);

        // Write sourcemap
        if (sourcemap && result.map) {
          await fs.writeFile(`${outFile}.map`, result.map);
        }

        if (options.verbose) {
          const stats = await fs.stat(outFile);
          log(`  ${relativePath} → ${formatSize(stats.size)}`);
        }
      }

      success(`Built ${files.length} file(s) to ${outDir}/`);

      // Generate declaration files
      await generateDeclarationsWithDeno(cwd, outDir, Deno);

      return;
    } catch (swcError) {
      // SWC via npm: failed, fall back to native compilation
      warn(`SWC import failed: ${(swcError as Error).message}`);
      warn('Falling back to Deno native compilation...');
      await buildWithDenoNative(entry, outDir, options);
    }
  } catch (err) {
    error(`Deno build failed: ${(err as Error).message}`);
    throw err;
  }
}

/**
 * Generate TypeScript declarations using Deno
 */
async function generateDeclarationsWithDeno(
  cwd: string,
  outDir: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Deno: any,
): Promise<void> {
  log('Generating type declarations...');

  try {
    const command = new Deno.Command('npx', {
      args: ['tsc', '--declaration', '--emitDeclarationOnly', '--outDir', outDir],
      cwd,
      stderr: 'piped',
      stdout: 'piped',
    });

    const result = await command.output();

    if (result.code !== 0) {
      warn('Type declaration generation failed (non-critical)');
    }
  } catch {
    warn('Could not generate type declarations');
  }
}

/**
 * Build with Deno native TypeScript compilation
 *
 * Note: This method does NOT emit decorator metadata.
 * Use only when SWC is unavailable or for non-DI projects.
 */
async function buildWithDenoNative(
  entry: string,
  outDir: string,
  _options: BuildOptions,
): Promise<void> {
  warn('Deno native build does NOT emit decorator metadata');
  warn('DI systems may not work correctly. Consider using Node.js or Bun for production builds.');

  try {
    // @ts-expect-error Deno global exists in Deno runtime
    const Deno = globalThis.Deno;

    const cwd = getCwd();
    const entryPath = resolvePath(cwd, entry);
    const outPath = resolvePath(cwd, outDir);

    // Ensure output directory exists
    await Deno.mkdir(outPath, { recursive: true });

    // Since Deno runs TypeScript natively, and proper decorator metadata
    // emission requires SWC/tsc, we have two options:
    // 1. Copy TS files directly (Deno can run them)
    // 2. Use esbuild/swc through npm compatibility

    // For now, copy TypeScript files - Deno can run them directly
    // This is the most reliable approach for Deno 2.x
    warn('Copying TypeScript source directly (Deno runs TS natively)');

    const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
    const path = await import(/* @vite-ignore */ NODE_PATH);

    const srcDir = path.dirname(entryPath);
    const files = await findTypeScriptFiles(cwd, entry);

    for (const file of files) {
      const relativePath = path.relative(srcDir, file);
      const outFile = path.join(outPath, relativePath);
      await fs.mkdir(path.dirname(outFile), { recursive: true });
      await fs.copyFile(file, outFile);
    }

    success(`Copied ${files.length} TypeScript file(s) to ${outDir}/`);
    log('Run with: deno run -A dist/index.ts');
  } catch (err) {
    error(`Deno build failed: ${(err as Error).message}`);
    throw err;
  }
}

/**
 * Find all TypeScript files from entry point
 */
async function findTypeScriptFiles(
  cwd: string,
  entry: string,
): Promise<string[]> {
  const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
  const path = await import(/* @vite-ignore */ NODE_PATH);

  const files: string[] = [];
  const srcDir = path.dirname(resolvePath(cwd, entry));

  async function scanDir(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scanDir(fullPath);
        }
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.d.ts') &&
        !entry.name.endsWith('.test.ts') &&
        !entry.name.endsWith('.spec.ts')
      ) {
        files.push(fullPath);
      }
    }
  }

  await scanDir(srcDir);
  return files;
}

/**
 * Generate TypeScript declaration files
 */
async function generateDeclarations(
  cwd: string,
  outDir: string,
): Promise<void> {
  log('Generating type declarations...');

  try {
    const { spawn: nodeSpawn } = await import(
      /* @vite-ignore */ NODE_CHILD_PROCESS
    );

    await new Promise<void>((resolve) => {
      const tsc = nodeSpawn(
        'npx',
        ['tsc', '--declaration', '--emitDeclarationOnly', '--outDir', outDir],
        {
          cwd,
          stdio: 'pipe',
        },
      );

      tsc.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          // Don't fail if tsc fails, just warn
          warn('Type declaration generation failed (non-critical)');
          resolve();
        }
      });

      tsc.on('error', () => {
        warn('Could not run tsc for declaration generation');
        resolve();
      });
    });
  } catch {
    warn('Could not generate type declarations');
  }
}

/**
 * Clean a directory
 */
async function cleanDirectory(dir: string): Promise<void> {
  try {
    const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore errors
  }
}

/**
 * CLI entry point for build command
 */
export function buildCli(args: string[]): void {
  const options: BuildOptions = {};
  let entry: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';

    switch (arg) {
      case '--outDir':
      case '-o': {
        const outArg = args[++i];
        if (outArg) options.outDir = outArg;
        break;
      }
      case '--target':
      case '-t': {
        const targetArg = args[++i];
        if (targetArg) {
          options.target = targetArg as BuildOptions['target'];
        }
        break;
      }
      case '--sourcemap': {
        options.sourcemap = true;
        break;
      }
      case '--no-sourcemap': {
        options.sourcemap = false;
        break;
      }
      case '--minify':
      case '-m': {
        options.minify = true;
        break;
      }
      case '--no-decorator-metadata': {
        options.decoratorMetadata = false;
        break;
      }
      case '--no-clean': {
        options.clean = false;
        break;
      }
      case '--verbose':
      case '-v': {
        options.verbose = true;
        break;
      }
      default: {
        if (!arg.startsWith('-')) {
          entry = arg;
        }
        break;
      }
    }
  }

  // Run build
  build(entry, options).catch((err) => {
    error(`Build failed: ${err.message}`);
    process.exit(1);
  });
}

/**
 * Print build command help
 */
export function buildHelp(): void {
  console.log(`
\x1b[36m⚡ NextRush Build\x1b[0m

Usage: nextrush build [entry] [options]

Options:
  --outDir, -o <dir>        Output directory (default: dist)
  --target, -t <target>     Target ES version (es2020, es2021, es2022, esnext)
  --sourcemap               Generate sourcemaps (default: true)
  --no-sourcemap            Disable sourcemaps
  --minify, -m              Minify output
  --no-decorator-metadata   Disable decorator metadata emission
  --no-clean                Don't clean output directory
  --verbose, -v             Verbose output

Examples:
  nextrush build
  nextrush build ./src/index.ts
  nextrush build --outDir dist --minify
  nextrush build --target esnext --no-sourcemap

Note:
  This command uses SWC to compile TypeScript with decorator metadata
  emission, which is required for dependency injection systems like
  @nextrush/di (which uses tsyringe).

  Standard bundlers like esbuild and tsup do NOT emit decorator metadata,
  causing DI to fail at runtime. Always use 'nextrush build' for production
  builds when using decorators.
`);
}
