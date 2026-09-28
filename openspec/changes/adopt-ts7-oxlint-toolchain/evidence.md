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

### Task 1.1 — lint baseline (recorded 2026-09-28)

Two baselines were captured, because `pnpm lint` (turbo) is **not** a reliable lint-only signal here.

#### Baseline A — turbo-level (`pnpm lint`)

| Run | Command | Result |
| --- | --- | --- |
| 1 | `pnpm lint` (cold, no turbo cache) | ❌ exit 1 in **1m07.8s**; `Failed: @nextrush/adapter-edge#lint` — 3 × `@typescript-eslint/no-unsafe-assignment` "Unsafe assignment of an error typed value" at `packages/adapters/edge/src/context.ts:118` (46 of 53 tasks succeeded) |
| 2 | `pnpm lint` (warm) | ❌ exit 1 in **13.2s**; `Failed: website#build` — `⨯ Another next build process is already running` |

Both failures are **artifacts, not repo defects**:

- The `adapter-edge` errors do **not** reproduce standalone: `pnpm --filter @nextrush/adapter-edge lint` exits 0. Cause: `turbo.json`'s `lint` task declares `dependsOn: ["build"]` — the **same package's** build only, not `^build` — so type-aware linting can run before a dependency package's `dist/**/*.d.ts` exists, and the unresolved type surfaces as an *error typed value*. This is a pre-existing latent race in the repo's task graph, and it is exactly the caveat the Oxc docs state for monorepos (*"Build dependent packages so `.d.ts` files are available"*).
- The `website#build` failure was caused by a concurrent run holding the Next.js build lock, not by repo state.

#### Baseline B — lint-only harness (authoritative; used for every before/after comparison)

