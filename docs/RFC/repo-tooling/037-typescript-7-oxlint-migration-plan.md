# Execution Plan — RFC-037: TypeScript 7 via Oxlint (replace ESLint + typescript-eslint)

| Field | Value |
| --- | --- |
| **RFC** | [`037-typescript-7-oxlint-migration.md`](./037-typescript-7-oxlint-migration.md) |
| **Status** | ⬜ Not started |
| **Date** | `2026-09-27` |
| **Estimated effort** | ~1.5–2 days total (P0 ≈ 4–6h · P1 ≈ 3–4h · P2 ≈ 2–3h · P3 ≈ 2–3h) |
| **Ordering rule** | Linter swap **before** TS bump (RFC §6). One atomic commit per checklist group (AGENTS.md §20). |

**Global rules**

- Same commands stay true at every phase end: `pnpm lint` · `pnpm typecheck` · `pnpm verify` — if any
  phase breaks the command *name*, the phase is wrong.
- Never edit runtime package source for tooling reasons except to fix *findings* surfaced by the new
  linter (P1) or TS 7 errors (P2) — those are separate, clearly-scanned commits.
- Record baseline timings **before** P0 and P2 (`time pnpm lint`, `time pnpm typecheck`) into §14 of
  the RFC as you go.
- Every phase ends with: `pnpm verify` green → commit → update RFC Progress Tracker row.

---

## P0 — Spike & rule-parity mapping (still on TS 6.0.3)

**Goal:** prove Oxlint reproduces today's gate before removing anything. Nothing merged to `main`
without the mapping table.

- [ ] **P0.1 Baseline capture**
  - [ ] `time pnpm lint 2>&1 | tail -30` → save output (lint wall-time baseline)
  - [ ] `node --test tools/eslint-rules/no-runtime-identity-capability.test.mjs` → save output (fixtures baseline)
  - [ ] `pnpm lint -- --format json` or plain run → save full findings list as `eslint-baseline.json` (findings-diff reference for P1)
- [ ] **P0.2 Install (root devDeps, catalog `tooling` in `pnpm-workspace.yaml`)**
  - [ ] Add `oxlint: "^1.85.0"` and `oxlint-tsgolint: "7.0.2xxx"` (pin to the release whose version encodes `7.0.2*`) to `catalog:tooling`
  - [ ] Wire both into root `package.json` devDependencies via `catalog:tooling`
  - [ ] `pnpm install` — if blocked by `minimumReleaseAge: 10080`, add both to `minimumReleaseAgeExclude` (RFC §8.6) and note it in the commit message
- [ ] **P0.3 Config translation**
  - [ ] `npx @oxlint/migrate eslint.config.mjs` → generates first-draft `.oxlintrc.json`/config
  - [ ] Promote to root `oxlint.config.ts` (shape per RFC §8.1: `defineConfig`, `options`, `plugins`, `rules`, `overrides`, `ignorePatterns`)
  - [ ] Fold in ignores from `eslint.config.mjs` (`node_modules`, `dist`, `coverage`, `_archive`, `.turbo`) + website ignores (`.next`, `out`, `public`, `.source`)
  - [ ] Keep `nextrush/no-runtime-identity-capability` block: `files: ['packages/**/src/**/*.ts']`, `ignores: ['**/__tests__/**', '**/*.test.ts']`
- [ ] **P0.4 Rule-parity mapping table** ← the phase's key artifact
  - [ ] Create `docs/RFC/repo-tooling/037-rule-mapping.md`: one row per rule source in `eslint.config.mjs`:
        `eslint recommended` · `strictTypeChecked` (each rule) · `stylisticTypeChecked` (each rule) · 11 explicit overrides
  - [ ] Columns: `current rule` → `oxlint rule (or N/A)` | `type-aware?` | `severity preserved?` | `verified (yes/no/why)`
  - [ ] Confirm open question §18: does tsgolint ship `typescript/require-await` and `typescript/no-misused-promises`? Which 2 of the 61 typed rules are missing — and do we use them?
  - [ ] Every unmapped rule gets an explicit waiver row with rationale (G2: **zero silent drops**)
