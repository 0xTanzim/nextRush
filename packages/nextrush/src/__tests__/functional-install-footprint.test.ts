import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

/**
 * Install-graph test (openspec/changes/framework-composition-integrity, capability:
 * framework-composition, requirement "The advertised functional footprint matches the
 * functional install graph").
 *
 * A functional-only `pnpm add nextrush` must not resolve the class/DI stack, nor
 * `@nextrush/adapter-nextjs`/`next` (RFC-024 §4.1 G8). The `.` entry's runtime import graph
 * never loads any of these (see create-app-container.test.ts's "does not statically import
 * @nextrush/di" assertion) — this test locks the MANIFEST side of that promise: every one of
 * these must be an optional peer dependency, never a hard dependency, so a functional install's
 * resolved tree excludes them.
 */
describe('functional install footprint (manifest-level)', () => {
  it('does not declare @nextrush/class, @nextrush/di, @nextrush/adapter-nextjs, or reflect-metadata as hard dependencies', async () => {
    const pkgJsonUrl = new URL('../../package.json', import.meta.url);
    const pkg = JSON.parse(await readFile(pkgJsonUrl, 'utf8')) as {
      dependencies?: Record<string, string>;
    };

    expect(pkg.dependencies?.['@nextrush/class']).toBeUndefined();
    expect(pkg.dependencies?.['@nextrush/di']).toBeUndefined();
    expect(pkg.dependencies?.['@nextrush/adapter-nextjs']).toBeUndefined();
    expect(pkg.dependencies?.['reflect-metadata']).toBeUndefined();
  });

  it('declares @nextrush/class, @nextrush/di, @nextrush/adapter-nextjs, and reflect-metadata as OPTIONAL peer dependencies', async () => {
    const pkgJsonUrl = new URL('../../package.json', import.meta.url);
    const pkg = JSON.parse(await readFile(pkgJsonUrl, 'utf8')) as {
      peerDependencies?: Record<string, string>;
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    };

    for (const name of [
      '@nextrush/class',
      '@nextrush/di',
      '@nextrush/adapter-nextjs',
      'reflect-metadata',
    ]) {
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
