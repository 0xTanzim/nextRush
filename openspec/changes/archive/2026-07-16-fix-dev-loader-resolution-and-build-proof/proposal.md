## Why

`nextrush dev` is broken end-to-end on every platform right now — not a Windows/macOS-specific
gap, a universal one. Diagnosed directly against source and a real reproduction during this
session (not carried forward from any audit): running `nextrush dev` against a fresh fixture
fails immediately with `ERR_MODULE_NOT_FOUND` for `packages/dev/loaders/swc-loader.mjs` — a path
missing its `dist/` segment entirely.

Root cause traced to the actual bundled artifact, not the source: `packages/dev/src/runtime/node-modules.ts`'s
`resolveLoaderFromUrl()` computes `../loaders/swc-loader.mjs` relative to its own `import.meta.url`,
correctly assuming it runs from `dist/runtime/node-modules.js` (one directory under `dist/`). But
the package's actual CLI entry point (`bin/nextrush.js` → `dist/cli.js`) is built as a single
flattened bundle — `dist/cli.js` inlines `resolveLoaderFromUrl` directly (confirmed at line 109 of
the built file, with a `// src/runtime/node-modules.ts` source-marker comment), so at the real
call site `import.meta.url` is `dist/cli.js`'s own URL — zero directories under `dist/`, not one.
The hardcoded `../loaders/` climbs one level too many, landing at `packages/dev/loaders/` (which
doesn't exist) instead of `packages/dev/dist/loaders/` (which does).

This must be fixed before any build-integration test (T013) is written, since T013 would either
assert against currently-broken `dev` behavior or need its own workaround for the same bug —
fixing the root cause first means T013's test suite validates real, correct behavior.

Once fixed, this change also closes the two remaining Phase 1 P1 "build proof" tasks that are
adjacent to the same subsystem: T012's residual scope (a core-bundle size budget, distinct from
the edge bundle budget already shipped) and T013 (the e2e build-integration test, previously
blocked on T004, now unblocked since T004 closed this same day).

## What Changes

- Fix `resolveLoaderFromUrl()` (or its call sites) so loader-path resolution is correct
  regardless of whether the calling code ends up in a bundler-flattened single file (`cli.js`) or
  an unflattened per-module file (`runtime/node-modules.js`) — see design.md for the resolution
  strategy (package-root-relative resolution via `import.meta.resolve` or an explicit anchor,
  rather than a hardcoded relative-directory climb that assumes a specific bundle shape).
- Add a regression test that runs the actual built CLI (not just the unit-level function) against
  a fixture, so a future bundler-shape change that reintroduces this class of bug is caught
  before it reaches a published package.
- Add a CI size-limit check for the general functional **core** bundle (distinct from the
  already-shipped edge-bundle budget), closing T012's residual scope.
- Add an end-to-end build-integration test for `@nextrush/dev`: compile a fixture via
  `nextrush build` and assert the JS output, `.d.ts` files, sourcemaps, and correct extension
  mapping are all present and correct — closing T013.
- **BREAKING**: None. This corrects a currently-broken code path (`nextrush dev` does not work
  today); fixing it changes "fails immediately" to "works," which is a bug fix, not a behavior
  change to any working contract.

## Capabilities

### New Capabilities

- `dev-loader-path-resolution`: The requirement that `nextrush dev`'s SWC-loader path resolution
  is correct regardless of the built package's bundle shape (flattened single-file vs.
  per-module), verified against the actual built CLI artifact, not only the unit-level function.
- `core-bundle-size-budget`: The requirement that CI measures and gates the general functional
  core bundle's size (distinct from the already-shipped edge-specific budget), per T012's
  residual scope.
- `dev-build-e2e-integration`: The requirement that `nextrush build`'s output (JS, `.d.ts`,
  sourcemaps, extensions) is verified end-to-end against a real fixture in CI, per T013.

### Modified Capabilities

- None. No existing `openspec/specs/*` capability governs dev-server loader resolution, core
  bundle budgets, or build e2e verification.

## Impact

- **Affected code:** `packages/dev/src/runtime/node-modules.ts` (the fix), `packages/dev/src/runtime/spawn.ts`
  (call site, if the fix changes the function's contract), `packages/dev/tsup.config.ts` or
  equivalent build config (if the fix instead changes how `cli.js` is bundled — see design.md for
  which approach is chosen), CI workflow config (core bundle budget), and a new/extended e2e test
  file for the build-integration check.
- **Affected docs:** None expected, unless the fix changes any documented CLI behavior (it
  should not — from a user's perspective, `nextrush dev` goes from "broken" to "works as
  documented").
- **Dependencies:** T013 depends on T004 (☑, closed). The loader-resolution bug fix has no
  formal dependency but must land before T013's test is written, since the test target must be
  correct for the test to validate anything meaningful (sequencing enforced via task order in
  tasks.md, not an OpenSpec dependency).
- **Systems:** None beyond the packages listed above. This is a Node.js CLI tooling fix with no
  runtime/production-server impact — `@nextrush/dev` is a devDependency, never shipped to
  production alongside application code.
