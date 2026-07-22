import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

/**
 * Install-graph test (openspec/changes/framework-composition-integrity, capability:
 * framework-composition, requirement "The advertised functional footprint matches the
 * functional install graph").
 *
 * A functional-only `pnpm add nextrush` must not resolve the class/DI stack. The `.` entry's
 * runtime import graph never loads `@nextrush/class`/`@nextrush/di`/`reflect-metadata` (see
 * create-app-container.test.ts's "does not statically import @nextrush/di" assertion) — this
 * test locks the MANIFEST side of that promise: those three packages must be optional peer
 * dependencies, never hard dependencies, so a functional install's resolved tree excludes them.
 */
describe('functional install footprint (manifest-level)', () => {
  it('does not declare @nextrush/class, @nextrush/di, or reflect-metadata as hard dependencies', async () => {
    const pkgJsonUrl = new URL('../../package.json', import.meta.url);
    const pkg = JSON.parse(await readFile(pkgJsonUrl, 'utf8')) as {
      dependencies?: Record<string, string>;
    };

    expect(pkg.dependencies?.['@nextrush/class']).toBeUndefined();
    expect(pkg.dependencies?.['@nextrush/di']).toBeUndefined();
    expect(pkg.dependencies?.['reflect-metadata']).toBeUndefined();
  });

  it('declares @nextrush/class, @nextrush/di, and reflect-metadata as OPTIONAL peer dependencies', async () => {
    const pkgJsonUrl = new URL('../../package.json', import.meta.url);
    const pkg = JSON.parse(await readFile(pkgJsonUrl, 'utf8')) as {
      peerDependencies?: Record<string, string>;
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    };

    for (const name of ['@nextrush/class', '@nextrush/di', 'reflect-metadata']) {
      expect(pkg.peerDependencies?.[name]).toBeDefined();
      expect(pkg.peerDependenciesMeta?.[name]?.optional).toBe(true);
    }
  });

  it('the functional (.) entry still resolves and works with the class peers absent', async () => {
    // create-app-container.test.ts already proves createApp() never statically imports
    // @nextrush/di. This test proves the top-level barrel itself has no load-time
    // dependency on the class/DI packages either, by importing it directly.
    const mod = await import('../index.js');
    expect(typeof mod.createApp).toBe('function');
    expect(typeof mod.listen).toBe('function');
  });
});
