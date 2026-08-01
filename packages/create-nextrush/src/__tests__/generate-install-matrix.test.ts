import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { generateProject } from '../generator.js';
import type { MiddlewarePreset, ProjectOptions, Runtime, Style } from '../types.js';
import { seedAllPackageVersions } from './test-helpers.js';
import { setPackageVersion } from '../version-store.js';

/**
 * Wave 1 verifier backstop (task 2.1 — RFC-021 / ADR-0011).
 *
 * This is the system-of-record verifier for the P0 install-integrity claim: it scaffolds
 * every `style x runtime x middleware` combination this CLI offers and asserts that EVERY
 * emitted dependency/devDependency range resolves against the package's REAL, currently
 * published workspace version (read directly from that package's own `package.json` — the
 * monorepo's local stand-in for "what npm actually has published").
 *
 * It intentionally does NOT call `setVersions('^3.0.5', '^3.0.5')` like `generator.test.ts`
 * does — that mock is exactly the wrong assumption this test exists to catch (a single scalar
 * cannot represent ~10 independently-versioned packages). Instead it exercises the resolver
 * through whatever version-store shape currently exists, so this test is RED against the
 * current two-scalar design and turns GREEN only once resolution is genuinely per-package.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKSPACE_ROOT = resolve(__dirname, '../../../../');

/** Reads the REAL published (workspace) version for a package directory. */
function readWorkspaceVersion(...pkgDirSegments: string[]): string {
  const pkgJsonPath = join(WORKSPACE_ROOT, 'packages', ...pkgDirSegments, 'package.json');
  const raw = JSON.parse(readFileSync(pkgJsonPath, 'utf-8')) as { version: string };
  return raw.version;
}

/** Maps an `@nextrush/*` package name to its workspace directory segments. */
const PACKAGE_DIRS: Record<string, string[]> = {
  nextrush: ['nextrush'],
  '@nextrush/types': ['types'],
  '@nextrush/class': ['class'],
  '@nextrush/dev': ['dev'],
  '@nextrush/cors': ['middleware', 'cors'],
  '@nextrush/body-parser': ['middleware', 'body-parser'],
  '@nextrush/helmet': ['middleware', 'helmet'],
  '@nextrush/rate-limit': ['middleware', 'rate-limit'],
  '@nextrush/compression': ['middleware', 'compression'],
  '@nextrush/request-id': ['middleware', 'request-id'],
  '@nextrush/adapter-bun': ['adapters', 'bun'],
  '@nextrush/adapter-deno': ['adapters', 'deno'],
};

/** Real, currently-published major version for each emitted `@nextrush/*` package. */
function realMajorFor(pkgName: string): number {
  const dirs = PACKAGE_DIRS[pkgName];
  if (!dirs) {
    throw new Error(`No workspace directory mapping for package "${pkgName}" — update PACKAGE_DIRS`);
  }
  const version = readWorkspaceVersion(...dirs);
  const major = version.split('.')[0];
  if (major === undefined) {
    throw new Error(`Could not parse major version from "${version}" for ${pkgName}`);
  }
  return Number(major);
}

/** Extracts the major version number a semver RANGE (e.g. "^3.1.0") pins to. */
function majorFromRange(range: string): number {
  const match = /(\d+)\.\d+\.\d+/.exec(range);
  if (!match || match[1] === undefined) {
    throw new Error(`Could not parse a major version out of range "${range}"`);
  }
  return Number(match[1]);
}

function createOptions(overrides: Partial<ProjectOptions>): ProjectOptions {
  return {
    name: 'matrix-app',
    directory: './matrix-app',
    style: 'functional',
    runtime: 'node',
    middleware: 'api',
    packageManager: 'pnpm',
    git: false,
    install: false,
    ...overrides,
  };
}

const STYLES: readonly Style[] = ['functional', 'class-based', 'full'];
const RUNTIMES: readonly Runtime[] = ['node', 'bun', 'deno'];
const MIDDLEWARE_PRESETS: readonly MiddlewarePreset[] = ['minimal', 'api', 'full'];

describe('generate-then-install matrix (task 2.1 — system-of-record verifier)', () => {
  // Seed the version store with each package's OWN real published (workspace) version —
  // exactly what the fixed per-package resolver now does at runtime. This is the corrected
  // counterpart to the old two-scalar seeding this test intentionally never uses.
  seedAllPackageVersions('^0.0.0'); // baseline entry for every possible package name
  for (const [pkgName, dirs] of Object.entries(PACKAGE_DIRS)) {
    setPackageVersion(pkgName, `^${readWorkspaceVersion(...dirs)}`);
  }

  for (const style of STYLES) {
    for (const runtime of RUNTIMES) {
      for (const middleware of MIDDLEWARE_PRESETS) {
        const cellName = `${style} x ${runtime} x ${middleware}`;

        it(`${cellName}: every emitted dependency range matches its OWN package's real major version`, () => {
          const options = createOptions({ style, runtime, middleware });
          const files = generateProject(options);
          const pkg = JSON.parse(files.get('package.json')!) as {
            dependencies: Record<string, string>;
            devDependencies: Record<string, string>;
          };

          const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
          const failures: string[] = [];

          for (const [pkgName, range] of Object.entries(allDeps)) {
            if (!(pkgName in PACKAGE_DIRS)) continue; // typescript/@types/node/reflect-metadata: not this test's scope
            const emittedMajor = majorFromRange(range);
            const realMajor = realMajorFor(pkgName);
            if (emittedMajor !== realMajor) {
              failures.push(
                `${pkgName}: emitted range "${range}" (major ${emittedMajor}) does not match its own published major ${realMajor} [cell: ${cellName}]`
              );
            }
          }

          expect(failures, failures.join('\n')).toHaveLength(0);
        });
      }
    }
  }
});
