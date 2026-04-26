/**
 * @nextrush/controllers - Controller Discovery
 *
 * Automatic controller discovery by scanning directories.
 * Uses glob patterns to find files and imports them to discover controllers.
 */

import { isController } from '@nextrush/decorators';
import { readdir } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DiscoveryError } from './errors.js';
import type { DiscoveryOptions, DiscoveryResult } from './types.js';

const DEFAULT_INCLUDE = ['**/*.ts', '**/*.js'];
const DEFAULT_EXCLUDE = [
  '**/*.test.ts',
  '**/*.spec.ts',
  '**/*.test.js',
  '**/*.spec.js',
  '**/node_modules/**',
  '**/dist/**',
  '**/__tests__/**',
];

/**
 * Check if a filename matches any of the patterns
 *
 * Simple glob matching supporting:
 * - `**` matches any number of directories (including none)
 * - `*` matches any characters except /
 */
function matchesPattern(filename: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    // Convert glob pattern to regex
    // Order matters: escape special chars first, then replace glob patterns
    let regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars (except * and ?)
      .replace(/\*\*\//g, '(.*\\/)?') // **/ matches any directories (including none)
      .replace(/\*\*/g, '.*') // ** at end matches anything
      .replace(/\*/g, '[^/]*'); // * matches anything except /

    const regex = new RegExp(`^${regexStr}$`);
    return regex.test(filename);
  });
}

/**
 * Check if a path should be included based on patterns
 */
function shouldInclude(
  relativePath: string,
  includePatterns: string[],
  excludePatterns: string[]
): boolean {
  // Check exclusions first
  if (matchesPattern(relativePath, excludePatterns)) {
    return false;
  }

  // Check inclusions
  return matchesPattern(relativePath, includePatterns);
}

/**
 * Recursively scan directory for files
 */
async function scanDirectory(
  dir: string,
  rootDir: string,
  includePatterns: string[],
  excludePatterns: string[]
): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      // Normalize to POSIX separators for consistent glob matching
      const relativePath = fullPath
        .slice(rootDir.length + 1)
        .split(sep)
        .join('/');

      if (entry.isDirectory()) {
        // Skip excluded directories entirely
        if (
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === '__tests__' ||
          entry.name.startsWith('.')
        ) {
          continue;
        }

        // Recursively scan subdirectories
        const subFiles = await scanDirectory(fullPath, rootDir, includePatterns, excludePatterns);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        if ((ext === '.ts' || ext === '.js') && !entry.name.endsWith('.d.ts')) {
          if (shouldInclude(relativePath, includePatterns, excludePatterns)) {
            files.push(fullPath);
          }
        }
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  return files;
}

/**
 * Import a module and extract controller classes
 */
async function importControllers(
  filePath: string,
  debug: boolean
): Promise<{ controllers: Function[]; errors: DiscoveryError[] }> {
  const controllers: Function[] = [];
  const errors: DiscoveryError[] = [];

  try {
    // Convert to file URL for ESM import
    const fileUrl = pathToFileURL(filePath).href;
    const module = await import(fileUrl);

    // Check all exports for controllers
    for (const exportName of Object.keys(module)) {
      const exported = module[exportName];

      if (typeof exported === 'function' && isController(exported)) {
        controllers.push(exported);
        if (debug) {
          process.stderr.write(`[Controllers] Discovered: ${exported.name} from ${filePath}\n`);
        }
      }
    }
  } catch (error) {
    errors.push(
      new DiscoveryError(
        filePath,
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      )
    );
  }

  return { controllers, errors };
}

/**
 * Discover all controllers in a directory
 *
 * @param options - Discovery options
 * @returns Array of discovered controller classes
 *
 * @example
 * ```typescript
 * // Scans ALL .ts/.js files — discovers any class with @Controller
 * const controllers = await discoverControllers({
 *   root: './src',
 * });
 * ```
 */
export async function discoverControllers(options: DiscoveryOptions): Promise<DiscoveryResult[]> {
  const rootDir = resolve(options.root);
  const includePatterns = options.include ?? DEFAULT_INCLUDE;
  const excludePatterns = options.exclude ?? DEFAULT_EXCLUDE;
  const debug = options.debug ?? false;

  if (debug) {
    process.stderr.write(`[Controllers] Scanning: ${rootDir}\n`);
    process.stderr.write(`[Controllers] Include: ${includePatterns.join(', ')}\n`);
    process.stderr.write(`[Controllers] Exclude: ${excludePatterns.join(', ')}\n`);
  }

  // Scan for files
  const files = await scanDirectory(rootDir, rootDir, includePatterns, excludePatterns);

  if (debug) {
    process.stderr.write(`[Controllers] Found ${files.length} files to scan\n`);
  }

  // Import and discover controllers
  const results: DiscoveryResult[] = [];

  for (const filePath of files) {
    const { controllers, errors } = await importControllers(filePath, debug);
    results.push({
      filePath,
      controllers,
      errors,
    });
  }

  return results;
}

/**
 * Get all controllers from discovery results
 */
export function getControllersFromResults(results: DiscoveryResult[]): Function[] {
  const controllers: Function[] = [];

  for (const result of results) {
    controllers.push(...result.controllers);
  }

  return controllers;
}

/**
 * Get all errors from discovery results
 */
export function getErrorsFromResults(results: DiscoveryResult[]): DiscoveryError[] {
  const errors: DiscoveryError[] = [];

  for (const result of results) {
    errors.push(...result.errors);
  }

  return errors;
}
