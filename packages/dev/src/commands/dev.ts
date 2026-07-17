/* eslint-disable nextrush/no-runtime-identity-capability -- dev CLI runtime-specific dev-server spawn; platform optimization */
/**
 * @nextrush/dev - Dev Command
 *
 * Development server with auto-restart on file change.
 * Works across Node.js, Bun, and Deno.
 *
 * @packageDocumentation
 */

import {
    buildDevArgs,
    detectRuntime,
    existsSync,
    exitProcess,
    getCwd,
    getRuntimeInfo,
    initFsSync,
    onSignal,
    resolvePath,
    spawn,
    type SpawnResult,
    validateDenoPermissions,
} from '../runtime/index.js';
import { findEntry, getDefaultWatchPaths, loadConfig, validateDecoratorConfig } from '../utils/config.js';
import { banner, clear, error, info, log, warn } from '../utils/logger.js';
import { detectProjectRuntime } from './dev-helpers.js';

/**
 * Development server options
 */
export interface DevOptions {
  /** Entry file path */
  entry?: string;
  /** Server port */
  port?: number;
  /** Enable Node.js inspector */
  inspect?: boolean;
  /** Inspector port */
  inspectPort?: number;
  /** Environment variables to set */
  env?: Record<string, string>;
  /** Clear screen on start */
  clearScreen?: boolean;
  /** Additional paths to watch */
  watch?: string[];
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Start the development server
 *
 * @example
 * ```typescript
 * import { dev } from '@nextrush/dev';
 *
 * // Simple usage
 * dev();
 *
 * // With options
 * dev('./src/app.ts', { port: 4000 });
 * ```
 */
export async function dev(entry?: string, options: DevOptions = {}): Promise<SpawnResult> {
  // Initialize fs module for sync operations (required in ESM context)
  await initFsSync();

  const resolvedEntry = entry ?? options.entry ?? findEntry();
  // Respect PORT env var if options.port is not explicitly set.
  const port =
    options.port !== undefined
      ? options.port
      : parseInt(process.env.PORT ?? '8080', 10) || 8080;
  const cwd = getCwd();

  // Clear screen unless disabled
  if (options.clearScreen !== false) {
    clear();
  }

  // Get runtime info for banner (CLI process runtime)
  const runtimeInfo = getRuntimeInfo();
  const cliRuntime = detectRuntime();

  // Detect project's target runtime from adapter dependency
  const targetRuntime = detectProjectRuntime();

  // Show banner
  banner('Dev Server');
  info('Runtime', `${runtimeInfo.runtime} v${runtimeInfo.version}`);
  info('Entry', resolvedEntry);
  info('Port', String(port));
  info('Local', `http://127.0.0.1:${String(port)}`);

  // Warn if CLI runtime differs from project target runtime
  if (cliRuntime !== targetRuntime) {
    log(`ℹ Target runtime: ${targetRuntime} (detected from project adapter)`);
  }

  // Validate entry file exists
  const entryPath = resolvePath(cwd, resolvedEntry);
  if (!existsSync(entryPath)) {
    error(`Entry file not found: ${resolvedEntry}`);
    error(`Looked in: ${entryPath}`);
    error('Hint: Create the file or set "main" in package.json to your entry point.');
    exitProcess(1);
  }

  // Build watch paths
  const watchPaths = options.watch ?? getDefaultWatchPaths();

  // Determine what we're watching
  let watchDisplay = '';
  if (watchPaths.length > 0 && watchPaths[0] !== '.') {
    watchDisplay = watchPaths.join(', ');
  } else if (targetRuntime === 'bun') {
    watchDisplay = 'imported files (auto)';
  } else {
    watchDisplay = watchPaths.length > 0 ? watchPaths.join(', ') : 'imported files (auto)';
  }
  info('Watching', watchDisplay);

  // Show runtime-specific info
  if (runtimeInfo.needsSwc) {
    log('Using SWC for TypeScript + decorator metadata support');

    // Validate decorator config — warn early if metadata won't be emitted
    const decoratorWarnings = validateDecoratorConfig();
    for (const w of decoratorWarnings) {
      error(w);
    }
  } else {
    log(`${runtimeInfo.runtime} has native TypeScript support`);
  }

  log(''); // Blank line

  // Build command arguments based on target runtime
  const warnUnsupported = targetRuntime === 'bun' && watchPaths.length > 0 ? () => {
    warn('Custom watch paths are not supported in Bun. Bun will watch all imported files instead.');
  } : undefined;

  // Load project config for extra Deno permissions (dev-deno-permissions spec, D1: extend
  // the default set, never replace it). Validate fail-fast before ever spawning Deno.
  const config = await loadConfig();
  const denoPermissions = config.dev?.deno?.permissions;
  if (denoPermissions && denoPermissions.length > 0) {
    try {
      validateDenoPermissions(denoPermissions);
    } catch (err) {
      error((err as Error).message);
      exitProcess(1);
    }
  }

  const { command, args } = buildDevArgs(
    targetRuntime,
    resolvedEntry,
    watchPaths,
    options.inspect,
    options.inspectPort,
    denoPermissions,
    warnUnsupported
  );

  // Prepare environment
  const env: Record<string, string> = {
    PORT: String(port),
    NODE_ENV: 'development',
    ...options.env,
  };

  // Spawn the process
  const child = await spawn(command, args, {
    cwd,
    env,
    stdio: 'inherit',
  });

  // Handle errors
  child.onError((err) => {
    error(`Process error: ${err.message}`);
  });

  // Handle process signals
  const cleanup = () => {
    child.kill('SIGTERM');
    exitProcess(0);
  };

  onSignal('SIGINT', cleanup);
  onSignal('SIGTERM', cleanup);

  return child;
}
