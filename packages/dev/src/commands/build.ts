/* eslint-disable nextrush/no-runtime-identity-capability -- dev CLI selects runtime-specific build/bundling; platform optimization, not a request-path capability decision */
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
  exitProcess,
  getCwd,
  getRuntimeInfo,
  initFsSync,
  joinPath,
  resolvePath,
} from '../runtime/index.js';
import { findEntry, validateDecoratorConfig } from '../utils/config.js';
import { banner, error, formatDuration, info, log, newline, success, warn } from '../utils/logger.js';
import {
  cleanDirectory,
  buildWithSwc,
  buildWithBun,
  buildWithDeno,
  parseBuildTarget,
  resolveBuildOptions,
  type BuildOptions,
} from './build/index.js';

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
export type { BuildOptions };
export async function build(entry?: string, options: BuildOptions = {}): Promise<void> {
  // Initialize fs module for sync operations (required in ESM context)
  await initFsSync();

  const startTime = Date.now();
  const cwd = getCwd();
  const entryOrConfig = entry ?? options.entry;
  const resolvedEntry = entryOrConfig || findEntry();

  // Get runtime info
  const runtimeInfo = getRuntimeInfo();
  const runtime = detectRuntime();

  // Show banner
  banner('Build');
  info('Runtime', `${runtimeInfo.runtime} v${runtimeInfo.version}`);
  info('Entry', resolvedEntry);

  // Resolve remaining options after entry is known
  const resolved = resolveBuildOptions(options);

  info('Output', resolved.outDir);
  info('Target', resolved.target);
  info('Decorator Metadata', resolved.decoratorMetadata ? 'enabled' : 'disabled');
  info('Sourcemap', resolved.sourcemap ? 'enabled' : 'disabled');
  info('Minify', resolved.minify ? 'enabled' : 'disabled');
  newline();

  // Validate entry file exists
  const entryPath = resolvePath(cwd, resolvedEntry);
  if (!existsSync(entryPath)) {
    error(`Entry file not found: ${resolvedEntry}`);
    error(`Looked in: ${entryPath}`);
    error('Hint: Create the file or set "main" in package.json to your entry point.');
    exitProcess(1);
  }

  // Check for tsconfig.json
  const tsconfigPath = joinPath(cwd, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) {
    warn('No tsconfig.json found, using default settings');
  }

  // Fail fast on a decorator-metadata toolchain misconfiguration (mismatched
  // experimentalDecorators/emitDecoratorMetadata) — a broken build should not
  // ship silently, unlike `nextrush dev`'s warn-and-continue path.
  try {
    validateDecoratorConfig({ throwOnMismatch: true });
  } catch (err) {
    for (const line of (err as Error).message.split('\n')) {
      error(line);
    }
    exitProcess(1);
  }

  // Clean output directory if requested
  if (resolved.clean) {
    const outPath = resolvePath(cwd, resolved.outDir);
    if (existsSync(outPath)) {
      log(`Cleaning ${resolved.outDir}...`);
      await cleanDirectory(outPath);
    }
  }

  // Build based on runtime
  if (runtime === 'bun') {
    await buildWithBun(resolvedEntry, resolved.outDir, resolved);
  } else if (runtime === 'deno') {
    await buildWithDeno(resolvedEntry, resolved.outDir, resolved);
  } else {
    await buildWithSwc(resolvedEntry, resolved.outDir, resolved);
  }

  const duration = Date.now() - startTime;
  newline();
  success(`Build completed in ${formatDuration(duration)}`);
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
        options.target = parseBuildTarget(targetArg);
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
      case '--dts': {
        options.dts = true;
        break;
      }
      case '--no-dts': {
        options.dts = false;
        break;
      }
      case '--cache': {
        options.cache = true;
        break;
      }
      case '--no-cache': {
        options.cache = false;
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
      case '--help':
      case '-h': {
        buildHelp();
        exitProcess(0);
      }
      default: {
        if (arg.startsWith('--') || arg.startsWith('-')) {
          // Handle --flag=value syntax
          if (arg.includes('=')) {
            const eqIndex = arg.indexOf('=');
            const flagPart = arg.substring(0, eqIndex);
            const valuePart = arg.substring(eqIndex + 1);
            switch (flagPart) {
              case '--outDir':
              case '-o': {
                options.outDir = valuePart;
                break;
              }
              case '--target':
              case '-t': {
                options.target = parseBuildTarget(valuePart);
                break;
              }
              default: {
                error(`Unknown flag: ${arg}`);
                error('Run "nextrush build --help" for available options.');
                exitProcess(1);
              }
            }
          } else {
            // Unknown flag without value
            error(`Unknown flag: ${arg}`);
            error('Run "nextrush build --help" for available options.');
            exitProcess(1);
          }
        } else {
          entry = arg;
        }
        break;
      }
    }
  }

  // Run build
  build(entry, options).catch((err) => {
    error(`Build failed: ${err.message}`);
    exitProcess(1);
  });
}

/**
 * Print build command help
 */
export function buildHelp(): void {
  log(`
\x1b[36m⚡ NextRush Build\x1b[0m

Usage: nextrush build [entry] [options]

Options:
  --outDir, -o <dir>        Output directory (default: dist)
  --target, -t <target>     Target ES version (es2020, es2021, es2022, esnext)
  --sourcemap               Generate sourcemaps (default: true)
  --no-sourcemap            Disable sourcemaps
  --minify, -m              Minify output
  --no-decorator-metadata   Disable decorator metadata emission
  --dts                     Generate .d.ts files (default: true)
  --no-dts                  Disable .d.ts generation
  --cache                   Use incremental build cache (default: true)
  --no-cache                Disable build cache
  --no-clean                Don't clean output directory
  --verbose, -v             Verbose output

Examples:
  nextrush build
  nextrush build ./src/index.ts
  nextrush build --outDir dist --minify
  nextrush build --target esnext --no-sourcemap
  nextrush build --no-dts
  nextrush build --no-cache

Note:
  This command uses SWC to compile TypeScript with decorator metadata
  emission, which is required for dependency injection systems like
  @nextrush/di (which uses tsyringe).

  Standard bundlers like esbuild and tsup do NOT emit decorator metadata,
  causing DI to fail at runtime. Always use 'nextrush build' for production
  builds when using decorators.
`);
}
