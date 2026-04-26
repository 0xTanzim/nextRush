/**
 * @nextrush/dev - CLI Entry Point
 *
 * Unified CLI for NextRush development and build tools.
 *
 * Commands:
 * - nextrush dev      - Start development server
 * - nextrush build    - Build for production
 * - nextrush generate - Generate controllers, services, middleware, guards, routes
 *
 * @packageDocumentation
 */

import { buildCli, buildHelp, devCli, devHelp } from './commands/index.js';
import { generateCli, generateHelp } from './generators/index.js';
import { exitProcess, getRuntimeInfo } from './runtime/index.js';
import { error } from './utils/logger.js';

const VERSION = '3.0.0-alpha.2';

/**
 * Get CLI arguments in a cross-runtime way
 */
function getCliArgs(): string[] {
  if ('Deno' in globalThis) {
    // @ts-expect-error Deno global exists in Deno runtime
    return (globalThis.Deno as { args: string[] }).args;
  }

  // Node.js and Bun both use process.argv
  return process.argv.slice(2);
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

    case 'generate':
    case 'g':
      if (commandArgs.includes('--help') || commandArgs.includes('-h')) {
        generateHelp();
      } else {
        generateCli(commandArgs);
      }
      break;

    default:
      error(`Unknown command: ${command}`);
      error('Run "nextrush --help" for available commands.');
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
  dev          Start development server with hot reload
  build        Build for production with decorator metadata
  generate, g  Generate controller, service, middleware, guard, or route

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

  nextrush generate controller user
  nextrush g s user-profile

Run "nextrush <command> --help" for command-specific help.

Documentation: https://github.com/0xTanzim/nextRush/blob/main/apps/docs/content/docs/guides/dev-tools.mdx
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
