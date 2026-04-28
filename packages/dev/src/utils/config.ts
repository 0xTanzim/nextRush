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
      const pkg = JSON.parse(readFileSync(pkgPath));

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
 * Load nextrush.config.ts if it exists
 */
export interface NextRushConfig {
  dev?: {
    entry?: string;
    port?: number;
    watch?: string[];
    env?: Record<string, string>;
  };
  build?: {
    entry?: string;
    outDir?: string;
    target?: 'es2020' | 'es2021' | 'es2022' | 'esnext';
    sourcemap?: boolean;
    minify?: boolean;
    decoratorMetadata?: boolean;
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
      // Dynamic import for config file
      const config = await import(configPath);
      return config.default ?? config;
    } catch {
      // Ignore import errors, use defaults
    }
  }

  // Try package.json "nextrush" field
  try {
    const pkgPath = joinPath(cwd, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath));
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
 * Validate tsconfig.json when decorators or decorator metadata are in use.
 * Returns warnings for inconsistent or incomplete settings that would break DI.
 *
 * When both `experimentalDecorators` and `emitDecoratorMetadata` are omitted or not `true`,
 * returns no warnings — that matches create-nextrush "functional" projects. If either flag is
 * `true`, the other must also be `true` or we report what is missing.
 */
export function validateDecoratorConfig(): string[] {
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
    const tsconfig = JSON.parse(stripped);
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