`pnpm lint` cannot serve as an A/B measurement because it drags build tasks (including the website's Next.js build) into every comparison. Instead each of the 21 packages' **own** `lint` script runs in its own directory, with no turbo/build dependency:

```bash
bash /tmp/ts7/lint-all.sh baseline     # loops the 21 lint-script packages, times each, counts findings
```

| Metric | Baseline (run 1) | Reproduction (run 2) |
| --- | --- | --- |
| Wall time (21 packages, serial) | **52.97s** | **48.36s** |
| Packages with a `lint` script | 21 | 21 |
| Failing packages | **0** | **0** |
| Total findings | **0** | **0** |

Per-package wall times (seconds, run 1): core 2.16, create-nextrush 2.47, dev 3.24, router 2.16,
runtime 2.54, stream 1.91, types 1.85, adapters/bun 2.51, adapters/conformance 3.08, adapters/deno 2.31,
adapters/edge 2.28, adapters/nextjs 2.92, adapters/node 2.46, adapters/serverless 2.60,
extensions/events 1.94, interop/express-bridge 2.18, middleware/cookies 2.31, middleware/csrf 2.12,
middleware/openapi 2.07, middleware/validation 2.11, apps/website 5.59.

**Reproduction check:** the harness re-run reports the **same finding set** (0 findings, 0 failing packages), so the baseline is stable and fit for comparison. Wall time differs by ~9% between runs (page-cache warmth), which is why the before/after comparison uses the finding set as the hard gate and treats timing as indicative.

**Conclusion for the migration:** the linted source is **clean** (0 findings) at the package level. Any
finding the new engine reports is therefore a genuine engine delta to triage, not pre-existing lint debt.
The turbo-level `adapter-edge` race and the `lint`-task `^build` gap are pre-existing issues, recorded here
so they are not mistaken for regressions of this change.

### Group 1 — spike and rule-parity map (tasks 1.1, 1.3, 1.6)

| Check | Command | Result |
| --- | --- | --- |
| Lint baseline (finding set + wall-time) | _task 1.1_ | ✅ 0 findings / 0 failing across 21 packages; lint-only wall 52.97s (reproduction 48.36s) — see the baseline section above |
| Pinned pair installs under the quarantine | `pnpm install` + `pnpm exec oxlint --version` | ✅ `oxlint` 1.83.0 + `oxlint-tsgolint` 7.0.2002 installed; `minimumReleaseAge: 10080` unchanged and **zero** `minimumReleaseAgeExclude` entries; lockfile records the pair as `oxlint@1.83.0(oxlint-tsgolint@7.0.2002)` |
| Pinned pair produces type-aware diagnostics | _task 1.3_ | ✅ `--type-aware` reports 25 diagnostics incl. the type-aware `typescript(unbound-method)`; a scratch `no-floating-promises` violation is caught with its inferred type `Promise<number>` — see below |
| Type-aware wiring under the per-package turbo invocation | _task 1.6_ | ✅ Root-config `options.typeAware: true` chosen (no CLI flag). Proven from package cwd **and** through `turbo run lint`: a probe file surfaced `typescript(no-floating-promises)` (error) + `typescript(require-await)` (warn) and the task exited 1; probe removed, run recovers to 5/5 |
| Config translated mechanically | `npx @oxlint/migrate --type-aware --details` → `oxlint.config.ts` | ✅ 145 rules (143 translated + 2 nursery rescued). Migrator reported 5 skipped: 3 nursery, 2 unsupported, plus *"ignore list inside overrides is not supported"* — all three findings corrected in the config |
| Mechanical rule-set comparison | `compare-rules.py` (ESLint `--print-config` vs Oxlint `--print-config`) | ✅ 135 enabled (ESLint) → 134 (Oxlint): **1** gap after consolidation (`no-octal`, waived), **0** new rules introduced |
| Parity map covers the config exactly once | regex audit of `037-rule-mapping.md` | ✅ 135 rows / 135 unique / **0** missing / **0** extra / **0** duplicates — exact bijection with the ESLint enabled set |
| Type-aware rule coverage of this tsgolint build | `oxlint --rules` vs `@typescript-eslint` `requiresTypeChecking` | ✅ **60/61** present; only `naming-convention` absent (and it was never enabled by the previous config) |
| Root `.ts` config loads without stderr noise | `pnpm exec oxlint --type-aware …` (stderr captured) | ✅ stderr empty after adding `"type": "module"` to the root manifest; root-scoped `tsx` smoke tests (`validate:bins`, `validate:manifest-composition`) still pass |
| `packages/router` under the new config | `oxlint --type-aware --ignore-pattern '**/__tests__/**' src` | ✅ `Found 0 warnings and 0 errors` (150 rules, 305ms) — matches the 0-finding baseline |
| Repo rule enforced through Oxlint's JS-plugin host | _tasks 1.7, 1.9_ | ✅ The rule fires **only** because `jsPlugins` loads it: with `jsPlugins` present the probe reports `nextrush(no-runtime-identity-capability)` and exits 1; with the declaration removed, Oxlint fails configuration with **`Plugin 'nextrush' not found`** — i.e. the rule is unreachable, never silently unenforced. See the custom-rule section below |
| Fixture RED control (rule reference removed) | _task 1.7_ | ✅ With the `rules` entry removed but `jsPlugins` intact: `node --test tools/eslint-rules/` → **2 failed / 3 passed** (enforcement + wiring fixtures fail). Restored → **5 passed / 0 failed** |
| Existing rule fixture suite under the new harness | _task 1.8_ | ✅ `RuleTester` suite unchanged and green (7 valid + 6 invalid fixtures, 1 test) — `eslint` retained as a fixture-only devDependency for exactly this harness; **0** fixtures dropped |
| Rule harness wired into the repo gate | _task 1.8_ | ✅ New `pnpm validate:lint-rules` (`node --test tools/eslint-rules/`, 5 tests) added to the `verify` chain — previously **nothing** ran the rule's fixtures (no script, no CI step), so the rule's tests were dead weight |
| Probe must be a TypeScript-project member | _tasks 1.7, 1.9_ | ✅ Recorded constraint: a probe file outside every tsconfig `include` is linted as "0 findings" — the JS-plugin rule is never consulted. Fixture therefore writes its probe into `packages/runtime/src/` (gitignored exact path, removed in `finally`) |

### Task 1.3 — the pinned pair is mutually usable (verified 2026-09-28)

Type-aware linting must be proven on the pinned pair *before* it is relied on, because `oxlint` and
`oxlint-tsgolint` are separate binaries loaded together (the lockfile even records the peer link as
`oxlint@1.83.0(oxlint-tsgolint@7.0.2002)`).

**Invocation 1 — whole package, config-free:**

```bash
cd packages/router && pnpm exec oxlint --type-aware src
```

```
Found 25 warnings and 0 errors.
Finished in 238ms on 44 files with 111 rules using 8 threads.
```

The 25 diagnostics include `typescript(unbound-method)` — a genuinely type-aware rule — so type
information reached tsgolint. No version-mismatch error and no silent no-op: **the pair is compatible.**

**Invocation 2 — proof that real type information flows, not just rule registration:**

A throwaway file was placed at `packages/router/src/__ts7_scratch.ts` (deleted immediately after the run):

```ts
async function load(): Promise<number> {
  return 1;
}

export function run(): void {
  load();
}
```

```bash
cd packages/router && pnpm exec oxlint --type-aware -D typescript/no-floating-promises src/__ts7_scratch.ts
```

```
  x typescript(no-floating-promises): Promises must be awaited, add void operator to ignore.
   ,-[src/__ts7_scratch.ts:6:3]
 5 | export function run(): void {
 6 |   load();
   :   ^^^|^^^
   :      `-- This unhandled promise-like value has type `Promise<number>`.
 7 | }
   `----
  help: The promise must end with a call to .catch, or end with a call to .then with a rejection handler, or be explicitly marked as ignored with the `void` operator.

Found 0 warnings and 1 error.
Finished in 175ms on 1 file with 111 rules using 8 threads.   (exit 1)
```

