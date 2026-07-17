## Context

`@nextrush/dev` is the CLI (dev server, production build, generators). Two behaviors are hardcoded today, confirmed against source:

- **Deno permissions:** `buildDevArgs` in `packages/dev/src/runtime/spawn.ts` assembles a fixed `--allow-net --allow-read --allow-env` list before `spawnDeno` launches the subprocess. `spawnDeno` itself is permission-agnostic — it just forwards `args`. There is already a `packages/dev/src/__tests__/deno-permissions.test.ts` guarding the current set.
- **Build scan:** `nextrush build` (`packages/dev/src/commands/build.ts`) recursively discovers source files from a root. In a workspace it can descend into or ascend across sibling packages.

Both are `@nextrush/dev`-internal. The framework's zero-dependency rule (project-rules §6) and runtime-independence (adapters own platform specifics) still apply, but neither feature needs a new dependency or touches core/adapters.

## Goals / Non-Goals

**Goals:**
- Let a project add Deno permissions beyond the default set, keeping the current defaults byte-identical when nothing is configured.
- Keep the build's file scan inside the current package's boundary in a workspace, without coupling to any specific workspace manager.
- Stay additive and non-breaking; no new runtime dependency.

**Non-Goals:**
- Replacing or removing default Deno permissions (extend-only; a full override mode is out of scope).
- Modeling every Deno permission as typed config (pass-through strings instead — see Decisions).
- Reading workspace topology from pnpm-workspace.yaml / `workspaces` globs (boundary is detected structurally, not from a manager).
- T042's `Transpiler` interface — explicitly deferred (YAGNI; SWC is already isolated).

## Decisions

### D1 — Deno permissions: extend, never replace
Configured permissions are **merged into** the default `--allow-net --allow-read --allow-env` set, deduplicated, never substituted for it.
- **Why:** the acceptance bar is "defaults unchanged." Extend-only is the least-surprise behavior and prevents a project from accidentally dropping a permission the CLI relies on. Broadening the sandbox is an explicit, opt-in act by the app author.
- **Alternative considered:** a replace/override mode (`permissions` fully replaces defaults). Rejected as a footgun for a P3 escape hatch; can be layered on later if a real need appears.

### D2 — Permission config shape: pass-through flag strings, validated
Accept raw Deno permission flag strings (e.g. `"--allow-write"`, `"--allow-read=./data"`, `"--allow-ffi"`) under a `deno` namespace in the dev config, validated to begin with `--allow-`/`--deny-`.
- **Why:** forward-compatible with Deno's evolving and *scoped* permission forms (`--allow-read=<path>`) without the CLI having to model each one. Simplest thing that fully unblocks the use case.
- **Alternative considered:** typed booleans/objects per permission (`{ allow: { write: true, ffi: ['./native'] } }`). Better autocomplete, but forces `@nextrush/dev` to track Deno's permission surface as it changes — ongoing maintenance for marginal DX on an escape-hatch feature. Typed sugar can be added later over the same pass-through core.
- **CLI flag:** an optional `--deno-allow` passthrough is a nice-to-have, deferred to implementation; config is the primary surface.

### D3 — Build boundary: nearest-`package.json`, structural detection
Resolve the scan root to the directory of the nearest `package.json` for the build target, and exclude any nested subdirectory that has its **own** `package.json` (plus the existing `node_modules` exclusion). Do not ascend above that boundary.
- **Why:** deterministic, matches how a package is conventionally delimited, and works identically under pnpm/npm/yarn/Turborepo because it reads structure, not manager config.
- **Alternative considered:** parse `pnpm-workspace.yaml` / root `workspaces`. Rejected: couples `@nextrush/dev` to specific managers and adds parsing/complexity for no additional correctness over the structural rule.

### D4 — Additive by default
No configuration and no workspace ⇒ behavior is identical to today. Single-package projects and non-Deno runtimes are entirely unaffected.

## Risks / Trade-offs

- **Over-broad permissions weaken Deno's sandbox** → docs state plainly that adding permissions (especially `--allow-all`) reduces isolation; the CLI never defaults to anything broader than today and never auto-adds `--allow-all`.
- **Invalid permission string reaching Deno** → validate the prefix and fail fast with a non-zero exit and a message naming the offending value, before spawning Deno.
- **Boundary detection misfires on unusual layouts** (entry outside any package, or no `package.json`) → documented fallback to the current cwd-rooted behavior; covered by a test.
- **A legitimate subdirectory that carries its own `package.json` gets excluded** → this is intended (it *is* a separate package); documented so it isn't surprising.

## Migration Plan

Additive; no consumer migration required. Ship a `@nextrush/dev` changeset (patch/minor — user-visible new behavior). Rollback is a plain revert; no persisted state or contract change.

## Open Questions

- Final config key naming under the `deno` namespace (`permissions` vs `allow`) — resolve during implementation; pass-through string array is the agreed core.
- Whether to also ship the `--deno-allow` CLI flag in this change or defer it — default to config-only unless trivial.
