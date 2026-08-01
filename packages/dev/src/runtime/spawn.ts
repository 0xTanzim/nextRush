/* eslint-disable nextrush/no-runtime-identity-capability -- dev CLI runtime-specific process spawning (node/bun/deno binaries); platform optimization */
/**
 * @nextrush/dev - Cross-Runtime Process Spawning
 *
 * Provides a unified API for spawning child processes across
 * Node.js, Bun, and Deno runtimes.
 *
 * @packageDocumentation
 */

import { detectRuntime, type Runtime } from './detect.js';
import { getCwd } from './fs.js';
import { getSwcNodeRegisterPath, getNodeChildProcess } from './node-modules.js';
import { getBunGlobal, getDenoGlobal } from './runtime-globals.js';

// Memoize runtime detection to avoid repeated calls
const memoizedRuntime: Runtime = detectRuntime();

export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  stdio?: 'inherit' | 'pipe' | 'ignore';
}

export interface SpawnResult {
  kill: (signal?: string) => void;
  onExit: (callback: (code: number | null) => void) => void;
  onError: (callback: (error: Error) => void) => void;
}

/**
 * Spawn a child process in a runtime-agnostic way
 */
export async function spawn(
  command: string,
  args: string[],
  options: SpawnOptions = {}
): Promise<SpawnResult> {
  switch (memoizedRuntime) {
    case 'bun':
      return spawnBun(command, args, options);
    case 'deno':
      return spawnDeno(command, args, options);
    case 'node':
    default:
      return spawnNode(command, args, options);
  }
}

/**
 * Node.js spawn implementation
 *
 * For the 'node' command, uses process.execPath to spawn the current Node.js binary.
 * This avoids PATH resolution issues and .cmd file handling on Windows.
 */
async function spawnNode(
  command: string,
  args: string[],
  options: SpawnOptions
): Promise<SpawnResult> {
  const { spawn: nodeSpawn } = await getNodeChildProcess();

  // Use process.execPath for 'node' command to avoid PATH/.cmd issues on Windows
  const actualCommand = command === 'node' ? process.execPath : command;

  const child = nodeSpawn(actualCommand, args, {
    cwd: options.cwd ?? getCwd(),
    env: {
      ...(process.env as Record<string, string>),
      ...options.env,
    },
    stdio: options.stdio ?? 'inherit',
  });

  const exitCallbacks: ((code: number | null) => void)[] = [];
  const errorCallbacks: ((error: Error) => void)[] = [];

  child.on('exit', (code: number | null) => {
    exitCallbacks.forEach((cb) => { cb(code); });
  });

  child.on('error', (error: Error) => {
    errorCallbacks.forEach((cb) => { cb(error); });
  });

  return {
    kill: (signal = 'SIGTERM') => {
      // `SpawnResult.kill`'s public contract takes a plain string (this package's
      // cross-runtime vocabulary); Node's real `ChildProcess.kill()` wants the narrower
      // `NodeJS.Signals` union. The cast is legitimate here — every caller of this
      // `kill` either uses the 'SIGTERM' default or passes a real signal name — unlike
      // the `any`-typed version before this fix, `nodeSpawn`'s return is now properly
      // typed, so this assertion is checked against a real, specific parameter type
      // instead of silently accepting anything.
      child.kill(signal as NodeJS.Signals);
    },
    onExit: (callback) => {
      exitCallbacks.push(callback);
    },
    onError: (callback) => {
      errorCallbacks.push(callback);
    },
  };
}

/**
 * Bun spawn implementation
 */
function spawnBun(
  command: string,
  args: string[],
  options: SpawnOptions
): SpawnResult {
  const Bun = getBunGlobal();

  const proc = Bun.spawn([command, ...args], {
    cwd: options.cwd ?? getCwd(),
    env: {
      ...process.env,
      ...options.env,
    },
    stdio: [options.stdio ?? 'inherit', options.stdio ?? 'inherit', options.stdio ?? 'inherit'],
  });

  const exitCallbacks: ((code: number | null) => void)[] = [];
  const errorCallbacks: ((error: Error) => void)[] = [];

  // Bun's exited is a Promise
  proc.exited
    .then((code: number) => {
      exitCallbacks.forEach((cb) => {
        cb(code);
      });
    })
    .catch((error: unknown) => {
      const err = error instanceof Error ? error : new Error(String(error));
      errorCallbacks.forEach((cb) => {
        cb(err);
      });
    });

  return {
    kill: (signal = 'SIGTERM') => {
      proc.kill(signal === 'SIGTERM' ? 15 : 9);
    },
    onExit: (callback) => {
      exitCallbacks.push(callback);
    },
    onError: (callback) => {
      errorCallbacks.push(callback);
    },
  };
}

/**
 * Translate this package's cross-runtime `stdio` vocabulary (`inherit`/`pipe`/`ignore`,
 * matching Node's `child_process`) to Deno's own `Command` stdio literals
 * (`inherit`/`piped`/`null`) — the two runtimes name the same three semantic modes
 * differently. Passing this package's `'pipe'` straight through to Deno was a genuine
 * bug hiding behind `any` typing before {@link getDenoGlobal} existed: Deno's `Command`
 * has no `'pipe'` literal, only `'piped'`.
 */
export function toDenoStdio(stdio: SpawnOptions['stdio']): 'inherit' | 'piped' | 'null' {
  switch (stdio) {
    case 'pipe':
      return 'piped';
    case 'ignore':
      return 'null';
    case 'inherit':
    default:
      return 'inherit';
  }
}

/**
 * Deno spawn implementation
 */
