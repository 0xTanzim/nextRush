/**
 * @nextrush/dev - Development Server for NextRush
 *
 * Simple, clean dev server powered by tsx.
 * No custom watchers. No complexity. Just works.
 *
 * @packageDocumentation
 *
 * @example CLI
 * ```bash
 * npx nextrush-dev
 * npx nextrush-dev ./src/app.ts
 * npx nextrush-dev --port 4000
 * ```
 *
 * @example Programmatic
 * ```typescript
 * import { dev } from '@nextrush/dev';
 *
 * dev('./src/index.ts');
 * ```
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface DevOptions {
  entry?: string;
  port?: number;
  inspect?: boolean;
  inspectPort?: number;
  env?: Record<string, string>;
  clearScreen?: boolean;
  watch?: string[];
}

function findEntry(): string {
  const cwd = process.cwd();

  // 1. Try package.json
  try {
    const pkgPath = join(cwd, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

      // Check "main" or "module"
      const main = pkg.main || pkg.module;
      if (main) {
        // If it's already a .ts file
        if (main.endsWith('.ts') && existsSync(resolve(cwd, main))) {
          return main;
        }

        // If it's a .js file in dist, try to find corresponding .ts in src
        if (main.endsWith('.js')) {
          const tsEntry = main.replace('dist/', 'src/').replace('.js', '.ts');
          if (existsSync(resolve(cwd, tsEntry))) {
            return tsEntry;
          }
        }
      }
    }
  } catch {}

  // 2. Check common defaults
  const DEFAULT_ENTRIES = [
    'src/index.ts',
    'src/main.ts',
    'src/app.ts',
    'src/server.ts',
    'index.ts',
    'main.ts',
    'app.ts',
    'server.ts',
  ];

  for (const entry of DEFAULT_ENTRIES) {
    if (existsSync(resolve(cwd, entry))) {
      return entry;
    }
  }

  return 'src/index.ts';
}

function log(message: string): void {
  const time = new Date().toLocaleTimeString();
  console.log(`\x1b[90m[${time}]\x1b[0m \x1b[36m[nextrush]\x1b[0m ${message}`);
}

/**
 * Start development server with SWC and Node.js watch
 *
 * @example
 * ```typescript
 * import { dev } from '@nextrush/dev';
 *
 * // Simple
 * dev();
 *
 * // With options
 * dev('./src/app.ts', { port: 4000 });
 * ```
 */
export function dev(entry?: string, options: DevOptions = {}): ChildProcess {
  const resolvedEntry = entry || options.entry || findEntry();
  const port = options.port || 3000;
  const cwd = process.cwd();

  if (options.clearScreen !== false) {
    console.clear();
  }

  console.log('\n\x1b[36m⚡ NextRush Dev Server\x1b[0m\n');
  log(`Starting ${resolvedEntry}`);
  log(`Port: ${port}`);

  // Build watch paths
  const watchPaths = options.watch || [];
  if (watchPaths.length === 0) {
    // Default: watch src if it exists, otherwise watch current dir
    if (existsSync(resolve(cwd, 'src'))) {
      watchPaths.push('src');
    } else {
      watchPaths.push('.');
    }
  }

  // Use node --watch with @swc-node/register for decorator metadata support
  const args = [
    '--watch',
    ...watchPaths.map(p => `--watch-path=${p}`),
    '--import',
    '@swc-node/register/esm-register',
    resolvedEntry,
  ];

  if (options.inspect) {
    args.unshift(`--inspect=${options.inspectPort || 9229}`);
  }

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    PORT: String(port),
    NODE_ENV: 'development',
    ...options.env,
  };

  const child = spawn('node', args, {
    stdio: 'inherit',
    env,
    cwd,
  });

  child.on('error', (err) => {
    console.error('Error:', err.message);
  });

  process.on('SIGINT', () => {
    child.kill('SIGTERM');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    child.kill('SIGTERM');
    process.exit(0);
  });

  return child;
}

/**
 * CLI entry point
 */
export function cli(): void {
  const args = process.argv.slice(2);
  const options: DevOptions = {};
  let entry: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';

    if (arg === '--port' || arg === '-p') {
      const portArg = args[++i];
      if (portArg) options.port = parseInt(portArg, 10);
    } else if (arg === '--inspect') {
      options.inspect = true;
    } else if (arg === '--inspect-port') {
      const inspectArg = args[++i];
      if (inspectArg) options.inspectPort = parseInt(inspectArg, 10);
    } else if (arg === '--watch' || arg === '-w') {
      const watchArg = args[++i];
      if (watchArg) {
        if (!options.watch) options.watch = [];
        options.watch.push(watchArg);
      }
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
\x1b[36m⚡ NextRush Dev Server\x1b[0m

Usage: nextrush-dev [entry] [options]

Options:
  --port, -p <port>    Port number (default: 3000)
  --watch, -w <path>   Additional path to watch (can be used multiple times)
  --inspect            Enable Node.js inspector
  --inspect-port       Inspector port (default: 9229)
  --help, -h           Show this help

Examples:
  nextrush-dev
  nextrush-dev ./src/app.ts
  nextrush-dev --port 4000
  nextrush-dev --watch ./src --watch ./config
  nextrush-dev ./src/app.ts --port 4000 --inspect
`);
      process.exit(0);
    } else if (arg && !arg.startsWith('-')) {
      entry = arg;
    }
  }

  dev(entry, options);
}
