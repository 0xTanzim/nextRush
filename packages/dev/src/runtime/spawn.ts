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
import { getSwcNodeRegisterPath, NODE_CHILD_PROCESS } from './node-modules.js';

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
  const { spawn: nodeSpawn } = await import(/* @vite-ignore */ NODE_CHILD_PROCESS);

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

  const exitCallbacks: Array<(code: number | null) => void> = [];
  const errorCallbacks: Array<(error: Error) => void> = [];

  child.on('exit', (code: number | null) => {
    exitCallbacks.forEach((cb) => cb(code));
  });

  child.on('error', (error: Error) => {
    errorCallbacks.forEach((cb) => cb(error));
  });

  return {
    kill: (signal = 'SIGTERM') => {
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
async function spawnBun(
  command: string,
  args: string[],
  options: SpawnOptions
): Promise<SpawnResult> {
  // @ts-expect-error Bun global exists in Bun runtime
  const Bun = globalThis.Bun;

  const proc = Bun.spawn([command, ...args], {
    cwd: options.cwd ?? getCwd(),
    env: {
      ...process.env,
      ...options.env,
    },
    stdio: [options.stdio ?? 'inherit', options.stdio ?? 'inherit', options.stdio ?? 'inherit'],
  });

  const exitCallbacks: Array<(code: number | null) => void> = [];
  const errorCallbacks: Array<(error: Error) => void> = [];

  // Bun's exited is a Promise
  proc.exited
    .then((code: number) => {
      exitCallbacks.forEach((cb) => cb(code));
    })
    .catch((error: Error) => {
      errorCallbacks.forEach((cb) => cb(error));
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
 * Deno spawn implementation
 */
async function spawnDeno(
  command: string,
  args: string[],
  options: SpawnOptions
): Promise<SpawnResult> {
  // @ts-expect-error Deno global exists in Deno runtime
  const Deno = globalThis.Deno;

  const proc = new Deno.Command(command, {
    args,
    cwd: options.cwd ?? Deno.cwd(),
    env: {
      ...Deno.env.toObject(),
      ...options.env,
    },
    stdin: options.stdio ?? 'inherit',
    stdout: options.stdio ?? 'inherit',
    stderr: options.stdio ?? 'inherit',
  }).spawn();

  const exitCallbacks: Array<(code: number | null) => void> = [];
  const errorCallbacks: Array<(error: Error) => void> = [];

  proc.status
    .then((status: { code: number }) => {
      exitCallbacks.forEach((cb) => cb(status.code));
    })
    .catch((error: Error) => {
      errorCallbacks.forEach((cb) => cb(error));
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
        args: ['--watch', ...(inspect ? [`--inspect=${inspectPort ?? 9229}`] : []), entry],
      };
    }

    case 'deno': {
      const permissions = denoPermissions ?? ['--allow-net', '--allow-read', '--allow-env'];
      const watchArg = watchPaths.length > 0 ? `--watch=${watchPaths.join(',')}` : '--watch';
      return {
        command: 'deno',
        args: [
          'run',
          watchArg,
          ...permissions,
          ...(inspect ? [`--inspect=${inspectPort ?? 9229}`] : []),
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
          ...(inspect ? [`--inspect=${inspectPort ?? 9229}`] : []),
          entry,
        ],
      };
    }
  }
}
