import {
  ADAPTER_PACKAGE_NAMES,
  getAdapterPackages,
  getMiddlewarePackages,
  MIDDLEWARE_PACKAGE_NAMES,
  MIN_NODE_MAJOR,
} from '../constants.js';
import { getPackageRange } from '../version-store.js';
import type { DependencySet, MiddlewarePreset, PackageManager, ProjectOptions, Runtime } from '../types.js';

/**
 * Every `@nextrush/*` package name across ALL offered styles/runtimes/middleware presets —
 * used at CLI startup so the CLI can resolve every version it might need up front, before the
 * user's answers are known (task 3.2).
 */
export function getAllPossiblePackageNames(): string[] {
  const names = new Set<string>([
    'nextrush',
    '@nextrush/dev',
    '@nextrush/types',
    '@nextrush/class',
  ]);
  for (const preset of Object.keys(MIDDLEWARE_PACKAGE_NAMES) as MiddlewarePreset[]) {
    for (const pkgName of MIDDLEWARE_PACKAGE_NAMES[preset]) {
      names.add(pkgName);
    }
  }
  for (const pkgName of Object.values(ADAPTER_PACKAGE_NAMES)) {
    if (pkgName) names.add(pkgName);
  }
  return [...names];
}

/** Resolves the dependency sets for a project configuration. */
export function getDependencies(options: ProjectOptions): DependencySet {
  const dependencies: Record<string, string> = {
    nextrush: getPackageRange('nextrush'),
  };

  const needsReflectMetadata = options.style === 'class-based' || options.style === 'full';

  // reflect-metadata is auto-imported by the nextrush meta-package's `nextrush/class` subpath,
  // but we keep it as an explicit dependency so it's resolvable. `@nextrush/class` itself is an
  // OPTIONAL peer dependency of `nextrush` (framework-composition-integrity) — a class-based or
  // full project must add it explicitly, or `nextrush/class` fails to resolve.
  if (needsReflectMetadata) {
    dependencies['reflect-metadata'] = '>=0.2.0';
    dependencies['@nextrush/class'] = getPackageRange('@nextrush/class');
  }

  // Middleware packages — each resolved to its OWN version, never a shared proxy range.
  const middlewareDeps = getMiddlewarePackages()[options.middleware];
  Object.assign(dependencies, middlewareDeps);

  // Runtime adapter packages (node uses built-in, others need adapters) — same per-package rule.
  const adapterDeps = getAdapterPackages()[options.runtime];
  Object.assign(dependencies, adapterDeps);

  const devDependencies: Record<string, string> = {
    '@nextrush/dev': getPackageRange('@nextrush/dev'),
    '@nextrush/types': getPackageRange('@nextrush/types'),
    typescript: getToolchainRange('typescript'),
    vitest: getVitestRange(),
  };

  // @types/node is Node-specific — Deno ships its own global types (via `deno.json` lib +
  // its native type system), and installing `@types/node` would inject Node's `process` /
  // `Buffer` globals into a Deno project and conflict with Deno's own globals.
  // capability-exempt: scaffolding tool emits runtime-specific project files from user choice,
  // not the executing runtime. `options.runtime` is a scaffold-time decision.
  if (options.runtime !== 'deno') {
    devDependencies['@types/node'] = getToolchainRange('@types/node');
  }

  return { dependencies, devDependencies };
}

/** Resolves the generated project's `vitest` devDependency from the scaffolder's own pinned version. */
function getVitestRange(): string {
  return typeof __VITEST_RANGE__ !== 'undefined' ? __VITEST_RANGE__ : '^3.0.0';
}

declare const __VITEST_RANGE__: string;

declare const __TYPESCRIPT_RANGE__: string;
declare const __TYPES_NODE_RANGE__: string;

/**
 * Single-sources the generated project's `typescript`/`@types/node` versions with the
 * scaffolder's OWN toolchain (build-time injected — see tsup.config.ts) rather than a
 * hardcoded, independently-drifting literal (fixes F-07).
 *
 * `@types/node`'s major is additionally capped at the declared `engines.node` floor: the
 * scaffolder's own `devDependencies` may legitimately track a NEWER Node types major than
 * the framework floor it targets (e.g. testing against next-gen Node locally), but a
 * GENERATED project's types must not claim APIs the floor it declares doesn't guarantee —
 * that mismatch is exactly what F-07 found (`@types/node ^26` against an `engines >=22`
 * floor).
 */
