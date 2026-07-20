## Why

A deep toolchain review of `@nextrush/dev` (`report/dev/dev-tooling-review.md`, commit `ef95e3f`)
found the package architecturally sound but shipping real correctness bugs behind a green test
suite: line coverage is 39.79% (repo rule: 90%) with **0%** on the dev-server, SWC-builder,
Deno-builder, and Bun-builder — exactly where the defects live. The dev toolchain is also the one
piece of NextRush with **no capability spec at all**, so "what does the tooling guarantee?" is
currently unanswerable. This change establishes that contract and fixes the defects it exposes.

## What Changes

- **Deno production build correctness** — the Deno builder passes `TypeScriptFile` objects to
  `node:path` string APIs (throws at runtime), yet is advertised "Stable". Fix to use
  `file.path`/`file.ext` + shared extension mapping, matched by a Deno build integration test.
- **Incremental cache survives `--clean`** — the cache lives inside `outDir`, which `--clean`
  (default) wipes first, so it never survives. Relocate it so `clean` and `cache` are orthogonal.
- **Declaration emit decoupled from decorator metadata** — `--no-decorator-metadata` currently
  drops all `.d.ts` output silently; gate `.d.ts` on `--dts` only, with `.d.ts`/`.js` layout parity.
- **Type-safe access to Node built-ins** — `import(NODE_*)` variable specifiers type `fs`/`path`/
  `child_process` as `any`, blinding `tsc` (this is why the Deno bug compiled clean). Restore types.
- **Verified dev-server startup & lifecycle** — the dev integration test asserts a banner printed
  *before* spawn, never a live server. Assert an HTTP response + restart-on-change; await child
  exit and report/mirror child crashes on shutdown.
- **Portable, guarded file watching** *(behavior change)* — default Node dev to bare `--watch`
  (portable) and use `--watch-path` only for explicit `--watch <path>`, guarded with a fallback.
- **Actionable diagnostics** — a missing target runtime binary yields a raw `spawn … ENOENT`;
  pre-flight and give guidance. Loader path uses first-`/dist/` (`indexOf`) → misresolves under a
  `dist`-named ancestor; use `lastIndexOf`.
- **AST-based codemod** — `consolidate-imports` (regex) relocates license headers below imports
  and reorders unrelated imports; reimplement on the already-present SWC AST.
- **Reproducible toolchain deps** — remove the unused `tsx` dependency; pin `@swc/core` /
  `@swc-node/register` to tight ranges for reproducible builds.
- **CPU-scaled build concurrency** — build concurrency is hardcoded to 4 (`getDefaultConcurrency`
  never runs in ESM); scale to available parallelism, measurement-gated.
- **Verified Bun build metadata & cross-runtime path parity** — add a Bun decorator-metadata
  conformance test (or soften the "verified" claim); share one path semantics across runtimes.
- **Docs sync** — rewrite `packages/dev/ARCHITECTURE.md` to match the implementation (it documents
  `tsx`/`--experimental-strip-types` and Deno `--allow-all`, none of which the code uses).

No public programmatic-API signatures (`dev()`, `build()`, exported types) change. The watch-default
and `.d.ts`-gating shifts are observable CLI **behavior changes**, documented, not signature breaks.

## Capabilities

### New Capabilities
- `dev-tooling`: The `@nextrush/dev` local-development lifecycle contract — the CLI (`dev`,
  `build`, `generate`, `codemod`), the SWC-everywhere compilation/decorator-metadata guarantee,
  cross-runtime process spawning, native-watcher-based auto-restart, the incremental build cache,
  declaration emission, and the toolchain's diagnostics/verification bar. *Justification for a new
  capability (not requirements added to an existing one):* none of the fixed 16 own the dev
  server or build pipeline — the closest, `adapter-development-kit`, owns only the
  `generate adapter` scaffolder slice. The registry already contains tooling/CI capabilities
  (`performance-gate`, `runtime-proof-harness`, `public-surface-lock`, `adapter-development-kit`),
  so a durable `dev-tooling` capability fits the established pattern and fills a genuine,
  long-lived gap rather than a change-shaped one.

### Modified Capabilities
- _None._ (`adapter-development-kit` is left untouched; this change does not alter the
  `generate adapter` scaffolder or the conformance entrypoint it owns.)

## Impact

- **Package:** `@nextrush/dev` — `commands/dev.ts`, `commands/build.ts` and `commands/build/*`
  (`swc-builder`, `deno-builder`, `bun-builder`, `cache`, `concurrency`), `runtime/*`
  (`spawn`, `fs`, `node-modules`), `codemods/consolidate-imports.ts`, `utils/config.ts`,
  `package.json`, `ARCHITECTURE.md`, `README.md`.
- **Tests:** new liveness/restart dev integration test, Deno & Bun build integration tests, and
  command/build-layer unit coverage toward the 90% bar.
- **Dependencies:** remove `tsx`; pin `@swc/core` / `@swc-node/register`.
- **Runtimes:** Node (primary), Bun, Deno — cross-runtime behavior parity is part of the contract.
- **RFC gate:** introducing the `dev-tooling` capability is RFC-gated. An RFC in `docs/RFC/`
  establishing the capability's scope and durable architecture (SWC-everywhere for decorator
  metadata, native-watcher auto-restart over HMR, local-`tsc` for declarations, the cross-runtime
  loader-resolution strategy) MUST land before implementation is archived. Source review:
  `report/dev/dev-tooling-review.md`.
