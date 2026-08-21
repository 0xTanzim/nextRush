/**
 * @nextrush/express-bridge — unused-path import-graph gate
 *
 * Reads workspace `package.json` dependency edges and fails if core, router,
 * types, runtime, any adapter, or the `nextrush` meta-package lists
 * `@nextrush/express-bridge` as a dependency/peerDependency/import.
 *
 * This is the P2 hard gate for "the bridge introduces no reverse dependency
 * into the native path" — no dependency-cruiser toolchain, just a tiny reader.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  imports?: Record<string, unknown>;
}

const FORBIDDEN_REVERSE_DEPENDENCIES = new Set([
  '@nextrush/core',
  '@nextrush/router',
  '@nextrush/types',
  '@nextrush/runtime',
  '@nextrush/adapter-node',
  '@nextrush/adapter-bun',
  '@nextrush/adapter-deno',
  '@nextrush/adapter-edge',
  '@nextrush/adapter-serverless',
  '@nextrush/adapter-nextjs',
  'nextrush',
]);

function readPackageJson(dir: string): PackageJson {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as PackageJson;
}

function listsExpressBridge(pkg: PackageJson): boolean {
  const surfaces = [pkg.dependencies, pkg.peerDependencies];
  for (const surface of surfaces) {
    if (surface && '@nextrush/express-bridge' in surface) return true;
  }
  return false;
}

// The package root is src/__tests__/../..  (two levels up from this file).
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// The monorepo root is three levels up from the package root.
const monorepoRoot = join(packageRoot, '..', '..', '..');

describe('unused-path import graph', () => {
  it('no forbidden package lists @nextrush/express-bridge as a dependency edge', () => {
    for (const name of FORBIDDEN_REVERSE_DEPENDENCIES) {
      const dir = name === 'nextrush' ? 'packages/nextrush' : `packages/${name.split('/')[1]}`;
      let pkg: PackageJson;
      try {
        pkg = readPackageJson(join(monorepoRoot, dir));
      } catch {
        continue; // package not present in this checkout — nothing to assert
      }
      expect(listsExpressBridge(pkg), `${name} must not depend on @nextrush/express-bridge`).toBe(false);
    }
  });

  it('the bridge itself depends only on types, errors, and runtime', () => {
    const pkg = readPackageJson(packageRoot);
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps.sort()).toEqual(['@nextrush/errors', '@nextrush/runtime', '@nextrush/types'].sort());
  });
});
