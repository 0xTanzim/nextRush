import type { Runtime, Style } from './types.js';

/**
 * Single source of truth for every dependency `create-nextrush` can emit.
 *
 * `getAllPossiblePackageNames()` and `getDependencies()` both derive from this manifest,
 * so adding a dependency is a one-line entry — no separate edits to the package-name
 * list, the resolver fallback, or the templates. The version resolver itself is unchanged.
 */

/** How a manifest dependency's version is resolved. */
export type ResolvePolicy = 'latest-compatible' | 'toolchain' | (string & {});

/** A single manifest entry: where the dependency goes, when it applies, how it resolves. */
export interface ManifestEntry {
  readonly scope: 'dependency' | 'devDependency';
  readonly runtimes?: readonly Runtime[];
  readonly templates?: readonly Style[];
  readonly resolve: ResolvePolicy;
}

/** Declares the dependency manifest with full type checking on every entry. */
export function defineDependencies(entries: Record<string, ManifestEntry>): Record<string, ManifestEntry> {
  return entries;
}

/** The dependency manifest — the single source of truth for emitted dependencies. */
export const dependencyManifest = defineDependencies({
  nextrush: { scope: 'dependency', resolve: 'latest-compatible' },

  // Node/Bun need `dotenv` because `@nextrush/dev`'s `Bun.spawn` bypasses Bun's native
  // auto-load. Deno is native (`Deno.env`), so it gets no loader.
  dotenv: { scope: 'dependency', runtimes: ['node', 'bun'], resolve: 'toolchain' },

  // `@nextrush/class` is an OPTIONAL peer of `nextrush`, so class-based/full projects must
  // declare it explicitly; `reflect-metadata` is auto-imported by `nextrush/class` but kept
  // explicit so it resolves (framework-composition-integrity).
  '@nextrush/class': { scope: 'dependency', templates: ['class-based', 'full'], resolve: 'latest-compatible' },
  'reflect-metadata': { scope: 'dependency', templates: ['class-based', 'full'], resolve: '>=0.2.0' },

  '@nextrush/dev': { scope: 'devDependency', resolve: 'latest-compatible' },
  '@nextrush/types': { scope: 'devDependency', resolve: 'latest-compatible' },
  typescript: { scope: 'devDependency', resolve: 'toolchain' },
  vitest: { scope: 'devDependency', resolve: 'toolchain' },

  // Deno ships its own globals — `@types/node` would inject Node's `process`/`Buffer`
  // into a Deno project.
  '@types/node': { scope: 'devDependency', runtimes: ['node', 'bun'], resolve: 'toolchain' },
});

/** Every package name the resolver must probe — derived from the manifest keys. */
export function getManifestPackageNames(): string[] {
  return Object.keys(dependencyManifest);
}
