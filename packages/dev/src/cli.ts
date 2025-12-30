/**
 * @nextrush/dev - CLI Entry Point
 *
 * Unified CLI for NextRush development and build tools.
 *
 * Commands:
 * - nextrush dev   - Start development server
 * - nextrush build - Build for production
 *
 * @packageDocumentation
 */

import { buildCli, buildHelp, devCli, devHelp } from './commands/index.js';
import { detectRuntime, getRuntimeInfo } from './runtime/index.js';

const VERSION = '3.0.0-alpha.2';

/**
 * Get CLI arguments in a cross-runtime way
 */
function getCliArgs(): string[] {
  const runtime = detectRuntime();

  if (runtime === 'deno') {
    // Deno provides args directly without script name
    return (globalThis as unknown as { Deno: { args: string[] } }).Deno.args;
  }

  if (runtime === 'bun') {
    // Bun uses process.argv like Node.js
    return process.argv.slice(2);
  }

  // Node.js: argv[0] is node, argv[1] is script, rest are args
  return process.argv.slice(2);
}

/**
 * Exit process in a cross-runtime way
 */
function exitProcess(code: number): never {
  const runtime = detectRuntime();

  if (runtime === 'deno') {
    (globalThis as unknown as { Deno: { exit: (code: number) => never } }).Deno.exit(code);
  }

  process.exit(code);
}

/**
 * Main CLI entry point
 */
export function cli(): void {
  const args = getCliArgs();
  const command = args[0];

  // Handle global flags
  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === '--version' || command === '-V') {
    printVersion();
    return;
  }

  // Route to command
  const commandArgs = args.slice(1);

  switch (command) {
    case 'dev':
      if (commandArgs.includes('--help') || commandArgs.includes('-h')) {
        devHelp();
      } else {
        devCli(commandArgs);
      }
      break;

    case 'build':
      if (commandArgs.includes('--help') || commandArgs.includes('-h')) {
        buildHelp();
      } else {
        buildCli(commandArgs);
      }
      break;

    default:
      console.error(`\x1b[31mUnknown command: ${command}\x1b[0m`);
      console.error('Run "nextrush --help" for available commands.');
      exitProcess(1);
  }
}

/**
 * Print main help
 */
function printHelp(): void {
  const runtimeInfo = getRuntimeInfo();

  console.log(`
\x1b[36m⚡ NextRush CLI\x1b[0m v${VERSION}
\x1b[90mRuntime: ${runtimeInfo.runtime} v${runtimeInfo.version}\x1b[0m

Usage: nextrush <command> [options]

Commands:
  dev     Start development server with hot reload
  build   Build for production with decorator metadata

Global Options:
  --help, -h       Show help
  --version, -V    Show version

Examples:
  nextrush dev                    Start dev server
  nextrush dev ./src/app.ts       Start with custom entry
  nextrush dev --port 4000        Start on port 4000

  nextrush build                  Build for production
  nextrush build --minify         Build with minification
  nextrush build --outDir dist    Build to custom directory

Run "nextrush <command> --help" for command-specific help.

Documentation: https://nextrush.dev/docs/cli
`);
}

/**
 * Print version
 */
function printVersion(): void {
  const runtimeInfo = getRuntimeInfo();
  console.log(`nextrush v${VERSION}`);
  console.log(`runtime: ${runtimeInfo.runtime} v${runtimeInfo.version}`);
}

// Legacy CLI support (for nextrush-dev command)
export { devCli as legacyDevCli };
