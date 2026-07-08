/**
 * @nextrush/dev - Codemod Command
 *
 * Automated code transformations for NextRush projects.
 *
 * Usage:
 *   nextrush codemod consolidate-imports <glob>
 *   nextrush codemod consolidate-imports src/**\/*.ts
 *
 * @packageDocumentation
 */

import { globSync } from 'glob';
import { consolidateImports } from '../codemods/consolidate-imports.js';
import { getCwd, exitProcess, readFile, writeFile } from '../runtime/index.js';
import { error, log, success } from '../utils/logger.js';

export interface CodemodOptions {
  pattern?: string;
  dryRun?: boolean;
}

/**
 * Parse CLI arguments for codemod command
 */
export function parseCodemodArgs(args: string[]): {
  name?: string;
  pattern?: string;
  dryRun: boolean;
} {
  const name = args[0];
  let pattern: string | undefined;
  let dryRun = false;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (!args[i]?.startsWith('-')) {
      pattern = args[i];
    }
  }

  return { name, pattern, dryRun };
}

/**
 * Run consolidate-imports codemod on files matching glob pattern
 */
export async function runConsolidateImports(
  pattern: string,
  options?: { dryRun?: boolean },
): Promise<{ changed: number; files: string[] }> {
  const cwd = getCwd();
  const files = globSync(pattern, { cwd });

  if (files.length === 0) {
    throw new Error(`No files matched pattern: ${pattern}`);
  }

  const changed: string[] = [];

  for (const file of files) {
    const fullPath = `${cwd}/${file}`;
    const source = await readFile(fullPath);
    const transformed = consolidateImports(source);

    if (transformed !== source) {
      changed.push(file);
      if (!options?.dryRun) {
        await writeFile(fullPath, transformed);
      }
    }
  }

  return { changed: changed.length, files: changed };
}

/**
 * Main codemod CLI entry point
 */
export async function codemodCli(args: string[]): Promise<void> {
  const { name, pattern, dryRun } = parseCodemodArgs(args);

  if (!name || (name === '--help' || name === '-h')) {
    codemodHelp();
    return;
  }

  if (!pattern) {
    error(`Pattern required. Usage: nextrush codemod ${name} <glob>`);
    error(`Example: nextrush codemod ${name} src/**/*.ts`);
    exitProcess(1);
    return;
  }

  try {
    switch (name) {
      case 'consolidate-imports': {
        const { changed, files } = await runConsolidateImports(pattern, { dryRun });
        if (dryRun) {
          log(`[DRY RUN] Would modify ${changed} file(s):`);
        } else {
          success(`Modified ${changed} file(s):`);
        }
        files.forEach((f) => log(`  ${f}`));
        break;
      }

      default:
        error(`Unknown codemod: ${name}`);
        error('Run "nextrush codemod --help" for available codemods.');
        exitProcess(1);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(`Codemod failed: ${message}`);
    exitProcess(1);
  }
}

/**
 * Print help for codemod command
 */
export function codemodHelp(): void {
  console.log(`
\x1b[36m⚡ NextRush Codemod\x1b[0m

Usage: nextrush codemod <codemod> <glob> [options]

Available Codemods:
  consolidate-imports  Consolidate class-model imports to nextrush/class
                       Rewrites @nextrush/decorators and @nextrush/controllers
                       to nextrush/class, merging and deduplicating imports

Options:
  --dry-run            Preview changes without writing to disk
  --help, -h           Show this help

Examples:
  nextrush codemod consolidate-imports src/**/*.ts
  nextrush codemod consolidate-imports 'src/**/*.{ts,tsx}' --dry-run

Documentation: https://github.com/0xTanzim/nextRush/tree/main/packages/dev
`);
}
