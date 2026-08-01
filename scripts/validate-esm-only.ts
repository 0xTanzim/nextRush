/// <reference types="node" />

/**
 * Enforces the ratified ESM-only module-format policy
 * (openspec/changes/archive/module-format-policy — decision: ESM-only, permanent).
 *
 * NextRush publishes ESM only. This is a locked architectural decision, not a
 * default that can silently drift. This script fails the build if any published
 * package's `package.json`:
 *   - is missing `"type": "module"`, or
 *   - declares a `"require"` condition anywhere in its `exports` map.
 *
 * Dual-publish (ESM + CommonJS) was evaluated and explicitly rejected — see
 * design.md D2/D3 for the rationale (dual-package hazard on the DI/decorator-
 * metadata path, doubled publishing pipeline, Node >=22 already covering the
 * strongest CJS-interop case). Overturning this requires a new OpenSpec change,
 * not an edit to a package's `package.json`.
 */

import { readFile, readdir } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';

type ExportsCondition = string | Record<string, unknown>;

type PackageJson = {
  readonly name?: string;
  readonly type?: string;
  readonly private?: boolean;
  readonly exports?: Record<string, ExportsCondition> | string;
};

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function parsePackageJson(contents: string, pkgJsonPath: string): PackageJson {
  try {
    return JSON.parse(contents) as PackageJson;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid package.json at ${pkgJsonPath}: ${message}`);
  }
}

async function listPackageJsonFiles(rootDir: string): Promise<string[]> {
  const packagesDir = path.join(rootDir, 'packages');
  const work: string[] = [packagesDir];
  const results: string[] = [];

  while (work.length > 0) {
    const current = work.pop();
    if (!current) break;

    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const dir = path.join(current, entry.name);
      const pkgJsonPath = path.join(dir, 'package.json');

      if (await pathExists(pkgJsonPath)) {
        results.push(pkgJsonPath);
      } else {
        work.push(dir);
      }
    }
  }

  return results;
}

/**
 * Recursively search an `exports` map (or nested condition object) for a
 * `"require"` key at any depth — the ESM-only policy bans it everywhere, not
 * just at the top level (e.g. `exports['.'].require` is just as much a
 * violation as a top-level `exports.require`).
 */
function findRequireConditionPaths(
  node: unknown,
  currentPath: string
): string[] {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    return [];
  }

  const found: string[] = [];
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const nextPath = currentPath ? `${currentPath}.${key}` : key;
    if (key === 'require') {
      found.push(nextPath);
      continue;
    }
    found.push(...findRequireConditionPaths(value, nextPath));
  }

  return found;
}

async function validateOnePackage(pkgJsonPath: string): Promise<string[]> {
  const pkg = parsePackageJson(await readFile(pkgJsonPath, 'utf8'), pkgJsonPath);
  const packageName = pkg.name ?? '(unknown)';
  const problems: string[] = [];

  // Private, non-published packages (internal tooling fixtures, etc.) are out
  // of scope for a *publishing* policy — but only skip if explicitly private.
  if (pkg.private === true) {
    return problems;
  }

  if (pkg.type !== 'module') {
    problems.push(
      `${packageName}: "type" must be "module" (ESM-only policy) — found ${JSON.stringify(pkg.type)}`
    );
  }

  if (pkg.exports && typeof pkg.exports === 'object') {
    const requirePaths = findRequireConditionPaths(pkg.exports, 'exports');
    for (const requirePath of requirePaths) {
      problems.push(
        `${packageName}: "${requirePath}" declares a CommonJS "require" condition — ` +
          'forbidden by the ratified ESM-only policy. Dual-publish was evaluated and ' +
          'explicitly rejected; see openspec/changes/archive/*-module-format-policy/design.md.'
      );
    }
  }

  return problems;
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const packageJsonFiles = await listPackageJsonFiles(repoRoot);

  const allProblems: string[] = [];
  for (const pkgJsonPath of packageJsonFiles) {
    allProblems.push(...(await validateOnePackage(pkgJsonPath)));
  }

  if (allProblems.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      '❌ Module-format policy violation (ESM-only is a ratified, permanent decision):\n' +
        allProblems.map((p) => `- ${p}`).join('\n')
    );
    process.exitCode = 1;
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`✅ Module-format policy check passed (${packageJsonFiles.length} packages, ESM-only, no CJS)`);
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
