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
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface DevOptions {
  entry?: string;
  port?: number;
  inspect?: boolean;
  inspectPort?: number;
  env?: Record<string, string>;
  clearScreen?: boolean;
}

const DEFAULT_ENTRIES = [
  './src/index.ts',
  './src/app.ts',
  './src/server.ts',
  './index.ts',
  './app.ts',
] as const;

function findEntry(): string {
  for (const entry of DEFAULT_ENTRIES) {
    if (existsSync(resolve(process.cwd(), entry))) {
      return entry;
    }
  }
  return './src/index.ts';
}

function log(message: string): void {
  const time = new Date().toLocaleTimeString();
  console.log(`\x1b[90m[${time}]\x1b[0m \x1b[36m[nextrush]\x1b[0m ${message}`);
}

/**
 * Start development server with tsx watch
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

  if (options.clearScreen !== false) {
    console.clear();
  }

  console.log('\n\x1b[36m⚡ NextRush Dev Server\x1b[0m\n');
  log(`Starting ${resolvedEntry}`);
  log(`Port: ${port}`);

  const args = ['watch', '--clear-screen=false'];

  if (options.inspect) {
    args.push(`--inspect=${options.inspectPort || 9229}`);
  }

  args.push(resolvedEntry);

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    PORT: String(port),
    NODE_ENV: 'development',
    ...options.env,
  };

  const child = spawn('tsx', args, {
    stdio: 'inherit',
    env,
    cwd: process.cwd(),
  });

  child.on('error', (err) => {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error('\n\x1b[31mError: tsx not found.\x1b[0m');
      console.error('Install it with: pnpm add -D tsx\n');
      process.exit(1);
    }
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
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
\x1b[36m⚡ NextRush Dev Server\x1b[0m

Usage: nextrush-dev [entry] [options]

Options:
  --port, -p <port>    Port number (default: 3000)
  --inspect            Enable Node.js inspector
  --inspect-port       Inspector port (default: 9229)
  --help, -h           Show this help

Examples:
  nextrush-dev
  nextrush-dev ./src/app.ts
  nextrush-dev --port 4000
  nextrush-dev ./src/app.ts --port 4000 --inspect
`);
      process.exit(0);
    } else if (arg && !arg.startsWith('-')) {
      entry = arg;
    }
  }

  dev(entry, options);
}

// Auto-detect if running as CLI
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('nextrush-dev') ||
  process.argv[1].endsWith('nextrush-dev.js') ||
  process.argv[1].includes('@nextrush/dev')
);

if (isMainModule) {
  cli();
}
