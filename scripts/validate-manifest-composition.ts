/// <reference types="node" />

/**
 * Enforces the canonical publishable-package manifest shape
 * (openspec/changes/framework-composition-integrity — capability: framework-composition).
 *
 * A publishable NextRush package manifest MUST NOT:
 *   - declare the same package in both `dependencies` and required `peerDependencies`
 *     (ambiguous intent — declare it as a hard dependency, or as an OPTIONAL peer, never both);
 *   - declare an `install` / `preinstall` / `postinstall` lifecycle script (install-time code
 *     execution is a supply-chain anti-pattern; see docs/RFC/framework-composition/020-...).
 *
 * This does not (yet) enforce `module`-field consistency or `tsup` target/`engines` alignment —
 * those are single, targeted manifest edits (tasks 2.3, 2.4) verified by direct inspection rather
 * than a generic cross-package rule, since they are not yet violated by more than the one or two
 * packages this change corrects.
 */

import { readFile, readdir } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';

export type PackageJson = {
  readonly name?: string;
  readonly private?: boolean;
  readonly dependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  readonly scripts?: Record<string, string>;
};

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function parsePackageJson(contents: string, pkgJsonPath: string): PackageJson {
  try {
    return JSON.parse(contents) as PackageJson;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid package.json at ${pkgJsonPath}: ${message}`);
  }
}

export async function listPackageJsonFiles(rootDir: string): Promise<string[]> {
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
 * A package listed as both a `dependency` and a required (non-optional) `peerDependency` is an
 * ambiguous, contradictory declaration: is it bundled, or deduped against the consumer's copy?
 * Flag it unless the peer is explicitly marked optional in `peerDependenciesMeta` (an optional
 * peer alongside a hard dependency is not a contradiction it's just redundant, and out of scope
 * for this check).
 */
export function findDependencyPeerConflicts(pkg: PackageJson): string[] {
  const deps = pkg.dependencies ?? {};
  const peers = pkg.peerDependencies ?? {};
  const peerMeta = pkg.peerDependenciesMeta ?? {};

  const conflicts: string[] = [];
  for (const name of Object.keys(peers)) {
    const isOptionalPeer = peerMeta[name]?.optional === true;
    if (name in deps && !isOptionalPeer) {
      conflicts.push(name);
    }
  }
  return conflicts.sort();
}

const FORBIDDEN_LIFECYCLE_SCRIPTS = ['install', 'preinstall', 'postinstall'] as const;

export function findInstallLifecycleScripts(pkg: PackageJson): string[] {
  const scripts = pkg.scripts ?? {};
  return FORBIDDEN_LIFECYCLE_SCRIPTS.filter((name) => name in scripts);
}

export async function validateOnePackage(pkgJsonPath: string): Promise<string[]> {
  const pkg = parsePackageJson(await readFile(pkgJsonPath, 'utf8'), pkgJsonPath);
  const packageName = pkg.name ?? '(unknown)';
  const problems: string[] = [];

  if (pkg.private === true) {
    return problems;
  }

  const conflicts = findDependencyPeerConflicts(pkg);
  for (const conflictingDep of conflicts) {
    problems.push(
      `${packageName}: "${conflictingDep}" is declared as both a "dependency" and a required ` +
        '"peerDependency" — ambiguous intent. Declare it as a hard dependency, or mark the peer ' +
        'optional via peerDependenciesMeta, never both.'
    );
  }

  const lifecycleScripts = findInstallLifecycleScripts(pkg);
  for (const scriptName of lifecycleScripts) {
    problems.push(
      `${packageName}: declares a "${scriptName}" lifecycle script — install-time code execution ` +
        'is forbidden for publishable packages (see docs/RFC/framework-composition/020-framework-composition-integrity.md).'
    );
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
      '❌ Canonical manifest shape violation (framework-composition capability):\n' +
        allProblems.map((p) => `- ${p}`).join('\n')
    );
    process.exitCode = 1;
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`✅ Canonical manifest shape check passed (${packageJsonFiles.length} packages)`);
}

// Only run when executed directly (not imported for testing).
const isMainModule = process.argv[1]?.endsWith('validate-manifest-composition.ts');
if (isMainModule) {
  main().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  });
}
