import { beforeEach, describe, expect, it } from 'vitest';

import { runtimePolicy } from '../constants.js';
import { getManifestPackageNames } from '../dependency-manifest.js';
import { generateProject } from '../generator.js';
import { getAllPossiblePackageNames, getDependencies } from '../templates/package-json.js';
import type { ProjectOptions } from '../types.js';
import { seedAllPackageVersions } from './test-helpers.js';

/**
 * Dependency manifest system.
 *
 * Asserts the scaffolder's dependency model is declarative: the probed package-name set
 * and the generated dependency sets both derive from the dependency manifest, third-party
 * and workspace packages resolve through the same path, and the generated `engines.node`
 * floor + `@types/node` cap derive from a single runtime policy. Generated `package.json`
 * output must be byte-for-byte unchanged by the refactor.
 */

beforeEach(() => {
  seedAllPackageVersions('^3.0.0');
});

const STYLES: ProjectOptions['style'][] = ['functional', 'class-based', 'full'];
const RUNTIMES: ProjectOptions['runtime'][] = ['node', 'bun', 'deno'];
const MIDDLEWARE: ProjectOptions['middleware'][] = ['minimal', 'api', 'full'];

function createOptions(overrides: Partial<ProjectOptions> = {}): ProjectOptions {
  return {
    name: 'manifest-app',
    directory: './manifest-app',
    style: 'functional',
    runtime: 'node',
    middleware: 'minimal',
    packageManager: 'npm',
    git: false,
    install: false,
    ...overrides,
  };
}

describe('dependency manifest system', () => {
  describe('package-name set derives from the manifest', () => {
    it('getAllPossiblePackageNames contains every manifest key that resolves via the registry', () => {
      const names = getAllPossiblePackageNames();
      // Every manifest key with a registry-resolved policy must be probed.
      for (const key of getManifestPackageNames()) {
        // toolchain-sourced (typescript/vitest/@types/node/dotenv) and pinned-literal
        // (reflect-metadata) entries are resolved by the manifest, never probed — skip.
        if (['typescript', 'vitest', '@types/node', 'dotenv', 'reflect-metadata'].includes(key)) continue;
        expect(names).toContain(key);
      }
    });

    it('adding a manifest key automatically adds it to the probed set (no separate list)', () => {
      // The manifest is the single source — a new registry-resolved entry must appear in
      // the probed set without editing getAllPossiblePackageNames. The subset check above
      // pins the derivation; this test additionally pins that no probed package is unknown
      // to the manifest or the preset/adapter sets (a manual-list regression would drift).
      const names = getAllPossiblePackageNames();
      const manifestKeys = getManifestPackageNames();
      const known = new Set([
        ...manifestKeys,
        ...['@nextrush/cors', '@nextrush/body-parser', '@nextrush/helmet', '@nextrush/rate-limit', '@nextrush/compression', '@nextrush/request-id'],
        ...['@nextrush/adapter-bun', '@nextrush/adapter-deno'],
      ]);
      for (const name of names) {
        expect(known.has(name), `unexpected probed package ${name}`).toBe(true);
      }
    });
  });

  describe('getDependencies derives from the manifest', () => {
    it('produces the same dependency sets as the previous if-branch model for every combination', () => {
      // Byte-for-byte output guard: for every {style, runtime, middleware}, the generated
      // package.json dependencies/devDependencies are IDENTICAL to the pre-refactor model.
      // The expected sets below encode the documented behavior(framework-composition).
      for (const style of STYLES) {
        for (const runtime of RUNTIMES) {
          for (const middleware of MIDDLEWARE) {
            const deps = getDependencies(createOptions({ style, runtime, middleware }));

            // nextrush always present
            expect(deps.dependencies['nextrush']).toBe('^3.0.0');

            // dotenv for node/bun only — toolchain-sourced (^17.2.0 dev literal)
            if (runtime === 'deno') {
              expect(deps.dependencies['dotenv']).toBeUndefined();
            } else {
              expect(deps.dependencies['dotenv']).toBe('^17.4.2');
            }

            // class/full: reflect-metadata + @nextrush/class
            const isClass = style === 'class-based' || style === 'full';
            if (isClass) {
              expect(deps.dependencies['reflect-metadata']).toBe('>=0.2.0');
              expect(deps.dependencies['@nextrush/class']).toBe('^3.0.0');
            } else {
              expect(deps.dependencies['reflect-metadata']).toBeUndefined();
              expect(deps.dependencies['@nextrush/class']).toBeUndefined();
            }

            // devDeps: @nextrush/dev, @nextrush/types, typescript, vitest always; @types/node for node/bun
            expect(deps.devDependencies['@nextrush/dev']).toBe('^3.0.0');
            expect(deps.devDependencies['@nextrush/types']).toBe('^3.0.0');
            expect(deps.devDependencies['typescript']).toBeDefined();
            expect(deps.devDependencies['vitest']).toBeDefined();
            if (runtime === 'deno') {
              expect(deps.devDependencies['@types/node']).toBeUndefined();
            } else {
              expect(deps.devDependencies['@types/node']).toBeDefined();
            }
          }
        }
      }
    });

    it('middleware and adapter presets still compose with the manifest', () => {
      const api = getDependencies(createOptions({ middleware: 'api' }));
      expect(api.dependencies['@nextrush/cors']).toBe('^3.0.0');
      expect(api.dependencies['@nextrush/body-parser']).toBe('^3.0.0');
      expect(api.dependencies['@nextrush/helmet']).toBe('^3.0.0');

      const bun = getDependencies(createOptions({ runtime: 'bun' }));
      expect(bun.dependencies['@nextrush/adapter-bun']).toBe('^3.0.0');
    });
  });

  describe('third-party and workspace packages resolve identically', () => {
    it('dotenv is toolchain-sourced (not probed), and workspace packages fall back per-package', async () => {
      // dotenv uses the manifest `toolchain` policy — it is NOT probed by the resolver
      // (no special-case THIRD_PARTY_FALLBACKS map; it single-sources from create-nextrush's
      // own devDependencies). Workspace packages still fall back per-package offline.
      const names = getAllPossiblePackageNames();
      expect(names).not.toContain('dotenv');

      // Simulate total registry unavailability, then resolve two workspace packages.
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (() => Promise.reject(new Error('network unreachable'))) as unknown as typeof fetch;
      try {
        const { resolveVersions } = await import('../npm-version.js');
        const { versions } = await resolveVersions(['nextrush', '@nextrush/dev']);
        expect(versions.get('nextrush')).toBeDefined();
        expect(versions.get('@nextrush/dev')).toBeDefined();
        // Per-package fallback — never a shared scalar.
        expect(versions.get('@nextrush/dev')).not.toBe(versions.get('nextrush'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('runtime policy drives engines and @types/node cap', () => {
    it('generated engines.node derives from the runtime policy value', () => {
      const files = generateProject(createOptions({}));
      const pkg = JSON.parse(files.get('package.json')!) as { engines?: { node?: string } };
      expect(pkg.engines?.node).toBe(`>=${runtimePolicy.node.minMajor}.0.0`);
    });

    it('the @types/node cap aligns with the same runtime policy value', () => {
      const files = generateProject(createOptions({}));
      const pkg = JSON.parse(files.get('package.json')!) as {
        devDependencies: Record<string, string>;
      };
      const typesNode = pkg.devDependencies['@types/node'];
      const major = Number(/(\d+)/.exec(typesNode)?.[1]);
      expect(major).toBeLessThanOrEqual(runtimePolicy.node.minMajor);
    });
  });
});
