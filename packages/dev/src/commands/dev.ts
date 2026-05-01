/**
 * @nextrush/dev - Dev Command
 *
 * Development server with hot reload support.
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
    getEnv,
    getRuntimeInfo,
    initFsSync,
    onSignal,
    resolvePath,
    spawn,
    type SpawnResult,
} from '../runtime/index.js';
import { findEntry, getDefaultWatchPaths, validateDecoratorConfig } from '../utils/config.js';
import { banner, clear, error, info, log } from '../utils/logger.js';

function parsePositiveInteger(value: string | undefined, flag: string): number {
  const parsed = Number(value);

  if (!value || !Number.isInteger(parsed) || parsed <= 0) {
    error(`${flag} expects a positive integer.`);
    exitProcess(1);
  }

  return parsed;
}

function resolveDevPort(explicitPort: number | undefined): number {
  if (explicitPort !== undefined) {
    return explicitPort;
  }

  const envPort = getEnv('PORT');
  if (!envPort) {
    return 3000;
  }

  const parsed = Number(envPort);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 3000;
}

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
  const port = resolveDevPort(options.port);
  const cwd = getCwd();

  // Clear screen unless disabled
  if (options.clearScreen !== false) {
    clear();
  }

  // Get runtime info
  const runtimeInfo = getRuntimeInfo();
  const runtime = detectRuntime();

  // Show banner
  banner('Dev Server');
  info('Runtime', `${runtimeInfo.runtime} v${runtimeInfo.version}`);
  info('Entry', resolvedEntry);
  info('Port', String(port));

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
  info('Watching', watchPaths.join(', '));

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

  // Build command arguments based on runtime
  const { command, args } = buildDevArgs(
    runtime,
    resolvedEntry,
    watchPaths,
    options.inspect,
    options.inspectPort
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

/**
 * CLI entry point for dev command
 */
export function devCli(args: string[]): void {
  const options: DevOptions = {};
  let entry: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';

    switch (arg) {
      case '--port':
      case '-p': {
        const portArg = args[++i];
        options.port = parsePositiveInteger(portArg, '--port');
        break;
      }
      case '--inspect': {
        options.inspect = true;
        break;
      }
      case '--inspect-port': {
        const inspectArg = args[++i];
        options.inspectPort = parsePositiveInteger(inspectArg, '--inspect-port');
        break;
      }
      case '--watch':
      case '-w': {
        const watchArg = args[++i];
        if (watchArg) {
          options.watch ??= [];
          options.watch.push(watchArg);
        }
        break;
      }
      case '--no-clear': {
        options.clearScreen = false;
        break;
      }
      case '--verbose':
      case '-v': {
        options.verbose = true;
        break;
      }
      case '--help':
      case '-h': {
        devHelp();
        exitProcess(0);
      }
      default: {
        if (!arg.startsWith('-')) {
          entry = arg;
        }
        break;
      }
    }
  }

  // Run dev server
  dev(entry, options).catch((err) => {
    error(`Failed to start dev server: ${err.message}`);
    exitProcess(1);
  });
}

/**
 * Print dev command help
 */
export function devHelp(): void {
  log(`
\x1b[36m⚡ NextRush Dev Server\x1b[0m

Usage: nextrush dev [entry] [options]

Options:
  --port, -p <port>    Port number (default: 3000)
  --watch, -w <path>   Additional path to watch (can be used multiple times)
  --inspect            Enable Node.js inspector
  --inspect-port       Inspector port (default: 9229)
  --no-clear           Don't clear screen on start
  --verbose, -v        Verbose output

Examples:
  nextrush dev
  nextrush dev ./src/app.ts
  nextrush dev --port 4000
  nextrush dev --watch ./src --watch ./config
  nextrush dev ./src/app.ts --port 4000 --inspect
`);
}