The message quotes the **inferred type** (`Promise<number>`), which is only obtainable by building a
real TypeScript program — the `typescript-go` path is live.

**Rule-table schema learnt here (needed for task 1.5):** `oxlint --rules` prints
`| Rule name | Source | Default | Enabled? | Fixable? |`. A blank `Default`/`Enabled?` pair does **not**
mean "unimplemented" — it means the rule **exists but is not in the default set**, so it must be
enabled explicitly in the config. This distinction matters for the parity map: rules such as
`no-misused-promises`, `no-unsafe-assignment`, `no-unsafe-call`, `no-unsafe-member-access`,
`no-unsafe-return`, `no-unsafe-argument`, `no-explicit-any`, `no-non-null-assertion`,
`prefer-nullish-coalescing`, `prefer-optional-chain`, `require-await`, `no-unnecessary-condition`,
`only-throw-error`, `no-confusing-void-expression`, and `unified-signatures` are all **present** and
can be turned on, exactly as the current ESLint config turns them on.



### Group 2 — lint cutover (task 2.9)

| Check | Command | Result |
| --- | --- | --- |
| 21 lint script bodies swapped to the new engine | scripted audit of every manifest | ✅ 21 files changed, **24/24 lines** (21 `lint` + 3 `lint:fix`), **0** lint scripts still name ESLint, UTF-8 preserved (`ensure_ascii=False`) |
| Package-level lint task end-to-end | `pnpm --filter @nextrush/router lint` | ✅ `$ oxlint src --ignore-pattern '**/__tests__/**'` → `Found 0 warnings and 0 errors` (150 rules, 516ms), exit 0 |
| Turbo-level lint task end-to-end | `pnpm exec turbo run lint --filter=@nextrush/router` | ✅ build + lint succeed, exit 0 (task 1.6's probe run proved diagnostics reach this layer) |
| Zero-warning posture preserved | `pnpm --filter create-nextrush lint` | ✅ `oxlint src --max-warnings 0 …` → 0 warnings / 0 errors, exit 0 |
| Post-cutover lint wall-time vs baseline | _task 2.9_ | ✅ **19.82s** vs **52.97s** baseline — same harness, same 21 packages, 0 findings in both. **2.7× faster** end-to-end. Restricting to the 20 packages that moved: 47.38s → 14.43s, i.e. **3.3×**. The per-invocation spawn floor (~0.3s × 21) caps workspace-level speedup well below the engine's 12–18× on pure analysis — hence the measured figure is reported, not the engine's claimed one. `apps/website` still runs ESLint (5.39s) and is included in both numbers — see task 5.1 |
| Root config removed, no ignored-config behaviour | _task 2.2_ | ✅ `eslint.config.mjs` deleted; config resolved from a package's own cwd (the interpreter for that proof is the pre-existing `packages/router` run in 2.1, re-run green after deletion) — Oxlint discovers the root config by walking up, so no `--config` flag is needed in any of the 21 scripts |
| Config edits invalidate lint caches | _task 2.3_ | ✅ `oxlint.config.ts` added to turbo `globalDependencies`; a config-only commit can no longer reuse a stale lint cache |
| Lint-path dependencies removed | _task 2.4_ | ✅ Removed `typescript-eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `@eslint/js`, `eslint-config-prettier` from the root manifest; `eslint` **retained as a fixture-only devDependency** for the task 1.8 harness; `pnpm install` clean, `pnpm lint` green afterwards |
| Finding-delta triage vs the 1.1 baseline | _task 2.5_ | ✅ Baseline 0 findings → post-swap 0 findings. The new engine surfaced **3** findings the old one did not, all triaged: 1 in `packages/runtime` and 1 in `packages/extensions/events` were `prefer-optional-chain` **false positives** on `typeof globalThis !== 'undefined'` / `typeof process === 'undefined'` guards (rewriting them to `?.` would throw `ReferenceError` in an environment where the global truly is absent) → waived with an explicit reason comment; 1 was a **real** defect the previous config missed — six tsconfigs (`extensions/events`, `interop/express-bridge`, `middleware/{cookies,csrf,openapi,validation}`) declared `outDir` without `rootDir`, emitting a flatter `dist/` layout than `packages/*` siblings → fixed by adding `"rootDir": "./src"` |
| Suppression directives preserved | _task 2.6_ | ✅ 89 → **91**, the +2 being the task 2.5 waivers above (both `eslint-disable-next-line` with a written reason). **0** directives mass-edited or dropped; the 11 `nextrush/no-runtime-identity-capability` file-level suppressions still resolve (verified by the task 1.7 fixture) |
| Website app linter decided on evidence | _tasks 5.1, 5.2_ | ✅ Scoped to ESLint: `apps/website` keeps `eslint-config-next` (Next-specific rule sets) and its `lint` script was restored to `eslint` after the mechanical swap; the site's config is isolated to that app and its lint exits 0 |
| Cross-adapter conformance parity (task 2.8) | `pnpm --filter @nextrush/adapter-conformance test` | ✅ **Identical before and after** — baseline `bd943db7` (isolated git worktree, built then tested): **11 files / 320 tests passed, exit 0**; post-cutover on this branch: **11 files / 320 tests passed, exit 0**. The tooling change moved no runtime behaviour |
| Gate checks owned by this group | _task 2.7_ | ✅ All three green: `pnpm check:coverage` → "Coverage gate passed for all non-excluded packages" (exit 0, 39 packages checked, ≥90% lines / ≥85% branches, pre-existing exclusions unchanged); `turbo run typecheck --force` → 68/68 tasks, exit 0 (TypeScript 6.0.3); `pnpm lint` → 0 findings across all 21 packages |

### Group 3 — compiler bump (tasks 3.1, 3.11)

| Check | Command | Result |
| --- | --- | --- |
| Pre-bump typecheck wall-time (uncached) | _task 3.1_ | ✅ `pnpm exec turbo run typecheck --force` on **TypeScript 6.0.3** → **1 m 25.61 s**, 68/68 tasks, exit 0 |
| Compiler installed on the TS 7 line | _task 3.2_ | ✅ `pnpm install` → `typescript 6.0.3 → 7.0.2`, exit 0, quarantine respected. `oxlint-tsgolint@7.0.2002` needed **no** change: its own README §Versioning shows `7.0.2002` = TypeScript `7.0.2` + tsgolint patch `002`, i.e. it is already built on the target compiler |
| Library build on TS 7 | _tasks 3.3–3.5, 3.9_ | ❌ **BLOCKED** — `pnpm build` dies in `tsup`'s vendored `rollup-plugin-dts@6.1.1` (legacy `ts.sys`) across **38** `dts: true` packages. Full facts, the failed override experiment, and the four options are in **[P2 blocker](#p2-blocker--discovered-while-bumping-the-compiler-tasks-32--33)** below |
| Post-bump typecheck wall-time (uncached) | _task 3.11_ | ✅ `pnpm exec turbo run typecheck --force` on TypeScript **7.0.2** → **16.03s** (68/68, exit 0) vs the TS 6.0.3 baseline of **1m25.61s** — a **5.3×** speed-up on the identical command |
| Declaration pass under the native compiler | `packages/dev` build/declaration tests | ✅ passed inside the cold `pnpm verify` (2026-09-28): `swc-builder-integration` `generateDeclarations (in-process, real tsc)` green; full build 44/44 emits `.d.ts` for every `dts: true` package under `tsdown@0.23.0` |

### P2 blocker — discovered while bumping the compiler (tasks 3.2 / 3.3)

**Status: RESOLVED — Option B (tsup → `tsdown`) was executed and is green.** The compiler installs and
typechecks, the library build now emits declarations (rolldown-plugin-dts, oxc-based, never the
TypeScript JS API), and the stage-2 `^0.23.0` bump landed once the deprecation-warning count reached
zero (2026-09-28). Full build under `tsdown@0.23.0`: **44/44 tasks, exit 0, wall 48s**; the only
remaining notice is tsdown's own per-package `TypeScript 7.0 does not yet have a stable API` warning
(informational, not a failure). The analysis below is kept as the record of why Option B was chosen.

Verified facts (all reproduced on this branch, 2026-09-28):

| # | Fact | Evidence |
| - | ---- | -------- |
| 1 | `typescript@7.0.2` installs under the quarantine | `pnpm install` → `typescript 6.0.3 → 7.0.2`, exit 0, **no** `minimumReleaseAgeExclude` added |
| 2 | The lockstep already holds — tsgolint 7.0.2002 **is** built on TypeScript 7.0.2 | `oxlint-tsgolint` README §Versioning: in `v7.0.2001`, `7.0.2` is the TypeScript version and `001` the tsgolint patch, and the patch suffix resets when the TypeScript portion changes |
| 3 | TS 7's JS API shrank: `ts.sys` and `ts.createProgram` are gone | `node -e "typeof require('typescript').sys"` → `undefined` on 7.0.2. The **CLI** contract the design relied on is intact: `bin.tsc` present, `./package.json` still exported, ESM-only, per-platform `optionalDependencies` |
| 4 | **`pnpm build` fails on the first package** | `@nextrush/types:build` → `TypeError: Cannot read properties of undefined (reading 'useCaseSensitiveFileNames')` |
| 5 | The crash is inside `tsup`, not in our source | `tsup@8.5.1` **vendors** `rollup-plugin-dts@6.1.1` inside its own `dist/rollup.js` (the identifying string occurs exactly once, in tsup's bundle); `rollup-plugin-dts@6.1.1` declares `peerDependencies.typescript: "^4.5 \|\| ^5.0"` and reads the legacy `ts.sys` API at module init |
| 6 | A pnpm `overrides` entry **cannot** fix it | Added `overrides: { rollup-plugin-dts: "^6.5.1" }`, reinstalled, rebuilt → **same crash**. Reverted — a no-op supply-chain override is worse than none |
| 7 | No newer tsup exists to wait for | tsup dist-tags contain only `latest: 8.5.1`, published **2025-11-12** — roughly eight months before TS 7 shipped; no v9, no prerelease |
| 8 | Blast radius | **38 packages** declare `dts: true` in `tsup.config.ts` |

Options, on facts rather than preference:

| Option | TS 7 declaration path | Evidence | Assessment |
| ------ | --------------------- | -------- | ---------- |
| **A.** `dts: false` + `tsc --emitDeclarationOnly` (keep tsup for JS bundling) | TypeScript 7's own native compiler | fact 3 — the `tsc` CLI contract is intact | Mechanical but wide: 38 near-identical `tsup.config.ts` files plus their build scripts; declaration output becomes a per-file tree instead of one bundled file |
| **B.** Swap tsup → `tsdown` | `rolldown-plugin-dts` — `peerDependencies.typescript: "^5.0.0 \|\| ^6.0.0 \|\| ~7.0.0"`, built on oxc parsers (`yuku-ast`, `yuku-parser`, `yuku-codegen`), never touching the TS JS API; `tsdown@0.23.0` treats `typescript` as an *optional* peer | Highest upside (explicitly TS 7-ready, actively released), largest blast radius (bundling behaviour differs package by package) |
| **C.** Patch tsup (`patchedDependencies`) to swap the vendored 6.1.1 for 6.5.1 | Keeps today's build shape | — | We would own a patch against a release that is already ten months stale |
| **D.** Keep the build on TS 6 and adopt TS 7 for typecheck/lint only | tsc 6 | — | Contradicts this change's goal (adopt TS 7) |

**Not validated, therefore not claimed:** whether A or B is green end-to-end, and whether the website app
(`next build` + fumadocs) survives TS 7. Peer warnings observed under TS 7, recorded for that follow-up:
`twoslash@0.3.9` wants `typescript: ^5.5.0 || ^6.0.0`; `@swc-node/register@1.12.1` wants `>= 4.3 < 7`;
`eslint-config-next`'s transitive `typescript-eslint@8.66.0` wants `<6.1.0` (harmless — the website's Next
config enables no typed rules and its lint exits 0).

**Tree state (updated 2026-09-28):** the `typescript` catalog range is **`^7.0.2`** — the workspace
runs the TS 7 line end to end (typecheck, lint, build). The one deliberate exception is the
`docs-toolchain` catalog (`typescript: 6.0.3`): the website's `twoslash@0.3.9` reads `ts.sys` at module
init, which TS 7's main entry no longer exposes, and no twoslash release supports TS 7 yet — remove
that catalog when upstream ships support.

### Group 6 — integration verification (task 6.4)

| Check | Command | Result |
| --- | --- | --- |
| Full uncached `verify` | `pnpm verify` | ✅ 2026-09-28, cold `.turbo`: **EXIT=0** — `turbo run verify` 147/147 (build + test + typecheck + lint) **and** the full validator chain (`validate:bins`, `validate:esm-only`, `validate:manifest-composition`, `validate:lint-rules`, `validate:build-plugins`, `ensure:swc-node`, `check:coverage`); wall **3m28s** (`/tmp/ts7/verify-cold-61.log`) |
| Generate-then-install matrix | `create-nextrush` matrix gate | ⬜ not yet recorded |
| Repository rule + typed rules still enforced after the cutover | spot-check of one finding of each kind | ⬜ not yet recorded |


### Integration findings — root causes hit and fixed during full-suite verification (2026-09-28)

Two genuine failures surfaced when the full suite ran cold (a wiped `.turbo`). Both were root-caused,
fixed, and given a permanent regression guard. Neither is attributable to Oxlint.

#### A. Cold-run ordering race in `create-nextrush`'s generate-then-install tests

| Fact | Evidence |
| --- | --- |
| Symptom | `generated-example-test.test.ts` failed on a cold run: vitest inside the generated project could not resolve `@nextrush/router` (`Failed to resolve entry for package`) while it passed in isolation |
| Root cause | `turbo.json` gives `test` `dependsOn: ["build"]` — the **same package's** build only. `create-nextrush` declares **zero** workspace dependencies, so turbo had no edge ordering `@nextrush/router#build` before `create-nextrush#test`. On a cold cache `router:build` (`clean: true` deletes `dist/`) ran **concurrently** with the generated project's vitest resolving that same `dist/` — a read-during-delete race. Log proof: `create-nextrush:test` starts at line 355, `router:build` emits dist at lines 2866–2869 of the same run |
| Why CI never showed it | CI pre-builds `--filter=dev-cli-fixture...` before `pnpm verify`, warming exactly the closure the generated project links — the repo's own workaround for the missing edge |
| Why 13 sibling tasks showed `ELIFECYCLE` | turbo stops the run on first failure (default, no `--continue`); those lines are cancelled tasks, not additional failures |
| Fix | `"nextrush": "workspace:*"` added to `create-nextrush`'s devDependencies — semantically true (its e2e tests consume the built framework) and it gives turbo the transitive edge `create-nextrush#test → create-nextrush#build → nextrush#build → {router, core, errors, adapter-node, class, …}` (verified via `turbo run test --filter=create-nextrush --dry=json`) |
| Verification | Full suite green afterwards; the previously-failing file passes **6/6** in isolation and in-suite |

#### B. `@swc-node/register` crashed against TypeScript 7 — pnpm peer-override bug

| Fact | Evidence |
| --- | --- |
| Symptom | `cross-runtime-parity-smoke.test.ts` (Node boot) failed: the generated project died with `TypeError: Cannot read properties of undefined (reading 'Js')` at `@swc-node/register/lib/transform-cache.js:60` (`ts.Extension.Js`) |
| Root cause (depth) | TS 7's main entry exports **only** `version` / `versionMajorMinor` (`node -e "console.log(Object.keys(require('typescript')))"` → 2 keys); the API moved behind `./unstable/*`. `@swc-node/register@1.12.1` (already its `latest`; peer `typescript: ">= 4.3 < 7"`) uses **21** distinct `ts.*` APIs — pairing it with TS 7 is fatal by construction |
| Why the workspace override didn't save it | `pnpm-workspace.yaml` pins `overrides: {'@swc-node/register>typescript': '6.0.3'}`. pnpm 12.6.0 applies it at the *spec* level (`pnpm peers check` → `✕ unmet peer typescript — Installed: 7.0.2 / Wanted: 6.0.3`) but still **binds** the peer from the dependent's context (`typescript@7.0.2`) — the known override-not-applied-to-peer-deps-on-version-mismatch class (pnpm/pnpm#9913, pnpm/pnpm#12345; no stable pnpm release contains the fix — 12.7.0 is `next-12` only). `packageExtensions` making typescript a hard dependency was tested and had **no** effect (dead config — removed) |
| Fix that holds today | Re-keyed the lockfile to the override-consistent variant (importer binding + variant key + snapshot dependency → `typescript@6.0.3`); `pnpm install --frozen-lockfile` accepts it and lays down the correct `typescript@6.0.3` sibling symlink. Probe: `ts.Extension.Js` defined; boot test green in **697ms** |
| Durability (the bug re-fires) | A plain `pnpm install` keeps the key, but **`pnpm update` re-resolves the graph and clobbers it** (observed). Guard: `scripts/ensure-swc-node-ts6.mjs` — repair mode runs from root `postinstall` (so `update-all.sh`'s final install self-heals; it rewrites lockfile + symlink) and `--check` mode is wired into the root `verify` chain as `pnpm ensure:swc-node`, so a clobbered state cannot pass CI |
| Rejected alternative | Deleting `@swc-node/register` (tsx / Node type-stripping) — `spawn.ts` documents the register is load-bearing for `emitDecoratorMetadata` (DI constructor injection); esbuild-based runners cannot emit metadata. Upstream must ship a TS-7-capable release |


#### Toolchain currency audit (npm registry, 2026-09-28T06:2xZ; quarantine cutoff 2026-09-21T06:2xZ)

| Tool | Repo | Latest | Status |
| --- | --- | --- | --- |
| `typescript` | `^7.0.2` | 7.0.2 | **latest** ✓ |
| `tsdown` | `^0.23.0` | 0.23.0 | **latest** ✓ (stage-2 D9 bump landed today; 44/44 builds green) |
| `pnpm` | 12.6.0 | 12.6.0 | **latest stable** ✓ (12.7.0 exists only as `next-12` prerelease) |
| `oxlint` | 1.83.0 (exact, D3 lockstep) | 1.85.0 | quarantined until **2026-09-28T15:32Z** — bump after that, in lockstep with tsgolint |
| `oxlint-tsgolint` | 7.0.2002 (exact, D3 lockstep) | 7.0.2003 | quarantined until **2026-10-01T15:18Z** — bump in lockstep |
| `fast-check` | 4.10.2 | 4.10.2 | **latest** ✓ (bumped today) |
| `simple-git-hooks` | 2.14.0 | 2.14.0 | **latest** ✓ (bumped today) |
| `turbo` | `^2.11.2` | 2.11.5 | 2.11.5 quarantined until 2026-10-04; the caret floats there automatically |
| `prettier` | `^3.9.6` | 3.9.9 | floats when quarantine clears (2026-09-30) |
| `next` | `^16.3.0` | 16.3.6 | floats when quarantine clears (2026-09-29) |
| `zod` / `tsx` / `esbuild` / `react` / `react-dom` | caret ranges | — | floated to latest-within-range today (`zod 4.6.5`, `tsx 4.23.15`, `esbuild 0.28.2`, `react 19.3.0`) |
| `vitest` | `^4.1.10` | 5.0.2 | **major** — quarantined until 2026-10-02 *and* a v4→v5 migration; flagged as its own decision, not folded into this change |
| `@changesets/cli` | `^2.31.1` | 3.0.3 | **major** release-tooling bump — flagged, not folded in |
| `eslint` (website-only now) | `^9.39.5` | 10.11.0 | major; website scope only (`eslint-config-next` compat unverified) — flagged |


