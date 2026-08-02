/**
 * @nextrush/dev - Dev Command CLI Handler
 *
 * Argument parsing and help for the dev command.
 *
 * @packageDocumentation
 */

import { exitProcess, type SpawnResult } from '../runtime/index.js';
import { error, log } from '../utils/logger.js';
import { dev, type DevOptions } from './dev.js';
import { parsePositiveInteger } from './dev-helpers.js';

/**
 * Resolve once the dev server child has exited, then exit this process with its
 * code. `dev()` resolves as soon as the child is spawned — without waiting, the
 * `nextrush` launcher's `process.exit(0)` would kill the process before the
 * server starts, and a child that exits 0 on its own would leave the parent
 * hanging (issue #40).
 *
 * Non-zero exits are mostly handled by `dev()`'s own onExit (crash → exit with
 * the child's code; the guarded `--watch-path` fallback → respawn). This handler
 * only decides for clean exits, and deliberately defers to the respawn path.
 */
function waitForChildExit(child: SpawnResult): Promise<void> {
  const launchTime = Date.now();
  let fallbackSeen = false;

  return new Promise<void>((resolve) => {
    child.onExit((code) => {
      const diedFast = Date.now() - launchTime < 3000;
      if (!fallbackSeen && diedFast && code !== 0 && code !== null) {
        // A fast non-zero death may be `dev()`'s guarded `--watch-path` fallback
        // respawn (F-05) — dev() itself decides and keeps the process alive while
        // it respawns. Stay pending so the launcher path does not process.exit(0)
        // over the replacement server.
        fallbackSeen = true;
        return;
      }

      if (code === 0 || code === null) {
        exitProcess(code ?? 0);
      }
      resolve();
    });
  });
}

/**
 * CLI entry point for dev command
 */
export async function devCli(args: string[]): Promise<void> {
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
        if (watchArg && !watchArg.startsWith('-')) {
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
        break;
      }
      default: {
        if (arg.startsWith('--') || arg.startsWith('-')) {
          // Handle --flag=value syntax
          if (arg.includes('=')) {
            const eqIndex = arg.indexOf('=');
            const flagPart = arg.substring(0, eqIndex);
            const valuePart = arg.substring(eqIndex + 1);
            switch (flagPart) {
              case '--port':
              case '-p': {
                options.port = parsePositiveInteger(valuePart, '--port');
                break;
              }
              case '--inspect-port': {
                options.inspectPort = parsePositiveInteger(valuePart, '--inspect-port');
                break;
              }
              case '--watch':
              case '-w': {
                if (valuePart) {
                  options.watch ??= [];
                  options.watch.push(valuePart);
                }
                break;
              }
              default: {
                error(`Unknown flag: ${arg}`);
                error('Run "nextrush dev --help" for available options.');
                exitProcess(1);
              }
            }
          } else {
            // Unknown flag without value
            error(`Unknown flag: ${arg}`);
            error('Run "nextrush dev --help" for available options.');
            exitProcess(1);
          }
        } else {
          entry = arg;
        }
        break;
      }
    }
  }

  // Run dev server, then stay alive until the child exits — the awaited promise
  // makes the CLI completion-aware (issue #40).
  try {
    const child = await dev(entry, options);
    await waitForChildExit(child);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    error(`Failed to start dev server: ${message}`);
    exitProcess(1);
  }
}

/**
 * Print dev command help
 */
export function devHelp(): void {
  log(`
\x1b[36m⚡ NextRush Dev Server\x1b[0m

Usage: nextrush dev [entry] [options]

Options:
  --port, -p <port>    Port number (default: 8080; env PORT overrides)
  --watch, -w <path>   Additional path to watch (can be used multiple times)
  --inspect            Enable Node.js inspector
  --inspect-port       Inspector port (default: 9229)
  --no-clear           Don't clear screen on start
  --verbose, -v        Verbose output

The dev server watches your source code and auto-restarts when files change.
Watched paths depend on your runtime:
  - Node.js & Deno: custom paths with --watch
  - Bun: auto-watches all imported files

Examples:
  nextrush dev
  nextrush dev ./src/app.ts
  nextrush dev --port=4000
  nextrush dev --watch ./src --watch ./config
  nextrush dev ./src/app.ts --port=4000 --inspect
`);
}
