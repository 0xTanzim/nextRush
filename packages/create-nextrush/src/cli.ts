import { MIDDLEWARE_PRESETS, RUNTIMES, STYLES } from './constants.js';
import type {
  CliErrorPayload,
  Example,
  MiddlewarePreset,
  PackageManager,
  ParsedArgs,
  Preset,
  Runtime,
  Style,
} from './types.js';

const HELP_TEXT = `
  Usage: create-nextrush [directory] [options]

  Options:
    --style, -s <style>      Project style: functional, class-based, full
    --runtime, -r <runtime>  Target runtime: node, bun, deno
    --middleware, -m <preset> Middleware preset: minimal, api, full
    --pm <pm>                Package manager: npm, pnpm, yarn, bun
    --install, -i            Install dependencies
    --no-install             Skip dependency installation
    --git                    Initialize git repository
    --no-git                 Skip git initialization
    -y, --yes                Accept all defaults
    --dry-run                Print the resolved scaffold plan without writing files
    --json                   Emit one machine-readable result document
    --overwrite              Replace generated paths in a non-empty target
    --offline                Skip registry probes; use embedded fallback version ranges
    --skip-runtime-check     Skip the local runtime-binary preflight (remote/container targets)
    --preset <preset>        Add the production-service preset: production
    --example <example>      Scaffold a governed task-oriented example: secure-api
    --workspace              Place the project in a detected pnpm workspace (apps/<name>)
    -v, --version            Show version
    -h, --help               Show this help
`;

/** A user-correctable command-line error that is safe to expose in automation output. */
export class CliInputError extends Error {
  readonly code: string;
  readonly remediation: string;

  constructor(payload: CliErrorPayload) {
    super(payload.message);
    this.name = 'CliInputError';
    this.code = payload.code;
    this.remediation = payload.remediation;
  }

  toPayload(): CliErrorPayload {
    return { code: this.code, message: this.message, remediation: this.remediation };
  }
}

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
    installExplicit: boolean;
    git: boolean;
    gitExplicit: boolean;
    yes: boolean;
    help: boolean;
    version: boolean;
    json: boolean;
    dryRun: boolean;
    overwrite: boolean;
    offline: boolean;
    skipRuntimeCheck: boolean;
    preset?: Preset;
    example?: Example;
    workspace: boolean;
  } = {
    install: true,
    installExplicit: false,
    git: true,
    gitExplicit: false,
    yes: false,
    help: false,
    version: false,
    json: false,
    dryRun: false,
    overwrite: false,
    offline: false,
    skipRuntimeCheck: false,
    workspace: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === undefined) {
      continue;
    }

    switch (arg) {
      // `--` is the standard end-of-options separator. `npm create`/`pnpm create`
      // wrappers pass it through from the canonical `create nextrush my-app -- --yes`
      // form, so skip it rather than treating it as an unknown option.
      case '--':
        break;

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

      case '--json':
        parsed.json = true;
        break;

      case '--dry-run':
        parsed.dryRun = true;
        break;

      case '--overwrite':
        parsed.overwrite = true;
        break;

      case '--offline':
        parsed.offline = true;
        break;

      case '--skip-runtime-check':
        parsed.skipRuntimeCheck = true;
        break;

      case '--no-install':
        parsed.install = false;
        parsed.installExplicit = true;
        break;

      case '-i':
      case '--install':
        parsed.install = true;
        parsed.installExplicit = true;
        break;

      case '--no-git':
        parsed.git = false;
        parsed.gitExplicit = true;
        break;

      case '--git':
        parsed.git = true;
        parsed.gitExplicit = true;
        break;

      case '-s':
      case '--style': {
        const value = readOptionValue(args, ++i, arg);
        if (!isValidStyle(value)) throw invalidEnumValue('STYLE', arg, value, STYLES);
        parsed.style = value;
        break;
      }

      case '-r':
      case '--runtime': {
        const value = readOptionValue(args, ++i, arg);
        if (!isValidRuntime(value)) throw invalidEnumValue('RUNTIME', arg, value, RUNTIMES);
        parsed.runtime = value;
        break;
      }

      case '-m':
      case '--middleware': {
        const value = readOptionValue(args, ++i, arg);
        if (!isValidMiddleware(value)) throw invalidEnumValue('MIDDLEWARE', arg, value, MIDDLEWARE_PRESETS);
        parsed.middleware = value;
        break;
      }

      case '--pm': {
        const value = readOptionValue(args, ++i, arg);
        if (!isValidPm(value)) throw invalidEnumValue('PACKAGE_MANAGER', arg, value, ['npm', 'pnpm', 'yarn', 'bun']);
        parsed.packageManager = value;
        break;
      }

      case '--preset': {
        const value = readOptionValue(args, ++i, arg);
        if (value !== 'production') throw invalidEnumValue('PRESET', arg, value, ['production']);
        parsed.preset = value;
        break;
      }

      case '--example': {
        const value = readOptionValue(args, ++i, arg);
        if (value !== 'secure-api') throw invalidEnumValue('EXAMPLE', arg, value, ['secure-api']);
        parsed.example = value;
        break;
      }

      case '--workspace':
        parsed.workspace = true;
        break;

      default:
        if (arg.startsWith('-')) throw unknownOption(arg);
        if (parsed.directory) throw new CliInputError({
          code: 'UNEXPECTED_POSITIONAL',
          message: `Unexpected positional argument "${arg}".`,
          remediation: 'Pass one project directory, then use named options for all other choices.',
        });
        parsed.directory = arg;
        break;
    }
  }

  return parsed;
}

function readOptionValue(args: readonly string[], index: number, option: string): string {
  const value = args[index];
  if (!value || value.startsWith('-')) {
    throw new CliInputError({
      code: 'MISSING_OPTION_VALUE',
      message: `Option "${option}" requires a value.`,
      remediation: `Run create-nextrush --help, then provide a value after ${option}.`,
    });
  }
  return value;
}

function invalidEnumValue(
  name: string,
  option: string,
  value: string,
  values: readonly string[]
): CliInputError {
  return new CliInputError({
    code: `INVALID_${name}`,
    message: `Invalid value "${value}" for ${option}. Expected one of: ${values.join(', ')}.`,
    remediation: `Choose one of the documented ${option} values, or run create-nextrush --help.`,
  });
}

function unknownOption(option: string): CliInputError {
  return new CliInputError({
    code: 'UNKNOWN_OPTION',
    message: `Unknown option "${option}".`,
    remediation: 'Run create-nextrush --help to see supported options.',
  });
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

// 'bun' here is one of the four PACKAGE MANAGER names (npm/pnpm/yarn/bun)
// this scaffolder supports, not a NextRush JS-runtime capability decision —
// collides with a runtime name in RUNTIME_NAMES, but never branches on the
// executing runtime.
function isValidPm(value: string): value is PackageManager {
  // capability-exempt: package-manager name check, see function doc above
  return ['npm', 'pnpm', 'yarn', 'bun'].includes(value);
}
