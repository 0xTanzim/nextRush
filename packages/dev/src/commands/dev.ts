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
import { findEntry, loadConfig, validateDecoratorConfig } from '../utils/config.js';
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

  // Watch strategy: only EXPLICIT `--watch <path>` args use path-scoped watching. With no
  // explicit paths we use the runtime's portable "watch imported files" mode (bare
  // `--watch` on Node) instead of `--watch-path`, which Node documents as macOS/Windows-only
  // (RFC-019 D4, F-05). This makes the default `nextrush dev` portable across platforms.
  const explicitWatchPaths = options.watch && options.watch.length > 0 ? options.watch : [];

  const watchDisplay =
    explicitWatchPaths.length > 0 ? explicitWatchPaths.join(', ') : 'imported files (auto)';
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

  // Warn if explicit watch paths were given on Bun (unsupported there).
  const warnUnsupported =
    targetRuntime === 'bun' && explicitWatchPaths.length > 0
      ? () => {
          warn('Custom watch paths are not supported in Bun. Bun will watch all imported files instead.');
        }
      : undefined;

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

  // Prepare environment
  const env: Record<string, string> = {
    PORT: String(port),
    NODE_ENV: 'development',
    ...options.env,
  };

  // Only Node + explicit paths uses `--watch-path`; that's the case the fallback guards.
  const nodeUsesWatchPath = targetRuntime === 'node' && explicitWatchPaths.length > 0;

  const spawnWith = async (
    watchPathsForArgs: string[]
  ): Promise<{ child: SpawnResult; command: string }> => {
    const built = buildDevArgs(
      targetRuntime,
      resolvedEntry,
      watchPathsForArgs,
      options.inspect,
      options.inspectPort,
      denoPermissions,
      warnUnsupported
    );
    const spawned = await spawn(built.command, built.args, { cwd, env, stdio: 'inherit' });
    return { child: spawned, command: built.command };
  };

  const launchTime = Date.now();
  const first = await spawnWith(explicitWatchPaths);
  let child = first.child;
  const command = first.command;
  let watchPathFallbackDone = false;
  let shuttingDown = false;

  const wireHandlers = (c: SpawnResult): void => {
    c.onError((err) => {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        // A missing target-runtime binary: name it and how to proceed, not a raw ENOENT (F-11).
        error(`Cannot start the dev server: "${command}" was not found on PATH.`);
        if (targetRuntime !== detectRuntime()) {
          error(
            `This project targets ${targetRuntime} (detected from its adapter dependency). ` +
              `Install ${targetRuntime}, or run the project under ${detectRuntime()}.`
          );
        }
        exitProcess(1);
      } else {
        error(`Process error: ${err.message}`);
      }
    });

    c.onExit((exitCode) => {
      // Clean shutdown initiated by a signal — the child is gone, so exit now.
      if (shuttingDown) {
        exitProcess(0);
        return;
      }

      // Guarded `--watch-path` fallback (F-05): if `node --watch-path` dies fast (an older
      // Node/platform without recursive watch throws ERR_FEATURE_UNAVAILABLE_ON_PLATFORM),
      // retry ONCE with the portable bare `--watch` rather than crashing the dev server.
      const diedFast = Date.now() - launchTime < 3000;
      if (nodeUsesWatchPath && !watchPathFallbackDone && diedFast && exitCode !== 0 && exitCode !== null) {
        watchPathFallbackDone = true;
        warn(
          '`--watch-path` appears unsupported on this platform/Node version; falling back to bare `--watch` (watching imported files).'
        );
        void spawnWith([]).then(({ child: retried }) => {
          child = retried;
          wireHandlers(retried);
        });
        return;
      }

      // Otherwise surface a genuine crash instead of exiting 0 silently.
      if (exitCode !== 0 && exitCode !== null) {
        error(`Dev process exited with code ${exitCode}.`);
        exitProcess(exitCode);
      }
    });
  };

  wireHandlers(child);

  // Graceful shutdown: signal the child, let its `onExit` exit the parent once it is gone
  // (so the port is released and the descendant app is reaped), and force-kill + exit if it
  // does not terminate within the grace window rather than exiting instantly (F-04).
  const cleanup = (): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    child.kill('SIGTERM');
    const force = setTimeout(() => {
      child.kill('SIGKILL');
      exitProcess(0);
    }, 3000);
    if (typeof (force as { unref?: () => void }).unref === 'function') {
      (force as { unref: () => void }).unref();
    }
  };

  onSignal('SIGINT', cleanup);
  onSignal('SIGTERM', cleanup);

  return child;
}
