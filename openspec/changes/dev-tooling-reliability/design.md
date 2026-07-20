## Context

`@nextrush/dev` is the single package developers use for the whole local lifecycle (scaffold, run,
build, migrate). The review (`report/dev/dev-tooling-review.md`, commit `ef95e3f`) found the
architecture sound but the verifier weak: 208 tests pass green while line coverage is 39.79% and
the dev-server, SWC-builder, Deno-builder, and Bun-builder sit at 0% — the exact files carrying the
shipped defects (broken Deno build, dead-by-default cache, mis-gated `.d.ts`). A type-safety hole
(`import(NODE_*)` variable specifiers typed `any`) let a runtime type error compile clean.

This design implements the new `dev-tooling` capability contract and fixes the defects it exposes.
The capability is RFC-gated; the governing RFC (`docs/RFC/`, to be authored before archive)
records the durable architecture — SWC-everywhere for decorator metadata, native-watcher
auto-restart over HMR, local-`tsc` for declarations, and the cross-runtime loader strategy. This
document does not restate that architecture; it records the decisions this change makes on top of it.

## Goals / Non-Goals

**Goals:**
- Make the toolchain's guarantees explicit and testable, and close the verification gap that let
  correctness bugs ship green.
- Fix the P1 correctness defects (Deno build, cache, `.d.ts` gating) and validate each with a test
  authored *before* the fix (RED→GREEN).
- Restore type safety on Node built-in access so `tsc` catches I/O-layer misuse again.
- Improve watch portability, shutdown/crash reporting, diagnostics, and codemod safety without
  changing public programmatic-API signatures.

**Non-Goals:**
- No HMR / state-preserving reload — auto-restart via native watchers is retained deliberately.
- No new bundler; SWC-per-file (Node/Deno) and `Bun.build` (Bun) stay.
- No change to `adapter-development-kit`'s `generate adapter` scaffolder.
- No change to `dev()`/`build()` signatures or exported types (surface stays locked).

## Decisions

**D1 — Introduce a `dev-tooling` capability rather than stretch an existing one.** None of the 16
capabilities own the dev server/build/watch pipeline; `adapter-development-kit` owns only the
scaffolder. The registry already holds tooling capabilities (`performance-gate`,
`runtime-proof-harness`, `public-surface-lock`), so this fits the pattern. *Alternative rejected:*
folding requirements into `adapter-development-kit` — would make a change-shaped misfit and leave
"what does the dev server guarantee?" unanswerable.

**D2 — Verification backstop lands FIRST.** Typed built-ins (D3) + a liveness-checked dev
integration test + Deno/Bun build integration tests are implemented before the correctness fixes,
so the fixes are validated by an independent verifier, not a self-report. This directly follows the
review's root-cause finding ("the verifier is the bottleneck"). *Alternative rejected:* fix bugs
first — would repeat the failure mode of shipping unverified fixes into 0%-coverage files.

**D3 — Typed Node built-ins via a shared accessor, keeping the anti-stripping trick.** Provide typed
wrappers in `runtime/` (e.g. `getNodeFsPromises(): Promise<typeof import('node:fs/promises')>` doing
`(await import(NODE_FS_PROMISES)) as typeof import('node:fs/promises')`). This preserves the
variable-specifier that stops esbuild/tsup rewriting the `node:` prefix (Deno needs it) *and*
restores compile-time types. *Alternative rejected:* per-call-site casts — more churn, easy to miss.

**D4 — Default Node dev to bare `--watch`; `--watch-path` only for explicit paths, guarded.**
Bare `--watch` (watches imported modules) is stable across all platforms since Node 22; the review
verified `--watch-path` works on modern Linux despite Node docs marking it macOS/Windows-only, but
the `engines` floor (`>=22.0.0`) may predate that support. So: default `--watch`; when the user
passes `--watch <path>`, use `--watch-path` guarded by platform/version with a fallback to bare
`--watch` + a one-line warning. *Alternative rejected:* keep always-`--watch-path` — relies on
vendor-documented-unsupported behavior with no fallback.

