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
| Cross-adapter conformance parity (task 2.8) | `pnpm --filter @nextrush/adapter-conformance test` | ⬜ post-change run recorded (**11 files / 320 tests passed, exit 0**); the pre-cutover comparison run is in progress in a worktree at `bd943db7` |

### Group 3 — compiler bump (tasks 3.1, 3.11)

| Check | Command | Result |
| --- | --- | --- |
| Pre-bump typecheck wall-time (uncached) | _task 3.1_ | ✅ `pnpm exec turbo run typecheck --force` on **TypeScript 6.0.3** → **1 m 25.61 s**, 68/68 tasks, exit 0 |
| Compiler installed on the TS 7 line | _task 3.2_ | ✅ `pnpm install` → `typescript 6.0.3 → 7.0.2`, exit 0, quarantine respected. `oxlint-tsgolint@7.0.2002` needed **no** change: its own README §Versioning shows `7.0.2002` = TypeScript `7.0.2` + tsgolint patch `002`, i.e. it is already built on the target compiler |
| Library build on TS 7 | _tasks 3.3–3.5, 3.9_ | ❌ **BLOCKED** — `pnpm build` dies in `tsup`'s vendored `rollup-plugin-dts@6.1.1` (legacy `ts.sys`) across **38** `dts: true` packages. Full facts, the failed override experiment, and the four options are in **[P2 blocker](#p2-blocker--discovered-while-bumping-the-compiler-tasks-32--33)** below |
| Post-bump typecheck wall-time (uncached) | _task 3.11_ | ⬜ not yet recorded |
| Declaration pass under the native compiler | `packages/dev` build/declaration tests | ⬜ not yet recorded |

### P2 blocker — discovered while bumping the compiler (tasks 3.2 / 3.3)

**Status: BLOCKED — a decision is required before P2 can land.** The compiler installs and typechecks
fine; the **library build cannot emit declarations**, so P2's exit condition is unreachable as specified.

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

**Tree state while blocked:** the `typescript` catalog range was reverted to `~6.0.3` so the workspace
stays buildable on the completed P1 cutover. The TS 7 evaluation is reproducible from the facts above.

### Group 6 — integration verification (task 6.4)

| Check | Command | Result |
| --- | --- | --- |
| Full uncached `verify` | `pnpm verify` | ⬜ not yet recorded |
| Generate-then-install matrix | `create-nextrush` matrix gate | ⬜ not yet recorded |
| Repository rule + typed rules still enforced after the cutover | spot-check of one finding of each kind | ⬜ not yet recorded |