function getToolchainRange(pkg: 'typescript' | '@types/node'): string {
  if (pkg === 'typescript') {
    return typeof __TYPESCRIPT_RANGE__ !== 'undefined' ? __TYPESCRIPT_RANGE__ : '^5.0.0';
  }

  const rawRange = typeof __TYPES_NODE_RANGE__ !== 'undefined' ? __TYPES_NODE_RANGE__ : `^${MIN_NODE_MAJOR.toString()}.0.0`;
  const major = Number(/(\d+)/.exec(rawRange)?.[1]);
  if (Number.isFinite(major) && major > MIN_NODE_MAJOR) {
    return `^${MIN_NODE_MAJOR.toString()}.0.0`;
  }
  return rawRange;
}

/** Generates the `engines`/`packageManager` metadata block for a generated `package.json` (F-08).
 *
 * A Deno project's app itself runs on Deno, not Node — the `node` engine floor only
 * makes sense there as a *toolchain* constraint (the `@nextrush/dev`/`vitest`/`typescript`
 * devDependencies all require Node >= 22). Emitting `engines.node` on a Deno project
 * would misrepresent a Node-free app, so it's omitted (F-08's F-07-fix rationale applies
 * to Node/Bun projects, which do run on Node-class runtimes).
 */
export function getPackageMetadata(
  packageManager: PackageManager,
  runtime: Runtime
): {
  engines?: { node: string };
  packageManager?: string;
} {
  const metadata: { engines?: { node: string }; packageManager?: string } = {};

  // capability-exempt: scaffolder emits runtime-specific project files from user choice,
  // not the executing runtime. `runtime` is a scaffold-time decision.
  if (runtime !== 'deno') {
    metadata.engines = { node: `>=${MIN_NODE_MAJOR.toString()}.0.0` };
  }

  // Only emit `packageManager` for an explicitly detected/selected NON-npm manager — Corepack
  // can trip users who don't have it enabled, and npm is the safe universal default (design.md
  // risk mitigation).
  const pmVersion = getPackageManagerPinnedVersion(packageManager);
  if (pmVersion) {
    metadata.packageManager = `${packageManager}@${pmVersion}`;
  }

  return metadata;
}

function getPackageManagerPinnedVersion(pm: PackageManager): string | undefined {
  switch (pm) {
    case 'pnpm':
      return '10.0.0';
    case 'yarn':
      return '4.0.0';
    case 'bun':
      return '1.3.14';
    case 'npm':
      return undefined;
  }
}

/** Runtime-specific dev/build/start scripts for a generated `package.json`. */
export function getRuntimeScripts(runtime: Runtime): {
  readonly dev: string;
  readonly build: string;
  readonly start: string;
  readonly test: string;
} {
  // No `nextrush test` subcommand exists on @nextrush/dev's CLI (see packages/dev/src/cli.ts) —
  // generated projects run their tests directly through vitest, consistent with every
  // workspace package's own `test` script (fixes F-16: a `test` script + example test).
  const test = 'vitest run';

  switch (runtime) {
    case 'bun':
      return {
        dev: 'bun nextrush dev',
        build: 'bun nextrush build',
        start: 'bun dist/index.js',
        test,
      };
    case 'deno':
      // Routed through `nextrush dev`/`nextrush build` — NOT a raw `deno run` against the
      // entry file — so decorator metadata is emitted consistently with node/bun (fixes
      // F-02). The permission set below is explicit and scoped (never blanket `-A`):
      // `@nextrush/dev`'s Deno build path reads/writes the project tree, spawns `npx` for
      // decorator-metadata transpilation, reads env for config, and needs net access to
      // resolve `npm:` specifiers — dev-tooling owns the Deno metadata guarantee this
      // script reaches into via `npm:nextrush` (unpinned specifier, no `@latest`, so the
      // devDependency version this scaffold pinned is the version that actually runs).
      return {
        dev: 'deno run --allow-net --allow-read --allow-write --allow-env --allow-run --unstable-sloppy-imports npm:nextrush dev',
        build: 'deno run --allow-net --allow-read --allow-write --allow-env --allow-run --unstable-sloppy-imports npm:nextrush build',
        start: 'deno run --allow-net --allow-read --allow-env dist/index.js',
        test,
      };
    case 'node':
      return {
        dev: 'nextrush dev',
        build: 'nextrush build',
        start: 'node dist/index.js',
        test,
      };
  }
}
