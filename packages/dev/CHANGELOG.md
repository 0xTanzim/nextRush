# @nextrush/dev

## 1.0.0

### Patch Changes

- [`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Consolidated patch release across all NextRush public packages.

## 1.0.0-beta.2

### Patch Changes

- Consolidated patch release across all NextRush public packages.

## 1.0.0-beta.0

### Minor Changes

- 6f1d4a5: Two additive `@nextrush/dev` CLI improvements (gap-checklist T043/T044):

  **Configurable Deno permissions.** `nextrush dev` under Deno previously spawned with a
  hardcoded, fixed permission set (`--allow-net --allow-read --allow-env`) — a Deno app
  needing anything more (`--allow-write`, `--allow-ffi`, `--allow-run`, scoped forms like
  `--allow-read=./data`) simply could not run under the CLI. `nextrush.config.ts` now
  accepts `dev.deno.permissions: string[]`, which is **merged into** the default set,
  deduplicated — it never replaces it, so the defaults are byte-identical when nothing is
  configured. Each configured value must begin with `--allow-` or `--deny-`; an invalid
  value fails the command before Deno is ever spawned, naming the offending value.

  **Workspace-aware build scoping.** `nextrush build`'s recursive TypeScript file scan now
  resolves its scan root to the nearest enclosing `package.json` directory (walking upward
  from the entry file's own directory) and excludes any subdirectory inside that tree that
  carries its own `package.json` — a nested or vendored package is never pulled into the
  current package's build output, and a sibling package in a pnpm/npm/Turborepo workspace
  is excluded because the scan never ascends above the resolved boundary. Single-package
  projects, and projects with no `package.json` anywhere above the entry, are unaffected
  (falls back to the entry-directory-rooted scan used before this feature).

  Both changes are additive and non-breaking: no new runtime dependency, no change to
  existing defaults, no change to the SWC transpile path.

### Patch Changes

- 7379be6: `nextrush build` now validates decorator-metadata emission configuration
  (`experimentalDecorators` / `emitDecoratorMetadata` in `tsconfig.json`) before completing, and
  fails fast with remediation text when the two flags are mismatched — instead of silently shipping
  a build that would only fail later, at DI-resolution time, with a `TypeInfo not known for X`
  error.

  A project with neither flag set (functional, decorator-free) is unaffected. A project with both
  flags correctly set is unaffected. Only a project that already had a broken decorator-metadata
  config — previously a silent, deferred failure — now fails at build time instead, with the same
  remediation text `nextrush dev`'s existing warning already used. `nextrush dev` itself is
  unchanged: it still warns and continues rather than exiting, since an active dev session
  shouldn't hard-stop on a config warning.

  See `packages/di/README.md`'s "TypeInfo not known for X" troubleshooting entry for the full
  before/after behavior.

- e791384: `nextrush dev` no longer fails immediately with `ERR_MODULE_NOT_FOUND` when invoked through the
  package's real CLI entry point (`bin/nextrush.js` → `dist/cli.js`).

  The SWC-loader path resolution used by `nextrush dev` assumed a fixed directory depth relative to
  its own module's `import.meta.url` (one directory under `dist/`), which was only ever correct for
  the pre-bundle source layout. Because `tsup.config.ts` builds each CLI entry point as a separate,
  non-split bundle, the resolution code ends up inlined directly into `dist/cli.js` — zero
  directories under `dist/` — and the old hardcoded relative climb landed at a directory that
  doesn't exist. `nextrush dev` now resolves the loader relative to the package root instead of
  assuming a specific bundle depth, so it works correctly regardless of which entry point's bundle
  the resolution code is inlined into.

  The existing dev-mode (non-`dist`) source fallback path is unchanged.

## 3.0.7

### Patch Changes

- [#26](https://github.com/0xTanzim/nextRush/pull/26) [`c9723dd`](https://github.com/0xTanzim/nextRush/commit/c9723ddb29e4bf834625f294eadb0c9e1c28432e) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Simplify template code and auto-install dev package

## 3.0.6

### Patch Changes

- [#23](https://github.com/0xTanzim/nextRush/pull/23) [`9f1d44e`](https://github.com/0xTanzim/nextRush/commit/9f1d44ebc7807955a5d218c2b52a228911a06236) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Fix CLI install reliability:
  - Ensure the `nextrush` meta-package never declares a `bin` entry (prevents pnpm bin-link conflicts).
  - Ensure `@nextrush/dev` always builds before publish so `nextrush`/`nextrush-dev` binaries work.
  - Add a repo-wide bin validator to catch missing `bin` targets during verification.
  - Scaffold projects with `nextrush dev` / `nextrush build` scripts (no `npx`).
  - Include `@nextrush/dev` in scaffolded dev dependencies so fresh installs expose the local CLI.

## 3.0.5

### Patch Changes

- [#21](https://github.com/0xTanzim/nextRush/pull/21) [`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

## 3.0.4

### Patch Changes

- Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

## 3.0.3

### Patch Changes

- Patch **3.0.3**: **`nextrush`** ships the **`nextrush`** CLI via **`@nextrush/dev`**; **`@nextrush/dev`** skips false-positive decorator `tsconfig` warnings on functional scaffolds; **`create-nextrush`** / docs / plugin metadata aligned to **3.0.3**.

## 3.0.1

### Patch Changes

- [#15](https://github.com/0xTanzim/nextRush/pull/15) [`6c37c2f`](https://github.com/0xTanzim/nextRush/commit/6c37c2f1a60c24eda5fba50c7543627104fb776c) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Sync package metadata and documentation URLs, and ensure package-level homepage/readme publishing metadata is consistent across released packages.