**D5 — Move the build cache out of `outDir`.** Store at `node_modules/.cache/nextrush/build-cache.json`
(already-ignored, conventional — matches Vite/tsup) so `--clean` and `--cache` are orthogonal.
*Alternative rejected:* make `clean` skip the cache subdir — fragile and surprising.

**D6 — Gate `.d.ts` on `--dts` only; pin `tsc` layout to SWC's.** Decouple declaration emission
from `decoratorMetadata`. Pass explicit `--rootDir <dirname(entry)>` to `tsc` so `.d.ts` mirrors the
SWC-stripped `.js` layout for nested sources. *Alternative rejected:* leave `tsc` to infer `rootDir`
— produces `.d.ts`/`.js` at divergent paths for multi-dir trees.

**D7 — Fix the Deno builder and cover it with a real Deno build; fall back to "experimental" if CI
can't run Deno.** Use `file.path`/`file.ext` + shared `mapExtension`; align SWC options with Node.
*Alternative rejected:* keep advertising "Stable" without Deno CI — the false claim is the problem.

**D8 — Reimplement `consolidate-imports` on the SWC AST.** `@swc/core` is already a dependency; use
it to touch only the target specifiers and preserve leading comments and non-target imports byte-for-
byte. *Alternative rejected:* a smarter regex — still lossy on headers/default/namespace imports.

**D9 — Shutdown awaits the child; a child-exit handler reports crashes.** On signal, send SIGTERM,
await exit with a bounded grace period then SIGKILL, then exit mirroring the child's code; spawn in a
process group so the grandchild app is reaped. Add `onExit` to surface crashes with a clear message.

## Risks / Trade-offs

- **Bare-`--watch` changes which files trigger a restart** (imported modules vs a directory) →
  Mitigation: `--watch <path>` still maps to directory watching; document the default's semantics.
- **Cache relocation needs no new gitignore** (`node_modules/` is ignored) but changes cache path →
  Mitigation: document; cache is non-critical (rebuild on miss).
- **Deno/Bun integration tests need those runtimes in CI** → Mitigation: gate them as
  runtime-specific CI jobs; if a runtime is unavailable, mark that build path "experimental" in docs
  rather than assert unverified stability.
- **CPU-scaled concurrency raises peak memory** → Mitigation: cap at `min(availableParallelism, 8)`;
  keep it measurement-gated (prove the rebuild speedup before committing).
- **Reintroducing types on `import(NODE_*)` could re-enable bundler prefix-stripping if done wrong**
  → Mitigation: the cast keeps the variable specifier; a `validate:esm-only`-style check plus the
  Deno build test guards against a regression.

## Migration Plan

Phased, each step single-concern and revertible (mirrors the review's migration strategy):
1. Verification backstop (D2, D3) — typed built-ins; liveness/restart dev test; Deno & Bun build tests.
2. P1 correctness (D5, D6, D7) — each lands with the now-existing failing test.
3. P2 robustness/DX (D4, D9; loader `lastIndexOf`; runtime-binary preflight).
4. Codemod (D8) and cross-runtime path parity.
5. Hygiene — remove `tsx`, pin SWC deps, rewrite `ARCHITECTURE.md`, CPU concurrency.

Rollback: any phase reverts independently; no persisted state or cross-package migration is involved.

## Open Questions

- **Minimum Node version where Linux `--watch-path` is supported?** Determines whether the `engines`
  floor is raised or the D4 guard/fallback is permanent. To confirm on the LTS matrix during phase 3.
- **Does Bun guarantee `emitDecoratorMetadata`-equivalent output across all supported Bun versions?**
  Determines keep-vs-soften for the "Bun build metadata verified" claim (drives the D7 Bun test).
- **`docs/RFC/` entry for `dev-tooling`** must be authored and approved before archive (RFC gate).
