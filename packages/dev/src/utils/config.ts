/**
 * @nextrush/dev - Configuration Utilities
 *
 * Configuration loading and defaults for the NextRush CLI.
 *
 * @packageDocumentation
 */

import { existsSync, getCwd, joinPath, readFileSync, resolvePath } from '../runtime/index.js';

/**
 * Default entry file candidates
 */
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

/**
 * Find the entry file for the application
 */
export function findEntry(): string {
  const cwd = getCwd();

  // 1. Try package.json
  try {
    const pkgPath = joinPath(cwd, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath)) as Record<string, string | undefined>;

      // Check "main" or "module"
      const main = pkg.main ?? pkg.module;
      if (main) {
        // If it's already a .ts file
        if (main.endsWith('.ts') && existsSync(resolvePath(cwd, main))) {
          return main;
        }

        // If it's a .js file in dist, try to find corresponding .ts in src
        if (main.endsWith('.js')) {
          const tsEntry = main.replace('dist/', 'src/').replace('.js', '.ts');
          if (existsSync(resolvePath(cwd, tsEntry))) {
            return tsEntry;
          }
        }
      }
    }
  } catch {
    // Ignore errors, try defaults
  }

  // 2. Check common defaults
  for (const entry of DEFAULT_ENTRIES) {
    if (existsSync(resolvePath(cwd, entry))) {
      return entry;
    }
  }

  return 'src/index.ts';
}

/**
 * Deno-specific configuration for `nextrush dev`/`nextrush build`.
 */
export interface DenoConfig {
  /**
   * Extra Deno permission flags (e.g. `"--allow-write"`, `"--allow-read=./data"`,
   * `"--allow-ffi"`) to grant in addition to the CLI's default set
   * (`--allow-net --allow-read --allow-env`).
   *
   * These are merged into the defaults, deduplicated — they never replace them (see
   * the `dev-deno-permissions` spec, D1). Each value must begin with `--allow-` or
   * `--deny-`; an invalid value fails the command before Deno is spawned.
   *
   * Adding permissions (especially `--allow-all`) weakens Deno's sandbox — only add
   * what the application actually needs.
   */
  permissions?: string[];
}

/**
 * Load nextrush.config.ts if it exists
 */
export interface NextRushConfig {
  dev?: {
    entry?: string;
    port?: number;
    watch?: string[];
    env?: Record<string, string>;
    deno?: DenoConfig;
  };
  build?: {
    entry?: string;
    outDir?: string;
    target?: 'es2020' | 'es2021' | 'es2022' | 'esnext';
    sourcemap?: boolean;
    minify?: boolean;
    decoratorMetadata?: boolean;
    deno?: DenoConfig;
  };
}

/**
 * Load configuration from nextrush.config.ts or package.json
 */
export async function loadConfig(): Promise<NextRushConfig> {
  const cwd = getCwd();
  const configPath = joinPath(cwd, 'nextrush.config.ts');

  // Try nextrush.config.ts
  if (existsSync(configPath)) {
    try {
      // Dynamic import for config file — its shape is genuinely unknowable at compile time
      // (an arbitrary user-authored file), so `unknown` + a narrow default-export check is
      // the correct type, not `any`.
      const config = (await import(configPath)) as { default?: unknown } & Record<string, unknown>;
      return config.default ?? config;
    } catch {
      // Ignore import errors, use defaults
    }
  }

  // Try package.json "nextrush" field
  try {
    const pkgPath = joinPath(cwd, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath)) as Record<string, unknown>;
      if (pkg.nextrush) {
        return pkg.nextrush;
      }
    }
  } catch {
    // Ignore errors
  }

  return {};
}

function isTruthyCompilerFlag(value: unknown): boolean {
  return value === true;
}

/**
 * Options controlling {@link validateDecoratorConfig}'s failure mode.
 */
export interface ValidateDecoratorConfigOptions {
  /**
   * When `true`, throw an `Error` (instead of returning warnings) as soon as
   * a decorator-metadata mismatch is detected. Callers that need a fail-fast
   * preflight (e.g. `nextrush build`) opt in explicitly; the default (`false`)
   * preserves the existing warn-and-return-warnings behavior relied on by
   * `nextrush dev`'s warn-and-continue UX.
   */
  throwOnMismatch?: boolean;
}

/**
 * Validate tsconfig.json when decorators or decorator metadata are in use.
 * Returns warnings for inconsistent or incomplete settings that would break DI.
 *
 * When both `experimentalDecorators` and `emitDecoratorMetadata` are omitted or not `true`,
 * returns no warnings — that matches create-nextrush "functional" projects. If either flag is
 * `true`, the other must also be `true` or we report what is missing.
 *
 * @param options - See {@link ValidateDecoratorConfigOptions}. Omitted/default behavior is
 *   unchanged from before this option existed.
 * @throws {Error} When `options.throwOnMismatch` is `true` and a mismatch is detected. The
 *   error message is the same remediation text this function otherwise returns as warnings.
 */
export function validateDecoratorConfig(options: ValidateDecoratorConfigOptions = {}): string[] {
  const { throwOnMismatch = false } = options;
  const cwd = getCwd();
  const warnings: string[] = [];

  const tsconfigPath = joinPath(cwd, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) {
    warnings.push(
      'No tsconfig.json found. Decorator metadata will not be emitted.',
      'DI constructor injection (@Service, @Controller) requires:',
      '  "experimentalDecorators": true',
      '  "emitDecoratorMetadata": true'
    );
    return warnings;
  }

  try {
    const raw = readFileSync(tsconfigPath);
    // Strip single-line comments for JSON parsing
    const stripped = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const tsconfig = JSON.parse(stripped) as { compilerOptions?: Record<string, unknown> };
    const co = tsconfig.compilerOptions ?? {};

    const hasExperimental = isTruthyCompilerFlag(co.experimentalDecorators);
    const hasEmit = isTruthyCompilerFlag(co.emitDecoratorMetadata);

    // Functional scaffold and other decorator-free projects omit both flags on purpose.
    if (!hasExperimental && !hasEmit) {
      return warnings;
    }

    if (hasExperimental && !hasEmit) {
      warnings.push(
        'tsconfig.json missing "emitDecoratorMetadata": true',
        'DI constructor injection will silently fail without it.'
      );
    }

    if (!hasExperimental && hasEmit) {
      warnings.push(
        'tsconfig.json missing "experimentalDecorators": true',
        'Decorators (@Controller, @Get, @Service) will not work without it.'
      );
    }
  } catch {
    // tsconfig exists but couldn't be parsed; SWC reads it natively via typescript API
  }

  if (throwOnMismatch && warnings.length > 0) {
    throw new Error(warnings.join('\n'));
  }

  return warnings;
}

/**
 * Get default watch paths
 */
export function getDefaultWatchPaths(): string[] {
  const cwd = getCwd();

  // Check if src directory exists
  if (existsSync(resolvePath(cwd, 'src'))) {
    return ['src'];
  }

  return ['.'];
}