function spawnDeno(
  command: string,
  args: string[],
  options: SpawnOptions
): SpawnResult {
  const Deno = getDenoGlobal();
  const stdio = toDenoStdio(options.stdio);

  const proc = new Deno.Command(command, {
    args,
    cwd: options.cwd ?? Deno.cwd(),
    env: {
      ...Deno.env.toObject(),
      ...options.env,
    },
    stdin: stdio,
    stdout: stdio,
    stderr: stdio,
  }).spawn();

  const exitCallbacks: ((code: number | null) => void)[] = [];
  const errorCallbacks: ((error: Error) => void)[] = [];

  proc.status
    .then((status) => {
      exitCallbacks.forEach((cb) => {
        cb(status.code);
      });
    })
    .catch((error: unknown) => {
      const err = error instanceof Error ? error : new Error(String(error));
      errorCallbacks.forEach((cb) => {
        cb(err);
      });
    });

  return {
    kill: (signal = 'SIGTERM') => {
      proc.kill(signal);
    },
    onExit: (callback) => {
      exitCallbacks.push(callback);
    },
    onError: (callback) => {
      errorCallbacks.push(callback);
    },
  };
}

/**
 * Default Deno permission set used when no extra permissions are configured.
 *
 * These are the only permissions `nextrush dev`/`build` grant under Deno unless a
 * project explicitly opts in to more via config — see {@link validateDenoPermissions}
 * and the `dev-deno-permissions` spec (D1: extend, never replace).
 */
const DEFAULT_DENO_PERMISSIONS = ['--allow-net', '--allow-read', '--allow-env'];

/**
 * Validate that every configured Deno permission is a recognized permission flag
 * (`--allow-*` or `--deny-*`).
 *
 * Deno permission flags are pass-through strings (not modeled per-permission) so the
 * CLI stays forward-compatible with new/scoped forms (`--allow-read=./data`) — see
 * design.md D2. This validator only checks the flag *prefix*; it does not otherwise
 * interpret the value.
 *
 * @param permissions - Raw permission flag strings from project config.
 * @throws {Error} Naming the first offending value, if any permission does not begin
 *   with `--allow-` or `--deny-`. Callers should surface this as a fail-fast, non-zero
 *   exit before spawning Deno — never a warning.
 */
export function validateDenoPermissions(permissions: string[]): void {
  for (const permission of permissions) {
    if (!permission.startsWith('--allow-') && !permission.startsWith('--deny-')) {
      throw new Error(
        `Invalid Deno permission "${permission}": must begin with "--allow-" or "--deny-".`
      );
    }
  }
}

/**
 * Merge configured extra Deno permissions into the default set, deduplicated.
 *
 * Per `dev-deno-permissions` spec (D1), configured permissions always *extend* the
 * default set — they never replace it. A configured value already present in the
 * defaults is not duplicated in the result.
 */
function mergeDenoPermissions(configured: string[] | undefined): string[] {
  if (!configured || configured.length === 0) {
    return [...DEFAULT_DENO_PERMISSIONS];
  }
  return [...new Set([...DEFAULT_DENO_PERMISSIONS, ...configured])];
}

/**
 * Build runtime-specific dev command arguments
 *
 * For Node.js, we use @swc-node/register via --import because:
 * - SWC properly emits decorator metadata (emitDecoratorMetadata)
 * - Decorator metadata is required for DI constructor injection
 * - Node.js >= 22 has built-in --watch that auto-watches imported files
 *
 * Watch paths behavior:
 * - Node.js: uses --watch-path=<dir> for each path (repeatable); bare --watch if none given
 * - Deno: uses --watch=path1,path2 for paths; bare --watch if none given
 * - Bun: warns that custom paths unsupported (bun watches imported files); uses bare --watch
 *
 * Deno permissions: `denoPermissions` (if given) is merged into the default
 * `--allow-net --allow-read --allow-env` set, deduplicated — it never replaces the
 * defaults. Callers should validate the array with {@link validateDenoPermissions}
 * before calling this function.
 */
export function buildDevArgs(
  runtime: Runtime,
  entry: string,
  watchPaths: string[],
  inspect?: boolean,
  inspectPort?: number,
  denoPermissions?: string[],
  onWarnUnsupported?: () => void
): { command: string; args: string[] } {
  switch (runtime) {
    case 'bun': {
      // Bun's --watch always watches imported files; custom paths not supported
      if (watchPaths.length > 0 && onWarnUnsupported) {
        onWarnUnsupported();
      }
      return {
        command: 'bun',
        args: ['--watch', ...(inspect ? [`--inspect=${String(inspectPort ?? 9229)}`] : []), entry],
      };
    }

    case 'deno': {
      const permissions = mergeDenoPermissions(denoPermissions);
      const watchArg = watchPaths.length > 0 ? `--watch=${watchPaths.join(',')}` : '--watch';
      return {
        command: 'deno',
        args: [
          'run',
          watchArg,
          ...permissions,
          ...(inspect ? [`--inspect=${String(inspectPort ?? 9229)}`] : []),
          entry,
        ],
      };
    }

    case 'node':
    default: {
      // Use SWC for TypeScript transpilation with decorator metadata support
      const swcLoaderPath = getSwcNodeRegisterPath();
      const watchArgs =
        watchPaths.length > 0 ? watchPaths.map((p) => `--watch-path=${p}`) : ['--watch'];
      return {
        command: 'node',
        args: [
          '--import',
          swcLoaderPath,
          ...watchArgs,
          ...(inspect ? [`--inspect=${String(inspectPort ?? 9229)}`] : []),
          entry,
        ],
      };
    }
  }
}
