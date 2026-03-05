import { MIDDLEWARE_PRESETS, RUNTIMES, STYLES } from './constants.js';
import type { MiddlewarePreset, PackageManager, ParsedArgs, Runtime, Style } from './types.js';

const HELP_TEXT = `
  Usage: create-nextrush [directory] [options]

  Options:
    --style <style>          Project style: functional, class-based, full
    --runtime <runtime>      Target runtime: node, bun, deno
    --middleware <preset>    Middleware preset: minimal, api, full
    --pm <pm>                Package manager: npm, pnpm, yarn, bun
    --no-install             Skip dependency installation
    --no-git                 Skip git initialization
    -y, --yes                Accept all defaults
    -v, --version            Show version
    -h, --help               Show this help
`;

/** Parses CLI arguments into a structured ParsedArgs object. */
export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);

  const parsed: {
    directory?: string;
    style?: Style;
    runtime?: Runtime;
    middleware?: MiddlewarePreset;
    packageManager?: PackageManager;
    install: boolean;
    git: boolean;
    yes: boolean;
    help: boolean;
    version: boolean;
  } = {
    install: true,
    git: true,
    yes: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    switch (arg) {
      case '-h':
      case '--help':
        parsed.help = true;
        break;

      case '-v':
      case '--version':
        parsed.version = true;
        break;

      case '-y':
      case '--yes':
        parsed.yes = true;
        break;

      case '--no-install':
        parsed.install = false;
        break;

      case '--no-git':
        parsed.git = false;
        break;

      case '--style': {
        const value = args[++i];
        if (value && isValidStyle(value)) {
          parsed.style = value;
        }
        break;
      }

      case '--runtime': {
        const value = args[++i];
        if (value && isValidRuntime(value)) {
          parsed.runtime = value;
        }
        break;
      }

      case '--middleware': {
        const value = args[++i];
        if (value && isValidMiddleware(value)) {
          parsed.middleware = value;
        }
        break;
      }

      case '--pm': {
        const value = args[++i];
        if (value && isValidPm(value)) {
          parsed.packageManager = value;
        }
        break;
      }

      default:
        if (!arg.startsWith('-') && !parsed.directory) {
          parsed.directory = arg;
        }
        break;
    }
  }

  return parsed;
}

export function printHelp(): void {
  console.log(HELP_TEXT);
}

function isValidStyle(value: string): value is Style {
  return (STYLES as readonly string[]).includes(value);
}

function isValidRuntime(value: string): value is Runtime {
  return (RUNTIMES as readonly string[]).includes(value);
}

function isValidMiddleware(value: string): value is MiddlewarePreset {
  return (MIDDLEWARE_PRESETS as readonly string[]).includes(value);
}

function isValidPm(value: string): value is PackageManager {
  return ['npm', 'pnpm', 'yarn', 'bun'].includes(value);
}
