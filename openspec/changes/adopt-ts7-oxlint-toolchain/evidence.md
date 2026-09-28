# adopt-ts7-oxlint-toolchain — verification evidence

Planning-time facts recorded **2026-09-28**, before implementation. Task results are appended to the
tables below as each group lands (tasks 1.1, 2.9, 3.1, 3.11, 6.4 read and extend this file).

## Registry facts (source: npm registry, read 2026-09-28)

| Package | Version | Published (UTC) | Relevance |
| --- | --- | --- | --- |
| `typescript` | 7.0.2 (`latest`) | 2026-07-08T15:55Z | 81 days old → **not** blocked by the 7-day release-age quarantine |
| `oxlint` | 1.85.0 (`latest`) | 2026-09-21T15:32Z | younger than 7 days → quarantined until 2026-09-28T15:32Z |
| `oxlint` | 1.83.0 | 2026-09-14T12:12Z | 13 days old → **quarantine-clean** (chosen for the initial landing) |
| `oxlint-tsgolint` | 7.0.2003 (`latest`) | 2026-09-24T15:18Z | younger than 7 days → quarantined until 2026-10-01T15:18Z |
| `oxlint-tsgolint` | 7.0.2002 | 2026-09-18T04:01Z | 9 days old → **quarantine-clean** (chosen for the initial landing) |
| `typescript-eslint` | 8.70.1 (`latest`) | 2026-09-21 | `peerDependencies.typescript: ">=4.8.4 <6.1.0"` — the hard block |
| `eslint` | 10.11.0 (`latest`) | — | TS 7 support still blocked upstream (eslint/eslint#21070) |

Quarantine reference: `pnpm-workspace.yaml` sets `minimumReleaseAge: 10080` (7 days) with no
`minimumReleaseAgeExclude` entry. Cutoff at planning time was **2026-09-21T02:57Z**.

## TypeScript 7 package layout (source: registry manifest for `typescript@7.0.2`)

| Field | TypeScript 6.0.3 | TypeScript 7.0.2 | Consequence |
| --- | --- | --- | --- |
| `bin` | `{ tsc, tsserver }` | `{ tsc: "bin/tsc" }` | the `tsc` key the declaration pass resolves still exists; `tsserver` is gone |
| native binaries | none | 20 `optionalDependencies` (`@typescript/typescript-<platform>`, all `7.0.2`) | the compiler is fetched per platform; an unsupported platform has no compiler |
| module format | CommonJS-oriented | `type: "module"`, **no `main`** | an ESM-only package — any CommonJS `require("typescript")` in the workspace breaks |
| `exports` | — | includes `./package.json` | `require("typescript/package.json")` (the declaration pass's resolution) still works |

## Repository facts

| Fact | Evidence |
| --- | --- |
| 21 package `lint` scripts run the previous linter | `packages/*/package.json`, `packages/*/*/package.json`, `apps/website/package.json` |
| The `verify` aggregate is `build` → `test` + `typecheck` + `lint` | `turbo.json` (`verify.dependsOn`) |
| 89 `eslint-disable*` directives (70 `-next-line`, 4 `eslint-enable`) across 51 files | measured by grep over `packages/`, `scripts/`, `tools/` |
| `@nextrush/dev` has no runtime `typescript` dependency | `packages/dev/package.json` declares only `@swc/core` + `@swc-node/register`; no `typescript` import exists in `packages/dev/src` |
| The declaration pass resolves and spawns the compiler's own bin | `packages/dev/src/commands/build/declaration-builder.ts` (`resolveTscPath()` → `bin.tsc`, spawned through `node:child_process`) |
| **Generated production-preset lint config imports undeclared packages** (pre-existing defect) | `packages/create-nextrush/src/templates/preset.ts` emits `eslint.config.mjs` importing `@eslint/js` + `typescript-eslint`; `packages/create-nextrush/src/dependency-manifest.ts` declares `typescript`/`@types/node`/`vitest`/`dotenv` only — neither import is ever declared in the generated manifest |
| The generated compiler range has a hardcoded fallback on the previous major | `packages/create-nextrush/src/templates/package-json.ts` (`getToolchainRange('typescript')` fallback literal) |

## Phase results

### Group 1 — spike and rule-parity map (tasks 1.1, 1.3, 1.6)

| Check | Command | Result |
| --- | --- | --- |
| Lint baseline (finding set + wall-time) | _task 1.1_ | ⬜ not yet recorded |
| Pinned pair produces type-aware diagnostics | _task 1.3_ | ⬜ not yet recorded |
| Type-aware wiring under the per-package turbo invocation | _task 1.6_ | ⬜ not yet recorded |

### Group 2 — lint cutover (task 2.9)

| Check | Command | Result |
| --- | --- | --- |
| Post-cutover lint wall-time vs baseline | _task 2.9_ | ⬜ not yet recorded |
| Cross-adapter conformance parity (task 2.8) | `pnpm --filter @nextrush/adapter-conformance test` | ⬜ not yet recorded |

### Group 3 — compiler bump (tasks 3.1, 3.11)

| Check | Command | Result |
| --- | --- | --- |
| Pre-bump typecheck wall-time (uncached) | _task 3.1_ | ⬜ not yet recorded |
| Post-bump typecheck wall-time (uncached) | _task 3.11_ | ⬜ not yet recorded |
| Declaration pass under the native compiler | `packages/dev` build/declaration tests | ⬜ not yet recorded |

### Group 6 — integration verification (task 6.4)

| Check | Command | Result |
| --- | --- | --- |
| Full uncached `verify` | `pnpm verify` | ⬜ not yet recorded |
| Generate-then-install matrix | `create-nextrush` matrix gate | ⬜ not yet recorded |
| Repository rule + typed rules still enforced after the cutover | spot-check of one finding of each kind | ⬜ not yet recorded |
