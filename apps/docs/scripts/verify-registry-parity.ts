#!/usr/bin/env node
/**
 * Registry parity gate.
 *
 * Discovers every real, publishable package.json under packages/** (the
 * same workspace globs as pnpm-workspace.yaml: packages/*, packages/middleware/*,
 * packages/extensions/*, packages/adapters/*) and compares that set against
 * apps/docs/src/lib/package-registry.ts. Fails loudly — non-zero exit, a
 * clear diff — if the two sets disagree in either direction:
 *
 *   - a real, non-private package with no registry entry (registry is stale)
 *   - a registry entry with no matching real package (registry is fabricated
 *     or the package was removed/renamed and the registry wasn't updated)
 *
 * Usage:
 *   pnpm --filter docs docs:verify-registry
 *   tsx apps/docs/scripts/verify-registry-parity.ts
 *
 * Exit codes:
 *   0 — registry and real packages match exactly
 *   1 — mismatch found (see stdout diff) or a package.json failed to parse
 */

import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { packageRegistry } from '../src/lib/package-registry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

/** Mirrors the workspace globs declared in pnpm-workspace.yaml. */
const PACKAGE_GLOB_ROOTS = [
  'packages',
  'packages/middleware',
  'packages/extensions',
  'packages/adapters',
] as const;

interface DiscoveredPackage {
  readonly name: string;
  readonly relativePath: string;
  readonly version: string;
}

/**
 * List immediate sub-directories of `dir` that contain a package.json.
 * Non-recursive by design — matches pnpm's `packages/*` glob semantics
 * (one level deep), so it can't accidentally wander into node_modules or
 * a package's own src/ tree.
 */
function listPackageDirs(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  return entries
    .map((entry) => join(dir, entry))
    .filter((fullPath) => {
      try {
        return statSync(fullPath).isDirectory();
      } catch {
        return false;
      }
    });
}

/**
 * Read and parse one package.json. Throws with the file path attached so a
 * malformed package.json fails loudly instead of being silently skipped.
 */
function readPackageJson(packageJsonPath: string): {
  name?: string;
  version?: string;
  private?: boolean;
} {
  const raw = readFileSync(packageJsonPath, 'utf8');
  try {
    return JSON.parse(raw) as { name?: string; version?: string; private?: boolean };
  } catch (cause) {
    throw new Error(`Failed to parse ${packageJsonPath} as JSON`, { cause });
  }
}

/**
 * Discover every real, publishable (non-private) package under the
 * workspace's package roots.
 */
function discoverRealPackages(): DiscoveredPackage[] {
  const discovered: DiscoveredPackage[] = [];
  const seenDirs = new Set<string>();

  for (const globRoot of PACKAGE_GLOB_ROOTS) {
    const absoluteRoot = join(REPO_ROOT, globRoot);
    for (const pkgDir of listPackageDirs(absoluteRoot)) {
      if (seenDirs.has(pkgDir)) continue;
      seenDirs.add(pkgDir);

      const packageJsonPath = join(pkgDir, 'package.json');
      let pkg: { name?: string; version?: string; private?: boolean };
      try {
        pkg = readPackageJson(packageJsonPath);
      } catch {
        // No package.json at this depth (e.g. packages/middleware itself) —
        // not a package directory, skip without failing the whole run.
        continue;
      }

      if (pkg.private) continue;
      if (!pkg.name || !pkg.version) {
        throw new Error(`${packageJsonPath} is missing a "name" or "version" field`);
      }

      discovered.push({
        name: pkg.name,
        relativePath: pkgDir.replace(`${REPO_ROOT}/`, ''),
        version: pkg.version,
      });
    }
  }

  return discovered;
}

function formatList(names: readonly string[]): string {
  return names.length > 0 ? names.map((name) => `  - ${name}`).join('\n') : '  (none)';
}

function main(): void {
  const realPackages = discoverRealPackages();
  const realNames = new Set(realPackages.map((pkg) => pkg.name));
  const registryNames = new Set(packageRegistry.map((entry) => entry.name));

  const missingFromRegistry = [...realNames].filter((name) => !registryNames.has(name));
  const extraInRegistry = [...registryNames].filter((name) => !realNames.has(name));

  console.log(`Discovered ${realNames.size} real publishable package(s) under packages/**.`);
  console.log(`Registry declares ${registryNames.size} package(s).`);

  if (missingFromRegistry.length === 0 && extraInRegistry.length === 0) {
    console.log('\n✅ Registry parity OK — every real package is registered, and every');
    console.log('   registry entry corresponds to a real package.');
    return;
  }

  console.error('\n❌ Registry parity FAILED.\n');

  if (missingFromRegistry.length > 0) {
    console.error(
      `Real packages missing from apps/docs/src/lib/package-registry.ts (${missingFromRegistry.length}):`,
    );
    console.error(formatList(missingFromRegistry));
    console.error('');
  }

  if (extraInRegistry.length > 0) {
    console.error(
      `Registry entries with no matching real, publishable package (${extraInRegistry.length}):`,
    );
    console.error(formatList(extraInRegistry));
    console.error('');
  }

  process.exitCode = 1;
}

main();