- [ ] **P0.5 Custom rule → JS Plugin**
  - [ ] Add `tools/eslint-rules/oxlint-plugin.mjs` — ESLint-plugin-shaped wrapper: `export default { rules: { 'no-runtime-identity-capability': noRuntimeIdentityCapability } }`
  - [ ] Reference it from config `overrides[].jsPlugins` (per oxc docs: local plugin paths are added manually, not by `@oxlint/migrate`)
  - [ ] Run fixtures: `node --test tools/eslint-rules/no-runtime-identity-capability.test.mjs` must stay green (G3) — decide §18 harness question here (keep `eslint` devDep vs port harness to direct `rule.create()`)
  - [ ] Smoke-test detection: temporary file with `if (runtime === 'node')` in `packages/**/src` → oxlint must flag it; `// capability-exempt: test` must silence it → remove temp file
- [ ] **P0.6 `--type-aware` under turbo (oxc#21426)**
  - [ ] In one package (use `packages/router`): `pnpm --filter @nextrush/router exec oxlint src --type-aware`
  - [ ] If config-rejection error appears → switch strategy: per-package scripts carry `--type-aware` flag, root config does NOT set `options.typeAware`; retest
  - [ ] If pass → run with `OXC_LOG=debug` once; confirm program assignment finds the package `tsconfig.json` and built `.d.ts` (turbo `lint` already `dependsOn: build`)
- [ ] **P0.7 Findings diff (still on ESLint as source of truth)**
  - [ ] `oxlint src --type-aware` per package → diff against `eslint-baseline.json`
  - [ ] Classify every delta: `oxlint-equivalent-severity` | `new-real-issue` | `false-positive` | `missing-rule` → feeds P1 triage and the mapping table
- [ ] **P0.8 Exit check (all must pass)**
  - [ ] Mapping table complete: 100% rules mapped or waived
  - [ ] `oxlint src --type-aware` green (or only known-delta findings) in ≥3 representative packages: `core`, `router`, `adapters/node`
  - [ ] Custom-rule fixtures green under both engines' enforcement
  - [ ] Baseline + spike timings recorded in RFC §14
  - [ ] Commit: `feat(tooling): RFC-037 P0 — oxlint spike, rule-parity mapping, custom-rule JS plugin`

## P1 — Repo lint cutover (still on TS 6.0.3)

**Goal:** every `lint` task runs Oxlint; ESLint leaves the lint path. `pnpm verify` green.

- [ ] **P1.1 Script swap — all 21 `lint` scripts** (20 packages + `apps/website`; root's `lint` stays `turbo run lint`)
  - [ ] Pattern: `"lint": "oxlint src --type-aware"` (packages), `"lint:fix": "oxlint src --type-aware --fix"`
  - [ ] Special cases:
        - [ ] `packages/create-nextrush`: keep zero-warning posture → `oxlint src --type-aware --max-warnings 0`
        - [ ] Root `package.json` `"lint"` stays `turbo run lint` — no change needed
        - [ ] `apps/website`: hold for P3 if `nextjs`-plugin coverage is unverified (§8.6 fallback) — otherwise swap now
  - [ ] Remove obsolete `--ignore-pattern '**/__tests__/**'` args (moves to config `ignorePatterns`/`overrides`)
- [ ] **P1.2 Root config lands**
  - [ ] Commit final `oxlint.config.ts`; delete `eslint.config.mjs`
  - [ ] Add `oxlint.config.ts` to turbo `globalDependencies` (and package lint `inputs` if needed) so config edits invalidate lint caches (RFC §8.6 — fixes the pre-existing latent gap)
- [ ] **P1.3 Dependency cleanup (lint path only)**
  - [ ] Remove from root `package.json`: `typescript-eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint-config-prettier`, `@eslint/js`
  - [ ] Keep or drop `eslint` per the P0 harness decision (§18): keep = fixtures still use `RuleTester`; drop = fixtures ported to direct `rule.create()`
  - [ ] `pnpm install` (lockfile shrinks) → `pnpm lint` must still work
- [ ] **P1.4 Findings triage (the P0 diff applied)**
  - [ ] `pnpm lint` workspace-wide → fix every new `error` finding
  - [ ] `warn` findings: fix or consciously baseline — no silent accumulation
  - [ ] False positives: add scoped rule waivers in `oxlint.config.ts` with a `// RFC-037` comment — never blanket-disable
  - [ ] `eslint-disable` directives: leave untouched (`eslint-*` syntax honored); only *remove* directives Oxlint reports as unused **and** ESLint baseline proves redundant
- [ ] **P1.5 Gate check**
  - [ ] `pnpm verify` green (build → test + typecheck + lint) on TS 6.0.3
  - [ ] Confirm zero ESLint invocations: `pnpm lint` output shows only oxlint diagnostics
  - [ ] Custom rule still fires: re-run the P0.5 smoke test through `pnpm --filter <pkg> lint`
  - [ ] Record post-swap lint wall-time in RFC §14 (expect ≥5× vs baseline)
  - [ ] Commit: `feat(tooling): RFC-037 P1 — cutover lint to oxlint, drop typescript-eslint from lint path`

---

## P2 — TypeScript 7 adoption

**Goal:** catalog on `typescript@^7.0.2`; everything green.

- [ ] **P2.1 Pre-bump baseline:** `time pnpm typecheck` on TS 6 → record (RFC §14)
- [ ] **P2.2 Catalog bump (`pnpm-workspace.yaml` `tooling`)**
  - [ ] `typescript: "~6.0.3"` → `^7.0.2`
  - [ ] Align `oxlint-tsgolint` to the `7.0.2xxx` release matching TS 7.0.2 (lockstep pair — add the catalog comment from RFC §8.4)
  - [ ] `pnpm install` → verify `node_modules/typescript/package.json` reports `7.0.2`
- [ ] **P2.3 tsconfig migration**
  - [ ] Run `npx ts5to6` (or the official TS 6→7 migration tooling) against `tsconfig.base.json` + package tsconfigs
  - [ ] Resolve `"ignoreDeprecations": "6.0"` — remove if TS 7 rejects/needs updated value (RFC §3.1)
  - [ ] Confirm `experimentalDecorators` + `emitDecoratorMetadata` still accepted (required by `@nextrush/class` DI)
  - [ ] Confirm `target`/`lib`/`moduleResolution: bundler` unchanged or fix per tool output
- [ ] **P2.4 Fix what TS 7 surfaces**
  - [ ] `pnpm typecheck` → fix errors package-by-package (expect stragglers: deprecated API usage, stricter inference)
  - [ ] Each fix commit scanned for behavior changes → run affected package tests + conformance suite
  - [ ] `pnpm build` → green
  - [ ] `pnpm test` → green (vitest unaffected by TS engine, but type-level test files compile under new tsc)
  - [ ] `pnpm lint` → green (tsgolint now agrees with the TS 7 program)
- [ ] **P2.5 Full gate + timing**
  - [ ] `pnpm verify` green end-to-end on TS 7.0.2
  - [ ] Record post-bump typecheck wall-time (expect ≥5× faster; upstream 8–12×)
  - [ ] Optional editor note for contributors (docs in P3): VS Code needs the TS 7 extension per Microsoft's announcement
  - [ ] Commit: `feat(tooling): RFC-037 P2 — adopt TypeScript 7.0.2 across the workspace`

## P3 — Scaffolder, website, docs, close-out

**Goal:** everything downstream of the monorepo teaches the new stack; RFC → Shipped.

- [ ] **P3.1 `create-nextrush` templates**
  - [ ] `templates/preset.ts` — `generateEslintConfig()` → `generateOxlintConfig()` emitting `.oxlintrc.json`/`oxlint.config.ts` (recommended rules parity with the old `tseslint.configs.recommended` draft)
  - [ ] `templates/preset.ts` — `generateVscodeExtensions()`: `dbaeumer.vscode-eslint` → Oxlint extension id (verify current id at implementation time)
  - [ ] `templates/package-json.ts` — generated devDeps: replace `eslint`/`typescript-eslint` with `oxlint` (+ `oxlint-tsgolint` only if the template enables type-aware; decide: recommended = plain oxlint for scaffold simplicity)
  - [ ] Generated `lint`/`lint:fix` scripts → `oxlint` / `oxlint --fix`
  - [ ] Toolchain range: `getToolchainRange('typescript')` single-sources from `create-nextrush`'s own devDep — ensure `packages/create-nextrush/package.json` typescript range updated to `^7.0.2` (it currently pins `^6.0.3`) so generated projects inherit TS 7
  - [ ] `templates/shared.ts` — the 5 `/* eslint-disable nextrush/no-runtime-identity-capability */` blocks: keep if Oxlint honors `eslint-*` in generated files (it does — verify with a scaffolded project), else switch to `oxlint-disable`
  - [ ] Generated-project smoke: `pnpm create` a project → `npm install && npm run lint && npm run build` green (the installable-output CI test must pass)
- [ ] **P3.2 `apps/website` decision**
  - [ ] Audit Oxlint `nextjs` plugin coverage vs `eslint-config-next/core-web-vitals` rules actually firing on the site
  - [ ] Covered → swap `"lint": "eslint"` → oxlint, delete `apps/website/eslint.config.mjs` (fold ignores into root config), remove website eslint deps
  - [ ] Not covered → keep ESLint scoped to `apps/website` only, document the exception in the mapping table + website README (§8.6 fallback)
- [ ] **P3.3 Docs sweep** (AGENTS.md §13/§17 — docs sync with the change)
  - [ ] `grep -rn 'eslint' --include='*.md' docs CONTRIBUTING.md AGENTS.md README.md` → update instructions to oxlint (skip `docs/RFC/037-*` historical references and `openspec/changes/archive/**` — history is not rewritten)
  - [ ] Package `README.md`s / `ARCHITECTURE.md`s that mention ESLint lint commands → update to `pnpm lint` wording (prefer command names over tool names in contributor docs)
  - [ ] `.vscode/extensions.json` at repo root (if present) → Oxlint extension
  - [ ] Note in CONTRIBUTING: editors should use the Oxlint extension for inline diagnostics; TS 7 editor support per Microsoft announcement
- [ ] **P3.4 RFC close-out**
  - [ ] All §18 open questions resolved → moved to §19 Decisions Log
  - [ ] Rule mapping table final state linked from RFC §20 References
  - [ ] Progress Tracker: all 4 rows ✅, bar `[████████████████████] 100%`
  - [ ] RFC Status → `Shipped`; add INDEX.md row status update
  - [ ] If any durable decision deserves permanence beyond the RFC (e.g. "repo linter is oxlint; typescript ↔ oxlint-tsgolint lockstep"), write the ADR from `docs/adr/TEMPLATE.md` before archiving (AGENTS.md §21)
  - [ ] Commit: `feat(tooling): RFC-037 P3 — scaffolder + website + docs on oxlint/ts7`

---

## Verification matrix (run before merging each phase)

| Check | Command | P0 | P1 | P2 | P3 |
| --- | --- | :-: | :-: | :-: | :-: |
| Typecheck | `pnpm typecheck` | ✓ (TS6) | ✓ (TS6) | ✓ (TS7) | ✓ |
| Tests | `pnpm test` | ✓ | ✓ | ✓ | ✓ |
| Lint | `pnpm lint` | ✓ (oxlint spike + eslint baseline) | ✓ (oxlint only) | ✓ | ✓ |
| Full gate | `pnpm verify` | ✓ | ✓ | ✓ | ✓ |
| Custom-rule fixtures | `node --test tools/eslint-rules/*.test.mjs` | ✓ | ✓ | ✓ | ✓ |
| Conformance suite | (part of `pnpm test` / turbo) | ✓ | ✓ | ✓ | ✓ |
| Generator installable output | CI job (see `.github/workflows/ci.yml`) | — | — | — | ✓ |
| Timing recorded in RFC §14 | manual | lint baseline | lint after | typecheck after | — |

## Rollback quick-reference (RFC §16)

| Phase | Revert unit | Post-revert state |
| --- | --- | --- |
| P0 | single commit | no change (spike artifacts only) |
| P1 | `git revert` P1 commit(s) | ESLint stack restored, TS 6, green |
| P2 | `git revert` P2 commit(s) + catalog re-pin `~6.0.3` | TS 6 + oxlint (P1 intact) |
| P3 | `git revert` P3 commit(s) | templates/docs back; monorepo unaffected |

**Abort trigger for the whole RFC:** P0 exit conditions unreachable (parity gap on a rule we
cannot waive, or `--type-aware` unusable under turbo with no fallback) → stop, record findings in
the RFC as `Deferred` with the gating driver — do not proceed to P1 half-done.


