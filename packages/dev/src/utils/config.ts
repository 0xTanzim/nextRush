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
