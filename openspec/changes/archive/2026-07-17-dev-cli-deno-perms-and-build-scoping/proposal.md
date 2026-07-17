## Why

Two `@nextrush/dev` papercuts block real projects and have no formal seam today (source-verified, gap-checklist T043 + T044):

1. **Deno permissions are hardcoded.** `nextrush dev`/`build` spawns Deno with a fixed `--allow-net --allow-read --allow-env` set (`packages/dev/src/runtime/spawn.ts`, `buildDevArgs`). A Deno app that legitimately needs `--allow-write`, `--allow-ffi`, `--allow-run`, etc. simply cannot run under the CLI — there is no escape hatch.
2. **The build file scan is not workspace-aware.** The recursive scan can cross package boundaries in a pnpm/Turborepo workspace and compile sibling packages' files. NextRush itself is a monorepo, so this is a first-party correctness risk, not a hypothetical.

Both are cheap, additive fixes that make the CLI usable in the two environments (permission-hungry Deno apps, monorepos) where it currently misbehaves.

## What Changes

- **Configurable Deno permissions (T043):** add a way to *extend* (not replace) the default Deno permission set via config and/or a CLI flag. The existing `--allow-net --allow-read --allow-env` defaults stay exactly as-is when no extra permissions are configured. Additive, non-breaking.
- **Workspace-aware build scoping (T044):** constrain the build's recursive source scan to the current package boundary so sibling workspace packages are never pulled into the compile. Document the monorepo scoping behavior. Additive, non-breaking (single-package projects are unaffected).
- No change to the public/CLI API shape beyond one additive option per feature; no change to the SWC transpile path; no new runtime dependency.

## Capabilities

### New Capabilities
- `dev-deno-permissions`: configurable, additive Deno permission set for `nextrush dev` and `nextrush build`, with the current fixed set as the default.
- `dev-workspace-build-scoping`: workspace/package-boundary-aware scoping of the build's recursive file scan, with documented monorepo behavior.

### Modified Capabilities
<!-- None. No existing spec covers Deno permissions or build file scoping; both are net-new dev-CLI capabilities. -->

## Impact

- **Package:** `@nextrush/dev` only.
- **Code:**
  - `packages/dev/src/runtime/spawn.ts` (`buildDevArgs`, and its Deno-arg assembly) — merge configured extra permissions into the default set.
  - The build command's file-scan path (`packages/dev/src/commands/build.ts` and the scan helper it calls) — enforce the package boundary.
  - Config surface (`packages/dev/src/utils/config.ts`) — a place to declare extra Deno permissions and (if needed) scan-scope options.
  - Tests: extend the existing `packages/dev/src/__tests__/deno-permissions.test.ts`; add a workspace-scoping build test.
  - Docs: `@nextrush/dev` README + dev docs (permissions escape hatch, monorepo build semantics).
- **APIs/dependencies:** no new runtime dependency; no breaking API change; defaults preserved.
- **Out of scope (deferred):** T042 (`Transpiler` interface) — the SWC coupling is already isolated to ~2 functions in `runtime/node-modules.ts`; a formal seam is YAGNI until a second transpiler is real.
