/**
 * Resolves NextRush workspace package names to their `src` entry file.
 *
 * Used by:
 *  - compile-check.ts   (builds tsconfig `paths` for typechecking snippets)
 *  - reference-match.ts (finds the real barrel file to check exported symbols against)
 *
 * This intentionally reads only `packages/*` package.json metadata — never the
 * built `dist` output (packages are not required to be built for docs verification)
 * and never anything under `apps/docs` (framework source is read-only reference data).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findFiles } from './fs-walk.js';

export interface PackageEntry {
  /** npm package name, e.g. "@nextrush/core" or "nextrush" */
  name: string;
  /** absolute path to the package directory */
  dir: string;
  /** absolute path to the package's src/index.ts (or equivalent) barrel file */
  entryFile: string;
}

/**
 * Scan `packagesRoot` (repo-root `packages/`) for every package.json and
 * resolve its primary entry file. Packages without a discoverable
 * `src/index.ts` (or `src/<name>.ts` for subpath-only packages) are skipped —
 * they don't have a hand-written barrel to check examples/signatures against.
 */
export function resolveWorkspacePackages(packagesRoot: string): PackageEntry[] {
  const packageJsonPaths = findFiles(packagesRoot, 'package.json').filter(
    (p) => !p.includes('node_modules') && !p.includes('/dist/')
  );

  const entries: PackageEntry[] = [];

  for (const pkgJsonPath of packageJsonPaths) {
    let pkg: { name?: string };
    try {
      pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    } catch {
      continue;
    }
    if (!pkg.name) continue;

    const dir = pkgJsonPath.replace(/\/package\.json$/, '');
    const indexTs = join(dir, 'src/index.ts');
    if (existsSync(indexTs)) {
      entries.push({ name: pkg.name, dir, entryFile: indexTs });
    }
  }

  return entries;
}

/**
 * Build the `nextrush/class` subpath entry explicitly — it is not its own
 * workspace package, it's a named export condition inside the `nextrush`
 * meta-package (see packages/nextrush/package.json `exports["./class"]`).
 */
export function resolveNextrushClassSubpathEntry(packagesRoot: string): PackageEntry | null {
  const dir = join(packagesRoot, 'nextrush');
  const entryFile = join(dir, 'src/class.ts');
  return existsSync(entryFile) ? { name: 'nextrush/class', dir, entryFile } : null;
}
