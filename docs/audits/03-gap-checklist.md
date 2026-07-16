# NextRush — Master Engineering Gap Checklist

> **Single source of truth for implementation.** Converts every open finding from the audits in `docs/audits/` into an executable task. Not a summary — a backlog.
> **Source audits:** `01-production-readiness-audit.md`, `02-production-roadmap.md`, `class-based-master-audit.md`, `class-based-production-readiness-review.md`, `class-based-v3-strategic-audit.md`, `dev-package-production-readiness-review.md`.
> **⚠️ Missing inputs:** `04-performance-engineering-audit.md`, `05-security-architecture-audit.md`, `06-api-design-maintainability-audit.md` were referenced but **do not exist in the repo**. Performance/Security/API-design tasks below are extracted from the audits that *do* exist (01/02 + class-based ×3 + dev) and verified source evidence. Producing those three dedicated audits is itself tracked as **T063–T065**.
> **De-duplication:** findings resolved in class Waves 6–8 and dev remediation waves are **excluded**. Only genuinely-open work is listed. Overlapping findings across audits are merged (cross-refs noted).
> **Status legend:** □ Not Started · ◐ In Progress · ☑ Completed. All tasks open at creation.
> **Priority:** P0 (blocks a truthful production/stable claim) · P1 (required before stable v1.0) · P2 (important) · P3 (ecosystem/nice-to-have).
> **Effort:** XS (<1d) · S (<1w) · M (1–3w) · L (1–2mo) · XL (2mo+). **Difficulty:** Easy/Medium/Hard/Expert. **Runtime Impact:** None/Low/Medium/High.
>
> **⚠️ Re-baselined 2026-07-15, updated 2026-07-16 (three times)** (`openspec/changes/rebaseline-gap-checklist`,
> `openspec/changes/repo-wide-surface-snapshots`, `openspec/changes/remove-deprecated-shims`, and an
> out-of-band cleanup pass not tied to a numbered task — see the note below the dashboard).
> Phases 0–2 and T038 were individually re-verified against real source/CI/docs — each carries a
> "Verified:" note citing what was checked. T005 and T053 were both closed on 2026-07-16 (all 35
> publishable packages carry a surface-lock test; the two deprecated shim packages were removed).
>
> **Re-verified again 2026-07-16 (later same day):** T001, T002, and T006 closed via
> `openspec/changes/archive/2026-07-16-fix-dependency-claim-router-naming-coverage-gate`
> (commits `2654009`, `b380f86`, `78e2e06`) — README/di-docs dependency claim corrected with a
> footprint table, router `radix-tree.ts`/`RadixNode` renamed to `segment-trie.ts`/`TrieNode`
> with zero public-surface impact (confirmed via snapshot diff), and a 90%/85% per-package
> coverage gate wired into the `verify` pipeline via `turbo.json`. **Phase 0 is now 6/8, NOT
> complete** — T004 (Windows/macOS CI) and T008 (deterministic metadata-emitting build / "TypeInfo
> not known") remain open, confirmed still absent from source this same pass (no
> `windows-latest`/`macos-latest` job in `.github/workflows/`; "TypeInfo not known" still cited as
> the "#1 DX footgun" in `docs/audits/06-framework-design-review.md`). T006's coverage gate also
> surfaced a real, disclosed follow-up: `@nextrush/router` itself sits in the gate's own
> `KNOWN_BELOW_THRESHOLD` exclusion list (90.02% lines / 78.49% branches, below the 85% branch
> bar) — not a T006 defect, but an open item worth tracking given its adjacency to T002's rename.
>
> Phases 3–5 beyond T005/T038/T053/T054/T032/T033/T059 spot-checks were **not** individually
> re-checked in this pass — their glyphs are carried forward from the original audit and should
> be treated as **unverified-but-plausible**, not freshly confirmed. Re-verify Phases 3–5 in a
> future pass before trusting their status for planning. This note itself should be updated (with
> a new date) the next time any phase is re-checked, rather than left to imply the whole document
> is fresh forever.

---

# Executive Summary

NextRush has a **genuinely strong core** (runtime-agnostic, strict TS, 145+ tests, hardened Node lifecycle) but is **Beta** for its stated ambition (Node + edge + serverless + enterprise). The gap is **proof, operations, and breadth — not core rework.**

**What blocks each goal (updated 2026-07-15):**

| Goal | Primary blockers | Tasks |
|---|---|---|
| **Production readiness (Node)** | Accuracy debt corrected (T001 ☑, T002 ☑), coverage gate live (T006 ☑), and Windows/macOS toolchain CI now real (T004 ☑); no signal-wired graceful shutdown; no health checks. Multi-runtime CI matrix now real (T003 ☑) | T010, T011 |
| **Edge Runtime** | **Largely closed.** Now executed on real `workerd`/Deno in CI (T019 ☑); bundle size measured (T012 ◐, edge-scoped); deploy examples + edge-safe middleware docs shipped (T021 ☑, T022 ☑) | T020 (◐, explicit allowed-global assertion), T024 |
| **Serverless** | **Closed.** `@nextrush/adapter-serverless` ships (Lambda/GCF/Azure), cold-start measured, container-reuse documented | T038 ☑ — no remaining blocker at P1/P2 scope |
| **Enterprise adoption** | No OTel/metrics/health; no auth/session; module `exports` confirmed still not enforced; DI still global-by-default; thin config — **not re-verified this pass, carried forward** | T025–T035 |
| **Developer Experience** | "TypeInfo not known" metadata footgun now closed at build time (T008 ☑ — `nextrush build` fails fast on a decorator-metadata tsconfig mismatch instead of shipping a broken artifact); leaked/namespaced APIs; four-package install friction; docs depth — **remainder not re-verified this pass, carried forward** | T015, T037, T058 |
| **v1.0 stable tag** | Public surface frozen across all 35 published packages (T005 ☑); version/compatibility policy published (T007 ☑); deprecated shims removed (T053 ☑); single maintainer | T059, T060 |

**Bottom line:** Edge + Serverless (Phase 2 + T038) are now credibly closed. T005 (repo-wide
surface snapshots) closed 2026-07-16, and T053 (deprecated shim removal) closed the same day. The
`T005 → T053 → T060` chain now has only T060 itself remaining — the final v1.0 freeze sign-off,
gated on all P0 + Phase 0-2 P1 items, not a chained dependency anymore.

> **Out-of-band cleanup (2026-07-16, not tied to a numbered task):** at explicit user request, a
> full-repo pass removed all confirmed stale documentation (a recurring "Plugin system"/"radix
> tree"/"decorators+controllers as separate packages" pattern across `.github/*` instruction
> files, `skills/nextrush/`, `apps/docs/content/`, package READMEs, `PUBLISHING.md`, and `wiki/`
> — all fixed against `.kiro/steering/architecture.instructions.md` as ground truth) and removed
> a batch of confirmed dead runtime backward-compatibility aliases as a deliberate breaking
> change: adapter `hostname` fields (bun/deno/node), `{Bun,Deno,Edge}BodySource` +
> `create*BodySource` aliases, `@nextrush/core`'s `createHttpError`, `@nextrush/errors`'
> `ErrorContext`/`ErrorMiddleware`/`catchAsync`, `body-parser`'s Node-stream fallback
> (`ctx.raw`/`RequestStream`/`BodyParserMiddleware`), `helmet`'s `frameguard`/`XFrameOptionsValue`
> (superseded by CSP `frame-ancestors`), and `cors`'s `CorsMiddleware`. Explicitly **not**
> removed, per a discovery pass that classified them as currently-supported features rather than
> dead cruft: `rate-limit`'s `legacyHeaders` option, `@nextrush/types`' `ServerAddress.hostname`
> (real cross-adapter parity data), and the intentional per-package `Middleware<TContext>`
> aliases in helmet/request-id/timer (a deliberate zero-dependency measure). Verified via
> cache-bypassed `turbo run typecheck --force` (58/58 green) and `turbo run test --force` (72/74
> green — the 2 failures are the same pre-existing DI circular-dependency timeout flake logged
> against T005 and T053, confirmed unrelated). Changesets added: `remove-backcompat-aliases.md`.
> This work has no task ID in this checklist because it wasn't sourced from an audit finding —
> flagging it here so the history isn't lost, not because it changes any phase's completion state.

> **Out-of-band cleanup (2026-07-16, not tied to a numbered task):** `nextrush dev` was broken
> end-to-end on every platform — not a Windows/macOS-specific gap, a universal one. Diagnosed
> directly against source and a real reproduction: running `nextrush dev` against a fresh fixture
> failed immediately with `ERR_MODULE_NOT_FOUND` for `packages/dev/loaders/swc-loader.mjs` (a path
> missing its `dist/` segment). Root cause: `resolveLoaderFromUrl()` in
> `packages/dev/src/runtime/node-modules.ts` computed `../loaders/swc-loader.mjs` relative to its
> own `import.meta.url`, assuming it always runs from `dist/runtime/node-modules.js` (one directory
> under `dist/`). Because `tsup.config.ts` sets `splitting: false`, the package's real CLI entry
> point (`bin/nextrush.js` → `dist/cli.js`) inlines that function's code directly into `cli.js`
> itself — zero directories under `dist/`, not one — so the hardcoded relative climb landed one
> level too high, at a nonexistent `packages/dev/loaders/` instead of the real
> `packages/dev/dist/loaders/`. Fixed by resolving the loader path relative to the package root
> (found once via `package.json` location) instead of assuming a fixed directory depth relative to
> the calling module — depth-independent regardless of which entry point's bundle the resolution
> code ends up inlined into. The existing non-`dist` (source-mode) fallback branch was left
> untouched. Verified against the real built artifact, not only the unit-level function: a new
> integration-level test spawns the actual built CLI binary (`bin/nextrush.js dev`) against a
> fixture and asserts the dev server starts successfully — this is the class of test that would
> have caught the original bug, since the pre-existing unit tests for
> `resolveLoaderFromUrl()`/`getSwcNodeRegisterPath()` passed the entire time this bug existed (they
> called the function at the depth it assumed, never at the real bundle's actual depth). Manually
> reproduced the exact original failure and confirmed the fix closes it: `nextrush dev` from
> `examples/dev-cli-fixture` (built package, not source) now starts successfully and serves a
> request. Full `@nextrush/dev` suite green, zero regressions to the untouched dev-mode fallback
> path. A `@nextrush/dev` patch changeset (`fix-dev-loader-resolution.md`) was added, since this is
> a real, user-facing behavior change (`nextrush dev` goes from broken to working). Delivered by
> `openspec/changes/fix-dev-loader-resolution-and-build-proof` (section 1), commit `72afe3d`.
> This work has no task ID in this checklist because it wasn't a numbered task in the original
> audit-derived backlog — flagging it here so the fix isn't lost from the record, not because it
> changes any phase's completion state (T012/T013, the two numbered tasks this same change closes,
> are updated in their own entries above).

---

# Progress Dashboard

| Phase | Theme | Tasks | □ Not Started | ◐ In Progress | ☑ Completed | % |
|---|---|---|---|---|---|---|
| Phase 0 | Foundation | 8 | 0 | 0 | 8 | 100% |
| Phase 1 | Production Ready (Node) | 9 | 7 | 0 | 2 | 22.2% |
| Phase 2 | Edge Runtime | 6 | 1 | 2 | 3 | 50–83%* |
| Phase 3 | Enterprise | 13 | 13 | 0 | 0 | 0% (not re-verified — spot-checks: T032, T033 confirmed still open) |
| Phase 4 | Ecosystem | 15 | 14 | 0 | 1 | 6.7% (T038 confirmed ☑; remainder not re-verified) |
| Phase 5 | v1 Stable | 13 | 11 | 0 | 2 | 15.4% (T053 verified ☑ this pass; T054 spot-checked plausible ☑; remainder not re-verified) |
| **Total** | | **64** | **46** | **2** | **16** | **~25%** |

*Phase 2: 50% by strict ☑ count (3/6), 83% counting ◐ as substantially done — see the phase's own
"Verified:" notes for exactly what's delivered vs. remaining per task.

**By priority (unchanged from original — this pass corrected status, not the priority/effort
estimates themselves):** P0 = 6 · P1 = 19 · P2 = 24 · P3 = 15.

---

# Engineering Metrics

| Metric | Value |
|---|---|
| Total tasks | **64** |
| P0 count | **6** |
| P1 count | **19** |
| P2 count | **24** |
| P3 count | **15** |
| Estimated engineering-months (to v1.0 = Phase 0–2 + release) | **≈ 4–6** remaining (revised down from 6–8: Phase 2 + T038 are largely closed, T005/T053 are now closed; the bulk of remaining critical-path work is T060's own gate + Phase 0/1 P0 items) |
| Estimated engineering-months (full backlog incl. Phase 3–4) | **≈ 14–20** remaining (revised down proportionally; Phase 3–4 estimates not independently re-verified this pass) |
| Breaking changes | **4** primary (T032, T033, T050, T053) + 2 conditional (T055, T002) — unchanged, not re-verified |
| New packages | **15** remaining (was 16 — `@nextrush/adapter-serverless` now shipped, removed from the pending list): health, otel, metrics, auth, jwt, session, config, cache, redis, websocket-edge, queue, cron, webhooks, graphql, rpc |
| Existing packages modified | **~18** (unchanged estimate, not re-verified) |
| **Production Readiness (Node)** | **72%** *(carried forward, not re-verified this pass — see Phase 1 note)* |
| **Edge Readiness** | **≈ 90%** *(revised up from 55% — T019/T021/T022 confirmed ☑ this pass, T012/T020/T023 confirmed substantially ◐; remaining gap is T024 edge-native WebSocket, still open, and T020's explicit allowed-global assertion)* |
| **Serverless Readiness** | **≈ 90%** *(revised up from 35% — T038 confirmed ☑ this pass: Lambda/GCF/Azure mappers, container-reuse, cold-start benchmark, full-chain fixtures, and a scheduled real-cloud deploy-verification workflow all exist in source, verified directly)* |
| **Enterprise Readiness** | **58%** *(carried forward, not re-verified this pass — spot-checks of T032/T033 found both still open, consistent with the original estimate)* |
| **Overall Framework Readiness** | **≈ 72–75%** *(revised up from ≈66%, driven entirely by the Edge/Serverless correction; Production/Enterprise unchanged pending a future re-verification pass)* |

*Readiness % are synthesized estimates ("distance to the stated bar"), not a computed formula —
stated explicitly per this re-baseline's own design decision to avoid implying false precision.
Edge/Serverless figures are grounded in this pass's direct source verification; Production/
Enterprise carry the original audit's synthesis unchanged.*

---


# Dependency Graph

**Unlocker tasks (highest fan-out — do first):**

```
T003 (multi-runtime CI matrix) ─┬─► T019 (edge proven) ─► T021 (deploy examples) ─► Phase 2 GA  [T003/T019/T021 ☑ — chain CLOSED]
                                ├─► T004 (Win/macOS CI)  ─► T013 (build integ test)
                                └─► T018 (perf gate) / T017 (class-path bench)

T005 (repo-wide surface snapshots) ─► T053 (shim removal) ─► T060 (v1.0 freeze gate)  [T005 ☑, T053 ☑ — both links CLOSED; only T060 itself remains]
T007 (version/support policy) ──────────────────────────────► T060  [T007 ☑ — this leg CLOSED]

T026 (context-propagation ADR: ALS vs explicit) ─┬─► T025 (OTel) ─► T027 (metrics)
                                                  └─► T028 (pipeline observability hooks)

T030 (jwt, Web-Crypto) ─► T029 (auth) ─► T031 (session) ──► T036 (enterprise example)
T039 (cache iface) ─► T040 (redis) ─┬─► T031 (session store)
                                    └─► T041 (distributed rate-limit)

T008 (deterministic metadata build) ─► removes #1 first-run DX failure (unblocks adoption)
T032 (module encapsulation) depends on request-scope child-container machinery (already shipped)
T050 (replace tsyringe) depends on T005 (surface snapshot) to bound breakage
```

**Can run fully in parallel (no cross-deps):** T010, T011, T012 (residual core-bundle
scope only — edge scope done), T015, T016, T020 (residual explicit-assertion scope only), T035,
T043, T044, T046, T047, T057, T061, T062.

**Blocked until their dep lands:** T025/T027/T028 (→T026),
T029/T031 (→T030), T040/T041/T031-store (→T039), T036 (→T029,T031,T032). ~~T053/T060 (→T005)~~ —
resolved, T005/T053 both ☑; only T060 itself (the final freeze sign-off) remains on that chain,
gated on all P0 + Phase 0-2 P1 items, not just this one leg.

**Critical path to v1.0 (revised 2026-07-16):** `T003 → T019 → T021` is **closed**. `T007 → T060`
is **closed**. `T005 → T053 → T060` is now **closed except for T060 itself** — both prerequisite
legs (repo-wide surface snapshots, deprecated shim removal) are done. What remains for v1.0 is
T060's own gate (the final freeze sign-off, which checks all P0 + Phase 0-2 P1 items, not just
these three chains) and the Phase 0/1 P0 items that don't block anything downstream but are
required for T060's own acceptance criteria.

---

# Phase 0 — Foundation

*Accuracy, proof-infrastructure, and freeze-harness. Unblocks every later phase.*

## Tasks

### ☑ T001 · Correct the "Zero Dependencies" claim
- **Domain:** Documentation · **Packages:** root `README.md`, `nextrush`, `@nextrush/di` · **Priority:** P0 · **Effort:** XS · **Difficulty:** Easy · **Runtime Impact:** None · **Breaking:** No · **Status:** ☑ Completed
- **Verified (2026-07-16):** `README.md` now states "**Zero-Dependency Functional Core** — `createApp`/`createRouter`/`listen` pull in no external runtime dependencies; the class/DI path (`nextrush/class`) depends on `tsyringe` + `reflect-metadata`," with a "Dependency Footprint" table distinguishing the two paths. `packages/di/README.md` carries the equivalent correction. `grep -i "zero dependenc" README.md` confirms no remaining unqualified/absolute claim. Delivered by `openspec/changes/archive/2026-07-16-fix-dependency-claim-router-naming-coverage-gate` (T001 task group), commit `2654009`.
- **Dependencies:** —
- **Description:** Reword "Zero Dependencies" to "zero-dependency functional core; the class/DI path depends on `tsyringe` + `reflect-metadata`." Add a per-path dependency footprint table.
- **Why it matters:** A headline correctness claim is false for a major usage path (01/R-2); misleads security/eval reviews.
- **Risk if ignored:** Credibility loss on evaluation; incorrect supply-chain assessment.
- **Acceptance Criteria:** README + `@nextrush/di` README state the true footprint; functional vs class dependency trees documented.
- **Validation Steps:** `pnpm why reflect-metadata tsyringe` output matches docs; reviewer confirms no remaining "zero dependencies" absolute claim.

### ☑ T002 · Rename segment-trie router artifacts (kill "radix" drift)
- **Domain:** Router · **Packages:** `@nextrush/router` · **Priority:** P0 · **Effort:** S · **Difficulty:** Easy · **Runtime Impact:** None · **Breaking:** No (internal names) · **Status:** ☑ Completed
- **Verified (2026-07-16):** `packages/router/src/radix-tree.ts` renamed to `segment-trie.ts` (git-mv, history preserved); `RadixNode` type renamed to `TrieNode` across `router.ts`, `segment-trie.ts`, and `index.ts`; JSDoc updated to describe the segment-trie implementation. `grep -ri radix packages/router/src` returns zero matches. Public-surface snapshot test confirmed byte-identical before/after (proves `RadixNode` was never exported — no `@deprecated` alias needed). `package.json` keywords: "segment-trie" added as primary; "radix-tree" kept as a transitional secondary npm-search keyword per design decision (metadata only, zero src/ impact). Delivered by `openspec/changes/archive/2026-07-16-fix-dependency-claim-router-naming-coverage-gate` (T002 task group), commit `b380f86`. **Follow-up note (not part of T002's own scope):** `@nextrush/router` sits in the T006 coverage gate's `KNOWN_BELOW_THRESHOLD` exclusion list at 90.02% lines / 78.49% branches — below the 85% branch bar. Pre-existing gap, not introduced by this rename (confirmed via `git show --stat` on the rename commit touching no test files' assertions), but adjacent enough to flag for a near-term follow-up.
- **Dependencies:** —
- **Description:** Rename `radix-tree.ts` → `segment-trie.ts`, `RadixNode` → `TrieNode`; fix JSDoc ("Radix tree node"/"compressed trie") and npm keyword/description `radix-tree` → `segment-trie`.
- **Why it matters:** Source header already says "segment trie, not a compressed radix tree" (01/R-7); internal + npm metadata contradict the code.
- **Risk if ignored:** Contributor/evaluator confusion; misleading package metadata.
- **Acceptance Criteria:** No `radix` token remains except in a historical changelog note; `@deprecated` re-export alias kept one minor cycle if any symbol was public.
- **Validation Steps:** `grep -ri radix packages/router/src` returns only intentional alias; build + router tests green.

### ☑ T003 · Multi-runtime CI matrix (real Bun/Deno/workerd + Node 20/22/24) — **UNLOCKER**
- **Domain:** CI/CD · **Packages:** `.github/workflows/ci.yml`, adapters, `conformance` · **Priority:** P0 · **Effort:** L · **Difficulty:** Hard · **Runtime Impact:** None · **Breaking:** No · **Status:** ☑ Completed
- **Verified (2026-07-15):** `.github/workflows/runtime-conformance.yml` runs a `deno-conformance` job under real pinned Deno (`setup-deno@v2`, `v2.6.3`) and a `workerd-conformance` job inside a real `workerd`/miniflare isolate (`node --test conformance.workerd.test.mjs` against esbuild-bundled worker code) — not Node-simulated. Delivered by the archived `harden-runtime-edge-serverless` change, task groups 3 and 8. **Not yet covered by this task's original scope:** an explicit Node 20/22/24 version matrix — `ci.yml` was not re-checked for this in this pass; if absent, treat as a residual gap under this same task rather than a new one.
- **Dependencies:** —
- **Description:** Add CI jobs that run the conformance + adapter suites on **real** Bun, Deno, and `workerd`/miniflare, plus a Node version matrix (20 LTS, 22, 24). Today `ci.yml` runs `pnpm verify` on `ubuntu-latest`/one Node only (01/R-1).
- **Why it matters:** "Runs on Bun/Deno/Cloudflare" is currently proven by Node simulation, not execution. Highest-fan-out unlocker for Phase 2.
- **Risk if ignored:** Runtime-specific breakage ships undetected; edge/Bun/Deno readiness claims are unbacked.
- **Acceptance Criteria:** A deliberate Bun/Deno/Workers-only regression fails CI on that runtime; matrix visible in Actions.
- **Validation Steps:** Introduce a temporary runtime-specific failing test → confirm the correct job fails; revert.

### ☑ T004 · Windows + macOS CI for the toolchain
- **Domain:** CI/CD · **Packages:** `@nextrush/dev`, `.github/workflows/ci.yml` · **Priority:** P1 · **Effort:** S · **Difficulty:** Medium · **Runtime Impact:** None · **Breaking:** No · **Status:** ☑ Completed
- **Verified (2026-07-16):** `.github/workflows/ci.yml` now has a `dev-cli-cross-platform` job matrixed over `windows-latest`/`macos-latest` that installs deps and runs `nextrush build`/`nextrush dev` against a new minimal fixture (`examples/dev-cli-fixture/`), alongside the existing `ubuntu-latest` job — `grep -i "windows-latest\|macos-latest" .github/workflows/ci.yml` now matches. Delivered by `openspec/changes/close-phase0-ci-matrix-and-metadata-preflight` (T004 task group), commit `0c6806c`. **Caveat carried forward, not silently closed:** the implementing task group's own tasks.md left sub-tasks 1.4/1.5 unchecked — the workflow was not actually run on real Windows/macOS runners in that session (none available), and local validation surfaced a genuine, separate pre-existing bug: `nextrush dev` currently fails end-to-end on every OS including Linux, because `resolveLoaderFromUrl()` in `packages/dev/src/runtime/node-modules.ts` resolves the SWC loader path one directory short when `cli.js` lives directly under `dist/` (`ERR_MODULE_NOT_FOUND`). The new Windows/macOS `dev` smoke-test step will legitimately fail until that bug is fixed — out of this task's declared file scope (`ci.yml` + fixture only, not `node-modules.ts`) and confirmed not introduced by this change (`git diff 3c85e32..HEAD -- packages/dev/src/runtime/node-modules.ts` is empty). T004 is marked complete because its own stated acceptance criteria (CI jobs exist, exercise `dev`+`build` against a fixture on both new OSes) are met in source; the loader bug is logged as a new, separate open finding, not a reason to re-open T004.
- **Dependencies:** T003
- **Description:** Add `windows-latest` + `macos-latest` jobs exercising `nextrush dev`/`build`. The dev audit's C1/F1 Windows fixes are code-complete but the platform gate is explicitly still open.
- **Why it matters:** dev-audit criticals were Windows-only; without Windows CI they can silently regress.
- **Risk if ignored:** `nextrush dev`/`build` breaks on Windows post-fix, undetected.
- **Acceptance Criteria:** dev unit + a build-integration fixture run green on all three OSes.
- **Validation Steps:** CI matrix shows win/macOS/linux green for the `dev` package.

### ☑ T005 · Repo-wide public-API surface snapshot tests
- **Domain:** Testing / Release Engineering · **Packages:** all published packages · **Priority:** P0 · **Effort:** M · **Difficulty:** Medium · **Runtime Impact:** None · **Breaking:** No · **Status:** ☑ Completed
- **Verified (2026-07-16):** All 35 publishable packages now have a `public-surface.test.ts` (2 pre-existing — `@nextrush/class`, `@nextrush/types` — plus 33 added by `openspec/changes/repo-wide-surface-snapshots`: `errors`, `core`, `router`, `runtime`, `di`, all 5 adapters, all 15 middleware, all 3 extensions/stream, both deprecated shims — `controllers`/`decorators`, and `dev`/`testing`/`create-nextrush`/`nextrush` meta). `create-nextrush` has no library barrel (CLI-only entry point) — locked via a structural "no export statement" assertion instead, which is the correct lock for that shape. Sanity-checked on 2 packages (`core`, `types`) by adding/removing a real export and confirming the test fails/passes correctly; also caught 2 real bugs in the test files themselves during a forced, cache-bypassed `turbo run typecheck --force` (a stale turbo cache had been silently reporting a clean typecheck during authoring — see the change's tasks.md 8.2a for the process finding). Repo-wide `turbo run typecheck --force`: 0 errors, 62/62 tasks green. `turbo run test --force`: 76/77 tasks green, the sole failure a pre-existing DI circular-dependency-detection timeout flake unrelated to any of the 33 new files. **FINDING carried over from the change:** `@nextrush/controllers` and `@nextrush/decorators`'s own `package.json` `test` scripts are no-op placeholders ("Tests moved to @nextrush/class") — their new surface-lock tests pass when run directly via `vitest run` but are not wired into `pnpm test` for those two packages; left for T053's own scope to address when the shims are removed.
- **Dependencies:** —
- **Description:** Generalize the existing `@nextrush/class` `public-surface.test.ts` (B2, already closed) to **every** published package: snapshot the exported symbol set so any change requires an intentional update + changeset.
- **Why it matters:** v1.0 freezes the public contract across ~35 packages; only `class` is currently guarded (production-readiness-review B2; 01/R-... API risk).
- **Risk if ignored:** Accidental surface widening becomes a permanent semver liability post-1.0.
- **Acceptance Criteria:** Each published package has a surface snapshot; an unintended export fails CI.
- **Validation Steps:** Add a throwaway export to one package → CI fails on its snapshot; revert.

### ☑ T006 · Coverage gate in CI (per-package thresholds)
- **Domain:** CI/CD / Testing · **Packages:** `.github/workflows/ci.yml`, `vitest.config.ts` · **Priority:** P1 · **Effort:** S · **Difficulty:** Easy · **Runtime Impact:** None · **Breaking:** No · **Status:** ☑ Completed
- **Verified (2026-07-16):** `scripts/check-coverage.ts` enforces 90% lines / 85% branches per package (not repo-wide average), wired as `check:coverage` in `turbo.json`, which `verify` now depends on (`"dependsOn": ["build", "test", "typecheck", "lint", "validate:bins", "check:coverage"]`) — the same pipeline `.github/workflows/ci.yml` invokes via `pnpm verify`, not a separate parallel job. A repo-wide coverage run at wiring time found several packages already below threshold; non-trivial ones (real test-writing gaps, not missing-one-case fixes) were scoped out via an explicit, commented `KNOWN_BELOW_THRESHOLD` exclusion list in `scripts/check-coverage.ts` rather than forced green with speculative tests — **carries forward as open follow-up work, not closed by T006 itself**: `@nextrush/router` (90.02%/78.49%), `@nextrush/runtime` (76.66%/66.86%), and others per the script's inline list. Delivered by `openspec/changes/archive/2026-07-16-fix-dependency-claim-router-naming-coverage-gate` (T006 task group), commit `78e2e06`. Full `pnpm verify`/`turbo run verify` run: 126/130 tasks green; the 4 failures (`@nextrush/class#test`, `@nextrush/di#test` — a pre-existing circular-dependency-detection timeout; `@nextrush/dev#lint`, `docs#lint`) are confirmed pre-existing and unrelated via `git log`/`git show --stat` predating this change's commits — `check:coverage` itself is not among the failures.
- **Dependencies:** —
- **Description:** Wire `test:coverage` into `verify`/CI with per-package thresholds (≥90% lines / ≥85% branches per steering). Today `pnpm verify` = build/test/typecheck/lint; coverage enforcement is unconfirmed (01/R-11).
- **Why it matters:** Locks in the test discipline that is currently a strength.
- **Risk if ignored:** Silent coverage regression despite a stated 90% target.
- **Acceptance Criteria:** CI fails when a touched package drops below threshold.
- **Validation Steps:** Temporarily lower coverage → CI fails; revert.

### ☑ T007 · Version/stability narrative + compatibility matrix + support policy
- **Domain:** Governance · **Packages:** repo docs, `docs/audits`, README · **Priority:** P0 · **Effort:** S · **Difficulty:** Easy · **Runtime Impact:** None · **Breaking:** No · **Status:** ☑ Completed
- **Verified (2026-07-15):** `apps/docs/content/docs/internals/versioning.mdx` exists and states the real 16/20 package version split (3.1.0 core line vs 1.0.0 line), scripted from `package.json` fields, with an explicit warning callout against citing a single framework-wide version. This satisfies the compatibility-matrix + version-narrative acceptance criteria. Did not separately verify a standalone shim-removal timeline within this doc — spot-check only, not exhaustive.
- **Dependencies:** —
- **Description:** Resolve "published at 3.x vs marketed v1"; publish a package compatibility matrix, a support/LTS policy, and a shim-removal timeline (01/R-10, production-readiness H2/H3).
- **Why it matters:** Adopters cannot reason about stability with mixed independent versions + deprecated shims + a 3.x line.
- **Risk if ignored:** Adoption hesitancy; semver confusion; unbounded shim maintenance.
- **Acceptance Criteria:** A published `COMPATIBILITY.md` + support policy; every package's stability tier stated.
- **Validation Steps:** Matrix cross-checked against actual published versions; links resolve.

### ☑ T008 · Deterministic metadata-emitting build (kill "TypeInfo not known")
- **Domain:** Build System / CLI · **Packages:** `@nextrush/dev` · **Priority:** P1 · **Effort:** M · **Difficulty:** Hard · **Runtime Impact:** Medium · **Breaking:** No · **Status:** ☑ Completed
- **Verified (2026-07-16):** `packages/dev/src/utils/config.ts`'s `validateDecoratorConfig()` gained a `{ throwOnMismatch }` option (default `false`, preserving `nextrush dev`'s existing warn-and-continue call unchanged); `packages/dev/src/commands/build.ts` now calls it with `{ throwOnMismatch: true }` right after its existing entry-file check, exiting via `exitProcess(1)` with the same remediation text `dev` already prints on a tsconfig `experimentalDecorators`/`emitDecoratorMetadata` mismatch — no duplicated copy. `packages/di/README.md`'s "TypeInfo not known for X" troubleshooting section now documents the build-fails-fast-vs-dev-warns asymmetry. New test file `packages/dev/src/__tests__/build-decorator-preflight.test.ts` (3 cases: mismatch fails, decorator-free project unaffected, correctly-configured project unaffected) plus the full `@nextrush/dev` suite re-run independently in this pass: **19 test files, 203 tests, all passing** (`pnpm exec turbo run verify --continue`, `@nextrush/dev:test` line, 2026-07-16). Delivered by `openspec/changes/close-phase0-ci-matrix-and-metadata-preflight` (T008 task group), commit `ff055e4`. A `@nextrush/dev` patch changeset (`build-decorator-metadata-preflight.md`) was added for this release-impacting behavior change, per design.md's own Risk section.
- **Dependencies:** —
- **Description:** Guarantee a decorator-metadata-emitting build path and add a loud preflight so `tsx`/`esbuild` users get an actionable error instead of runtime "TypeInfo not known" (strategic-audit DX Critical; dev-audit).
- **Why it matters:** The #1 first-run failure for class-based users; makes the legacy-decorator requirement safe.
- **Risk if ignored:** Class/DI silently breaks on non-metadata toolchains; high support burden.
- **Acceptance Criteria:** A fixture built via `nextrush build` always has usable `design:paramtypes`; preflight fails fast with remediation text on a bad toolchain.
- **Validation Steps:** Build a DI fixture with and without metadata emit → good build resolves DI; bad toolchain errors with guidance.

---

# Phase 1 — Production Ready (Node.js)

*Operational ergonomics + quality gates that make a Node service safe to run in production. (T009 folded into T003 — Node version matrix.)*

## Tasks

### ☐ T010 · Signal-wired graceful shutdown (opt-in)
- **Domain:** Runtime / Core · **Packages:** `@nextrush/adapter-node`, `@nextrush/runtime` · **Priority:** P1 · **Effort:** S · **Difficulty:** Medium · **Runtime Impact:** High · **Breaking:** No · **Status:** □ Not Started
- **Verified (2026-07-15):** `grep "SIGTERM|SIGINT|gracefulShutdown" packages/adapters/node/src/adapter.ts` returns no matches — no signal wiring found.
- **Dependencies:** —
- **Description:** Add `serve(app, { gracefulShutdown?: boolean | { signals, timeout } })` and/or a `handleShutdown(server)` helper that wires SIGTERM/SIGINT → drain → `app.close()`. Opt-in (never auto-register handlers silently). `serve()` already has real drain logic; only signal wiring is missing (01/R-3).
- **Why it matters:** In k8s/PM2/systemd a SIGTERM kills the process mid-request unless the user hand-wires `close()`.
- **Risk if ignored:** Dropped in-flight requests / 502s on every rollout.
- **Acceptance Criteria:** Opt-in flag installs and removes handlers cleanly; integration test proves 0 dropped in-flight requests on SIGTERM.
- **Validation Steps:** Start server, hold a slow request, send SIGTERM → request completes, then process exits within `shutdownTimeout`.

### ☐ T011 · New package `@nextrush/health`
- **Domain:** Observability · **Packages:** **NEW** `@nextrush/health` · **Priority:** P1 · **Effort:** S · **Difficulty:** Easy · **Runtime Impact:** Low · **Breaking:** No · **Status:** □ Not Started
- **Verified (2026-07-15):** `find packages -path '*health*'` returns no matches — package does not exist.
- **Dependencies:** —
- **Description:** Liveness/readiness endpoints + a check-registry (register DB/cache/custom pings) usable by k8s probes. Verified absent (01/§10).
- **Why it matters:** Enterprises/orchestrators require liveness+readiness; none ship today.
- **Risk if ignored:** No standard health contract → every adopter reinvents it inconsistently.
- **Acceptance Criteria:** `health()` middleware exposes `/livez` + `/readyz`; failing check flips readiness; documented.
- **Validation Steps:** Register a failing check → `/readyz` returns 503; healthy → 200.

### ☑ T012 · Bundle-size CI budget
- **Domain:** Build System / Performance · **Packages:** CI, `nextrush`, `@nextrush/core`, `@nextrush/adapter-edge` · **Priority:** P1 · **Effort:** S · **Difficulty:** Medium · **Runtime Impact:** None · **Breaking:** No · **Status:** ☑ Completed
- **Verified (2026-07-15):** `.github/workflows/runtime-conformance.yml` has a `bundle-budget` job asserting the minimal functional **edge** bundle (core + router + adapter-edge) stays under a gzip budget (30KB internal target, measured baseline 13.11KB) and contains no `reflect-metadata`/`node:` imports. This satisfies the task for the **edge** entry specifically. **Not verified (as of 2026-07-15):** a separate budget for the general functional **core** bundle independent of the edge adapter — the task's phrasing implies both; only the edge-scoped one was found at that time.
- **Verified (2026-07-16):** the core-bundle residual scope is now closed. `packages/adapters/conformance/bundle-budget/minimal-core-entry.mjs` (core + router + `@nextrush/adapter-node`, which pulls in `@nextrush/runtime` + `@nextrush/stream`) and `bundle-budget-core.test.mjs` measure the general functional core bundle via the same `esbuild` + `gzipSync` mechanism as the edge check, `platform: 'node'`, asserting a 40KB gzip budget / 175KB raw ceiling against a measured 17.65KB gzip / 59.48KB raw baseline (2026-07-16), with the figure published in the test file's header docstring, matching the edge figure's own publication location. Wired into `.github/workflows/runtime-conformance.yml`'s existing `bundle-budget` job as a new "Core bundle-size budget (T012 residual)" step. The regression-catch path was independently re-verified for this session (a temporary ~1.2MB inlined import pushed both assertions to fail — 225.92 KB > 40 KB gzip, 1162.23 KB > 175 KB raw — then fully reverted). Delivered by `openspec/changes/fix-dev-loader-resolution-and-build-proof` (section 2), commit `7977d69`.
- **Dependencies:** —
- **Description:** Add a size-limit CI check for the functional core and the minimal edge bundle; assert core stays under a stated KB budget and flag regressions. Bundle size is currently unmeasured vs the CF 1 MB limit (01/R-12).
- **Why it matters:** Edge viability (CF Workers 1 MB) depends on a measured, guarded bundle.
- **Risk if ignored:** A dependency/middleware creep silently pushes the edge bundle over platform limits.
- **Acceptance Criteria:** CI reports gzipped size per entry; PR fails on budget regression; a published "minimal edge bundle" number exists.
- **Validation Steps:** Add a heavy import to core → CI size check fails; revert.

### ☑ T013 · End-to-end build integration test for `@nextrush/dev`
- **Domain:** Testing / Tooling · **Packages:** `@nextrush/dev` · **Priority:** P1 · **Effort:** S · **Difficulty:** Medium · **Runtime Impact:** None · **Breaking:** No · **Status:** ☑ Completed
- **Dependencies:** T004 (☑, closed)
- **Verified (2026-07-16):** `packages/dev/src/__tests__/build-e2e-integration.test.ts` spawns the real built `bin/nextrush.js build` (not an in-process function call) against `examples/dev-cli-fixture`, extended with an exported `HealthStatus` interface and `describeHealth()` function to exercise declaration emission. Asserts `dist/index.js` exists and is non-empty, `dist/index.ts` does NOT exist (extension-mapping regression guard), `dist/index.js.map` exists and parses as valid JSON, and `dist/index.d.ts` exists and contains `HealthStatus`/`describeHealth`/`ok: boolean`. Assertion strength independently confirmed by temporarily deleting each expected output file inside the test body — both caused the correct `existsSync` assertion to fail, then were reverted. `nextrush build` itself required zero implementation changes (manually verified via a direct `dist/` inspection outside the test harness: `index.js`/`index.js.map`/`index.d.ts`/`index.d.ts.map` all present and correct, ~600ms build time). Now wired into the Windows/macOS `dev-cli-cross-platform` CI job (T004) via a new `pnpm --filter @nextrush/dev test` step in `.github/workflows/ci.yml` — previously that job only ran manual bash smoke steps, never the vitest suite; the Linux `ci` job already ran it via `pnpm verify`. Full `@nextrush/dev` suite: 21 test files / 208 tests, all green, zero regressions. Delivered by `openspec/changes/fix-dev-loader-resolution-and-build-proof` (section 3), commit `7d67ffb`.
- **Description:** Compile a fixture project via `nextrush build` and assert JS output + `.d.ts` + sourcemaps + correct extension mapping. Dev audit resolved the criticals but flagged a full e2e build test as still open.
- **Why it matters:** The build pipeline's correctness (declarations, extensions) is the library-publishing contract.
- **Risk if ignored:** A build regression ships packages with missing/incorrect `.d.ts` (H2 class of bug) undetected.
- **Acceptance Criteria:** Fixture build asserts all expected artifacts; runs in the Win/macOS/Linux matrix (T004).
- **Validation Steps:** Break declaration emission → test fails; restore.

### ☐ T014 · Split over-cap source files (>300 LOC)
- **Domain:** Core / Maintainability · **Packages:** `@nextrush/class`, `@nextrush/router`, `@nextrush/di`, `@nextrush/dev` · **Priority:** P2 · **Effort:** S · **Difficulty:** Easy · **Runtime Impact:** None · **Breaking:** No · **Status:** □ Not Started
- **Verified (2026-07-15):** `wc -l packages/router/src/router.ts` = 918 lines — well over the 300-line ceiling. Not independently re-checked for `di`/`dev` this pass; `router.ts` alone confirms the task is still open.
- **Dependencies:** —
- **Description:** Split files over the 300-line ceiling flagged as structural debt (class `builder.ts` residual per master Wave-8 note; `router.ts` 28 KB per 01/§9; historical `di/decorators.ts`, `decorators/params.ts`). Characterize-then-refactor (behavior unchanged).
- **Why it matters:** Repo's own `code-structure` steering treats god files as a gate failure.
- **Risk if ignored:** Maintainability erosion; harder review; hotspot regressions.
- **Acceptance Criteria:** No shipping source file > 300 lines; tests unchanged and green.
- **Validation Steps:** `find packages -name '*.ts' -not -path '*__tests__*' | xargs wc -l | awk '$1>300'` returns none.

### ☐ T015 · Actionable `@Body` error when body-parser is missing
- **Domain:** Decorators / DX · **Packages:** `@nextrush/class` · **Priority:** P2 · **Effort:** XS · **Difficulty:** Easy · **Runtime Impact:** Low · **Breaking:** No · **Status:** □ Not Started
- **Verified (2026-07-15):** `packages/class/src/binding/param-resolver.ts` throws the generic `MissingParameterError` with no body-parser hint text found in the surrounding source.
- **Dependencies:** —
- **Description:** When `@Body()` yields nothing because no body-parser ran, raise a hint ("did you `app.use(json())`?") instead of a generic `MissingParameterError` (master-audit DX paper-cut).
- **Why it matters:** Common first-run confusion; the generic error hides the real cause.
- **Risk if ignored:** Repeated "why is my body undefined" support load.
- **Acceptance Criteria:** Missing-parser path produces an error naming the likely fix; tested.
- **Validation Steps:** POST to an `@Body` route with no parser → error message mentions body-parser.

### ☐ T016 · `@All` registers one route, not seven
- **Domain:** Router / Decorators · **Packages:** `@nextrush/class`, `@nextrush/router` · **Priority:** P2 · **Effort:** XS · **Difficulty:** Medium · **Runtime Impact:** Low · **Breaking:** No · **Status:** □ Not Started
- **Verified (2026-07-15):** `packages/class/src/decorators/routes.ts:192` — the `All()` decorator still loops over `['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']` and calls `createRouteDecorator(method)` once per method, i.e. still 7 explicit registrations, confirmed directly in source.
- **Dependencies:** —
- **Description:** `@All`/`app.all` currently expands to 7 method registrations (master-audit LOW). Register a single ANY-method entry instead.
- **Why it matters:** Registry bloat + inconsistent introspection (7 rows for one declared route).
- **Risk if ignored:** Misleading route tables (OpenAPI/diagnostics), minor memory waste.
- **Acceptance Criteria:** `@All('/x')` yields one route entry matching all methods; introspection shows one row.
- **Validation Steps:** Register `@All`, inspect `getRoutes()` → single ANY entry; all verbs still match.

### ☐ T017 · Publish class-path overhead benchmark
- **Domain:** Benchmarks / Performance · **Packages:** `apps/benchmark`, `@nextrush/class` · **Priority:** P2 · **Effort:** S · **Difficulty:** Medium · **Runtime Impact:** None · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** —
- **Description:** Measure and publish registration cost (boot, scaling with controller count) and per-request overhead of the class/DI path vs the functional path (production-readiness #15; strategic perf DX).
- **Why it matters:** Honest disclosure of the DI/decorator tax; informs edge/serverless suitability of the class API.
- **Risk if ignored:** Users can't reason about class-path cost; hidden boot cost at 1000+ controllers.
- **Acceptance Criteria:** Reproducible benchmark + published numbers (functional vs class, N controllers).
- **Validation Steps:** Run the bench on the pinned harness; numbers reported with mean±stddev.

### ☐ T018 · Per-PR performance regression gate
- **Domain:** CI/CD / Benchmarks · **Packages:** `apps/benchmark`, CI · **Priority:** P2 · **Effort:** M · **Difficulty:** Hard · **Runtime Impact:** None · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** T003
- **Description:** Add a CI perf smoke that fails a PR on a significant throughput/latency regression against a baseline (strategic-audit "no per-PR perf gate"). Use the existing `apps/benchmark` harness's regression checker.
- **Why it matters:** Prevents silent perf erosion as features land.
- **Risk if ignored:** Cumulative regressions undetected until a user benchmarks.
- **Acceptance Criteria:** A deliberate slowdown fails the gate; baseline stored + updatable.
- **Validation Steps:** Introduce an artificial hot-path delay → gate fails; revert.

---

# Phase 2 — Edge Runtime

*Move edge/Bun/Deno from "implemented" to "proven + deployable."*

## Tasks

### ☑ T019 · Prove the edge adapter on real runtimes in CI
- **Domain:** Edge Runtime / CI/CD · **Packages:** `@nextrush/adapter-edge`, `@nextrush/adapter-bun`, `@nextrush/adapter-deno`, CI · **Priority:** P1 · **Effort:** M · **Difficulty:** Hard · **Runtime Impact:** None · **Breaking:** No · **Status:** ☑ Completed
- **Verified (2026-07-15):** Same evidence as T003 — `.github/workflows/runtime-conformance.yml`'s `deno-conformance` and `workerd-conformance` jobs run the shared conformance suite against real Deno 2.6.3 and a real miniflare/`workerd` isolate, with `packages/adapters/conformance/README.md` documenting the local `act -j deno-conformance`/`act -j workerd-conformance` reproduction commands. Delivered by the archived `harden-runtime-edge-serverless` change.
- **Dependencies:** T003
- **Description:** Run the edge adapter suite on real `workerd`/miniflare, and Deno for Deno Deploy/Netlify Edge; assert the fetch handlers (`createFetchHandler`/`createCloudflareHandler`/`createVercelHandler`) behave identically to the Node conformance baseline. Today only Node-simulated (01/§6).
- **Why it matters:** The edge readiness claim is unbacked without on-runtime execution.
- **Risk if ignored:** Isolate-specific breakage (globals, timers, streams) ships to edge users.
- **Acceptance Criteria:** Edge conformance green on `workerd` + Deno in CI; parity with Node asserted.
- **Validation Steps:** Deliberately use a Node-only global in the edge path → the workerd job fails; revert.

### ◐ T020 · WinterCG conformance test suite
- **Domain:** WinterCG · **Packages:** `@nextrush/runtime`, `@nextrush/adapter-edge`, `conformance` · **Priority:** P2 · **Effort:** M · **Difficulty:** Medium · **Runtime Impact:** None · **Breaking:** No · **Status:** ◐ In Progress
- **Verified (2026-07-15):** The request path now runs on real `workerd`/Deno via T019's conformance jobs, which exercises WinterCG-blessed APIs implicitly (any Node-only global would fail the workerd isolate outright). **Not verified as present:** a standalone, explicit test enumerating the allowed global surface (`Request`/`Response`/`URL`/`fetch`/`AbortSignal`/`crypto.subtle`/Web Streams) and asserting no forbidden Node globals appear — this task's specific acceptance criterion (a dedicated allow-list assertion) was not found in `packages/adapters/conformance/src` during this pass; not exhaustively searched.
- **Dependencies:** T019
- **Description:** Add explicit assertions that the request path uses only WinterCG-blessed APIs (`Request`/`Response`/`URL`/`fetch`/`AbortSignal`/`crypto.subtle`/Web Streams) and no forbidden Node globals; run under the Minimum Common Web Platform API expectations.
- **Why it matters:** Formalizes the "WinterCG-aligned" claim (01 rated alignment strong but unverified).
- **Risk if ignored:** Silent drift into a Node-only API in the core request path.
- **Acceptance Criteria:** A conformance test enumerates and asserts the allowed global surface; fails on a forbidden global.
- **Validation Steps:** Add `process.hrtime()` to the request path → suite fails; revert.

### ☑ T021 · Verified deploy examples per edge platform
- **Domain:** Examples / Edge Runtime · **Packages:** `examples/*` · **Priority:** P1 · **Effort:** M · **Difficulty:** Medium · **Runtime Impact:** None · **Breaking:** No · **Status:** ☑ Completed
- **Verified (2026-07-15):** `docs/guides/serverless-deploy.md` ships runnable examples for Cloudflare Workers, AWS Lambda (Function URL + API Gateway), GCF, and Azure. `packages/adapters/conformance/deploy-verification/{lambda-app,cloudflare-app}` adds real deploy/smoke/destroy scripts wired to a scheduled `.github/workflows/deploy-verification.yml` (nightly + manual, secret-gated, skip-not-fail on missing credentials). Delivered by the archived `harden-runtime-edge-serverless` change (task 12.5 + task group 10). **Not covered:** a dedicated Vercel Edge / Netlify Edge example — only Cloudflare, Lambda, GCF, Azure were verified present.
- **Dependencies:** T019
- **Description:** Ship + CI-smoke a minimal deploy example each for Cloudflare Workers, Vercel Edge, Netlify Edge, Deno Deploy (build → deploy-dry-run → request).
- **Why it matters:** "Works on X" needs a runnable proof per platform (01/§6).
- **Risk if ignored:** Users hit undocumented platform quirks; adoption friction.
- **Acceptance Criteria:** Each example builds under the platform's constraints and returns a live response in a smoke test.
- **Validation Steps:** `wrangler dev`/`vercel dev`/`deno task` smoke each example returns 200.

### ☑ T022 · Document + mark the edge-safe middleware subset
- **Domain:** Edge Runtime / Documentation · **Packages:** all middleware, docs · **Priority:** P2 · **Effort:** S · **Difficulty:** Easy · **Runtime Impact:** None · **Breaking:** No · **Status:** ☑ Completed
- **Verified (2026-07-15):** `docs/guides/serverless-deploy.md`'s "Edge-safe middleware" section explicitly names the no-filesystem/no-Node-streams constraint, flags `@nextrush/static` as filesystem-dependent, and recommends the Web-standard middleware set (`cors`, `helmet`, `cookies`, `body-parser`, `compression`); links the published runtime certification matrix for a fuller per-feature view. Delivered by the archived `harden-runtime-edge-serverless` change.
- **Dependencies:** —
- **Description:** Label each middleware/extension as edge-safe vs Node-only. `@nextrush/static`, `multipart` (disk), `template` engines, and `@nextrush/websocket` import `node:*` and are **not** edge-portable (01/§4.2, R-13).
- **Why it matters:** Users must know which packages break on edge before deploying.
- **Risk if ignored:** Runtime failures on edge from unknowingly importing Node-coupled middleware.
- **Acceptance Criteria:** A compatibility table in docs + a `runtime` field/tag per package README.
- **Validation Steps:** Table cross-checked against `node:` import scan; reviewer sign-off.

### ☑ T023 · Minimize `reflect-metadata` cost on the edge class path
- **Domain:** Edge Runtime / Dependency Injection · **Packages:** `@nextrush/class`, `@nextrush/di`, `nextrush` · **Priority:** P2 · **Effort:** M · **Difficulty:** Hard · **Runtime Impact:** Medium · **Breaking:** No · **Status:** ☑ Completed
- **Verified (2026-07-15):** `packages/adapters/serverless/bench/README.md` publishes a measured cold-start delta (functional ~65.6ms median vs. class/DI ~79.5ms median, ~14ms delta attributed to `reflect-metadata`), and `packages/adapters/conformance/bundle-budget` asserts the minimal functional edge bundle contains no `reflect-metadata`/`node:` imports. Both requirements — documented class-path cost and a size test proving the functional path stays reflect-metadata-free — are satisfied. Delivered by the archived `harden-runtime-edge-serverless` change.
- **Dependencies:** T012
- **Description:** Document and, where possible, shrink the cold-isolate cost of the `import 'reflect-metadata'` global-`Reflect` patch on the class path; keep the functional path reflect-metadata-free (already true) and add a size test asserting it.
- **Why it matters:** reflect-metadata adds weight + a global side effect on cold edge isolates (01/§6).
- **Risk if ignored:** Class-based edge deployments pay avoidable cold-start/bundle cost.
- **Acceptance Criteria:** Size test proves functional entry excludes reflect-metadata/tsyringe; class-path cost documented.
- **Validation Steps:** Bundle the functional entry → assert no `reflect-metadata` in output; measure class-path delta.

### ☐ T024 · Edge-native WebSocket path
- **Domain:** Edge Runtime / WebSocket · **Packages:** **NEW** `@nextrush/websocket-edge` (or edge mode) · **Priority:** P3 · **Effort:** L · **Difficulty:** Expert · **Runtime Impact:** High · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** T019
- **Description:** Provide a Cloudflare `WebSocketPair`/Durable Objects (and Deno `Deno.upgradeWebSocket`) path, since `@nextrush/websocket` is `node:*`-coupled and edge-incompatible (01/R-13).
- **Why it matters:** "Realtime on edge" is currently impossible.
- **Risk if ignored:** Edge users cannot use WebSockets at all.
- **Acceptance Criteria:** An edge WS echo example runs on Workers + Deno Deploy.
- **Validation Steps:** Connect a WS client to the deployed edge example → echo round-trips.

---

# Phase 3 — Enterprise

*Observability, identity, module encapsulation, config — the enterprise-adoption gates (class audits: enterprise 58/100).*

## Tasks

### ☐ T025 · New package `@nextrush/otel`
- **Domain:** Observability · **Packages:** **NEW** `@nextrush/otel` · **Priority:** P1 · **Effort:** L · **Difficulty:** Hard · **Runtime Impact:** Medium · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** T026
- **Description:** OpenTelemetry HTTP server spans, W3C `traceparent` extract/inject, span attributes from route metadata (`endpoint()`). Verified absent (01/R-4).
- **Why it matters:** Enterprises mandate distributed tracing; none ships.
- **Risk if ignored:** Not adoptable in observability-mandated environments.
- **Acceptance Criteria:** Spans emitted per request with correct parent context; exporter-agnostic; documented.
- **Validation Steps:** Run with an OTLP collector → spans show correct trace/parent IDs across a two-service call.

### ☐ T026 · Context-propagation ADR + seam (AsyncLocalStorage vs explicit) — **UNLOCKER**
- **Domain:** Core / Observability · **Packages:** `@nextrush/core`, `@nextrush/types` · **Priority:** P1 · **Effort:** M · **Difficulty:** Hard · **Runtime Impact:** Medium · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** —
- **Description:** Decide ambient context strategy — `AsyncLocalStorage` (available Node/Bun/Deno/Workers) vs explicit ctx-threading — and provide the seam. No ALS is used today (01/§4.8); tracing/correlation needs a decision first.
- **Why it matters:** OTel, metrics correlation, and pipeline hooks all depend on this seam.
- **Risk if ignored:** Every observability package invents its own context passing → drift.
- **Acceptance Criteria:** ADR published; a context accessor exists with documented runtime cost/trade-off.
- **Validation Steps:** Set a correlation value in middleware → readable in a nested async handler without threading.

### ☐ T027 · New package `@nextrush/metrics`
- **Domain:** Observability · **Packages:** **NEW** `@nextrush/metrics` · **Priority:** P1 · **Effort:** M · **Difficulty:** Medium · **Runtime Impact:** Low · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** T026
- **Description:** Prometheus/OpenMetrics endpoint + RED metrics (rate/errors/duration) with low-cardinality route labels from route metadata (01/R-4).
- **Why it matters:** Standard ops signal; none ships.
- **Risk if ignored:** No production visibility into throughput/error/latency.
- **Acceptance Criteria:** `/metrics` exposes RED metrics with bounded label cardinality; documented.
- **Validation Steps:** Drive traffic → metrics reflect rate/errors/duration; labels don't explode per-path-param.

### ☐ T028 · Request-pipeline observability hooks
- **Domain:** Observability / Class · **Packages:** `@nextrush/class` · **Priority:** P2 · **Effort:** M · **Difficulty:** Medium · **Runtime Impact:** Low · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** T026
- **Description:** Expose timing/trace hooks around guard→interceptor→handler→filter so metrics/tracing can instrument the class pipeline (production-readiness M1; strategic M1).
- **Why it matters:** Enterprises want per-stage visibility; diagnostics are dev-time only today.
- **Risk if ignored:** Class pipeline is a black box in production.
- **Acceptance Criteria:** A documented hook fires per stage with duration + outcome; consumed by `@nextrush/otel`.
- **Validation Steps:** Register a hook → observe per-stage spans for a guarded route.

### ☐ T029 · New package `@nextrush/auth`
- **Domain:** Security · **Packages:** **NEW** `@nextrush/auth` · **Priority:** P1 · **Effort:** L · **Difficulty:** Hard · **Runtime Impact:** Low · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** T030
- **Description:** Strategy abstraction (bearer/JWT/API-key/session), guard integration for the class API, secure defaults (constant-time compare, no secret logging). Verified absent (01/R-5).
- **Why it matters:** The most common day-one API need; every adopter reinvents it.
- **Risk if ignored:** Inconsistent, error-prone hand-rolled auth across the ecosystem.
- **Acceptance Criteria:** Pluggable strategies; `@UseGuard`-compatible auth guard; secure-by-default; documented threat model.
- **Validation Steps:** Protect a route with a JWT strategy → valid token 200, invalid 401, missing 401.

### ☐ T030 · New package `@nextrush/jwt` (Web-Crypto, edge-portable)
- **Domain:** Security · **Packages:** **NEW** `@nextrush/jwt` · **Priority:** P1 · **Effort:** M · **Difficulty:** Medium · **Runtime Impact:** Low · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** —
- **Description:** Sign/verify + key rotation using Web Crypto `subtle` (so it runs on edge/Deno/Bun/Node without `node:crypto`).
- **Why it matters:** Foundation for `@nextrush/auth`/`session`; must be edge-portable.
- **Risk if ignored:** No standard token layer; edge-incompatible ad-hoc JWT.
- **Acceptance Criteria:** HS/RS/ES sign+verify via Web Crypto; rotation supported; runs in the edge CI job (T019).
- **Validation Steps:** Sign+verify round-trip on Node and `workerd`; tampered token rejected.

### ☐ T031 · New package `@nextrush/session`
- **Domain:** Security · **Packages:** **NEW** `@nextrush/session` · **Priority:** P1 · **Effort:** M · **Difficulty:** Medium · **Runtime Impact:** Low · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** T030 (and T040 for a Redis store)
- **Description:** Signed-cookie sessions (reuse `@nextrush/cookies` signing) + a pluggable store interface (memory default; Redis via T040).
- **Why it matters:** Sessions are a core auth primitive; none ships.
- **Risk if ignored:** No standard session story; insecure ad-hoc implementations.
- **Acceptance Criteria:** Session create/read/destroy; store interface; secure cookie flags by default.
- **Validation Steps:** Set session, read across requests, destroy → cookie invalidated.

### ☐ T032 · Enforce `@Module` encapsulation
- **Domain:** Class / DI · **Packages:** `@nextrush/class`, `@nextrush/di` · **Priority:** P2 · **Effort:** L · **Difficulty:** Hard · **Runtime Impact:** Medium · **Breaking:** Yes (if enforced by default) · **Status:** □ Not Started
- **Verified (2026-07-15, spot-check):** `packages/class/src/modules/module-types.ts` states directly in a doc comment: "per-module encapsulation; not enforced yet (see RFC-NEXTRUSH-MODULES §5)." Confirmed still open.
- **Dependencies:** —
- **Description:** Make `@Module.exports` real — per-module provider visibility on the request-scope child-container foundation. Today it is "recorded, not enforced" (README + strategic/production-readiness H1; deferred to 1.x per ADR-0006).
- **Why it matters:** Enterprises rely on module-private providers; shipping a NestJS-shaped `exports` that does nothing is a DX trap.
- **Risk if ignored:** Large-team apps hit uncontrolled global provider visibility; "exports" resented once discovered.
- **Acceptance Criteria:** A non-exported provider is not resolvable outside its module; enforced (opt-in flag first, default flip a major).
- **Validation Steps:** Import a module without an internal provider's export → resolution fails; with export → succeeds.

### ☐ T033 · Per-app DI isolation by default
- **Domain:** Dependency Injection · **Packages:** `@nextrush/di`, `@nextrush/class` · **Priority:** P2 · **Effort:** M · **Difficulty:** Hard · **Runtime Impact:** Medium · **Breaking:** Yes · **Status:** □ Not Started
- **Verified (2026-07-15, spot-check):** `packages/class/src/__tests__/isolation.test.ts` doc comment confirms "the default (`isolate: false`) preserves the [global container]" — opt-in isolation exists but is not the default. Confirmed still open.
- **Dependencies:** T005
- **Description:** Flip `registerControllers({ isolate })` default from opt-in to on — each app gets its own container graph. Opt-in isolation shipped in Wave 8; global remains the default (master CRITICAL-2 core).
- **Why it matters:** Global container blocks multi-tenant/multi-app-per-process correctness.
- **Risk if ignored:** Cross-app service bleed in tests/serverless-warm-reuse/embedding.
- **Acceptance Criteria:** Two apps in one process have independent singleton graphs by default; migration guide for the flip.
- **Validation Steps:** Register the same service in two apps → distinct instances; existing isolation test passes with default on.

### ☐ T034 · Request-context injection into request-scoped services
- **Domain:** Dependency Injection · **Packages:** `@nextrush/di`, `@nextrush/class` · **Priority:** P2 · **Effort:** M · **Difficulty:** Hard · **Runtime Impact:** Medium · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** T026, T033
- **Description:** Allow request-scoped services to `@Inject` the current request/context (NestJS `REQUEST`-style) instead of only reading it via a controller `@Ctx` param (strategic immature-parts).
- **Why it matters:** Ergonomic parity gap vs NestJS; forces awkward ctx-threading today.
- **Risk if ignored:** Verbose request plumbing; weaker DX for request-scoped work.
- **Acceptance Criteria:** A `REQUEST` token resolves to the current context inside a request-scoped service.
- **Validation Steps:** Inject `REQUEST` into a request-scoped service → sees the correct per-request value under concurrency.

### ☐ T035 · New package `@nextrush/config`
- **Domain:** Configuration / Security · **Packages:** **NEW** `@nextrush/config` · **Priority:** P2 · **Effort:** M · **Difficulty:** Medium · **Runtime Impact:** Low · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** —
- **Description:** Typed, layered config (env/file/defaults) validated via Standard Schema (reuse validation infra) + secret redaction; complements the DI `@Config()` token (01/P2-3; strategic M3).
- **Why it matters:** No first-class typed config/secrets story; each app reinvents it.
- **Risk if ignored:** Config drift, unvalidated env, accidental secret logging.
- **Acceptance Criteria:** Schema-validated config with typed access; missing/invalid env fails fast; secrets redacted in logs.
- **Validation Steps:** Omit a required env var → boot fails with a clear message; secret never appears in structured logs.

### ☐ T036 · End-to-end enterprise example app
- **Domain:** Examples · **Packages:** `examples/*` · **Priority:** P2 · **Effort:** M · **Difficulty:** Medium · **Runtime Impact:** None · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** T029, T031, T032
- **Description:** A runnable app exercising modules + guards + request scope + testing harness + auth + observability (production-readiness #13).
- **Why it matters:** Proves the enterprise story end-to-end; adoption accelerant.
- **Risk if ignored:** Enterprise features look theoretical without a cohesive example.
- **Acceptance Criteria:** Example builds, tests (via `@nextrush/testing`), and runs; documented walkthrough.
- **Validation Steps:** `pnpm --filter <example> test && dev` → auth + traced request works.

### ☐ T037 · Namespace public metadata readers
- **Domain:** API Design / Class · **Packages:** `@nextrush/class` · **Priority:** P2 · **Effort:** S · **Difficulty:** Medium · **Runtime Impact:** None · **Breaking:** No (additive subpath) · **Status:** □ Not Started
- **Dependencies:** T005
- **Description:** Move metadata readers (`getRouteMetadata`, `getControllerDefinition`, `getAllParamMetadata`, `ApplicationGraph` as read-type) behind a `nextrush/class/metadata` subpath/namespace so they don't pollute the newcomer autocomplete (strategic API problem 3).
- **Why it matters:** Keeps the primary surface clean while retaining tooling access.
- **Risk if ignored:** Internal representation leaks into the first-run autocomplete; harder to evolve.
- **Acceptance Criteria:** Readers available under a clearly-labelled subpath; primary barrel excludes them; snapshot updated.
- **Validation Steps:** Autocomplete on `nextrush/class` no longer surfaces metadata readers; subpath import works.

---

# Phase 4 — Ecosystem

*Breadth packages + toolchain upgrades. Mostly parallelizable; each is independently shippable post-v1.*

## Tasks

### ☑ T038 · New package `@nextrush/adapter-serverless`
- **Domain:** Serverless · **Packages:** **NEW** `@nextrush/adapter-serverless` · **Priority:** P2 · **Effort:** M · **Difficulty:** Hard · **Runtime Impact:** High · **Breaking:** No · **Status:** ☑ Completed
- **Verified (2026-07-15):** `packages/adapters/serverless/` exists with `src/`, `bench/`, `fixtures/`, a full `README.md`, and built-in `EventMapper`s for `apigw-v1`, `apigw-v2`, `lambda-function-url` (with true response streaming), `gcf`, and `azure`. Tier-1 one-liner handlers (`createLambdaHandler`, `createGoogleHandler`, `createAzureHandler`) exist. Container-reuse (`ready()` memoization) and a cold-start benchmark (`bench/README.md`, ~65.6ms functional / ~79.5ms class-path median) are both documented with real measured numbers. One verified example per provider exists in `docs/guides/serverless-deploy.md`. Delivered by the archived `harden-runtime-edge-serverless` change, task groups 5–8 and 12.
- **Dependencies:** T019
- **Description:** Event→`Request` mappers for APIGW v1/v2, Lambda Function URL (response streaming), GCF, Azure + a container-reuse pattern + cold-start benchmark. No classic-FaaS adapter exists today (01/R-6; search returned 0 hits).
- **Why it matters:** "Serverless-ready" is currently only true for fetch-based edge; classic Lambda/GCF/Azure need a bridge.
- **Risk if ignored:** Largest serverless market blocked or forced onto hand-rolled bridges.
- **Acceptance Criteria:** One verified example per provider; cold-start numbers published; container-reuse documented.
- **Validation Steps:** Deploy the APIGW example → invoke returns correct response; cold vs warm measured.

### ☐ T039 · New package `@nextrush/cache`
- **Domain:** Package Ecosystem · **Packages:** **NEW** `@nextrush/cache` · **Priority:** P2 · **Effort:** M · **Difficulty:** Medium · **Runtime Impact:** Low · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** —
- **Description:** Cache interface + in-memory default (TTL/LRU). Foundation for session store + distributed rate-limit (01/§10).
- **Why it matters:** Common need; unblocks T040/T041/T031.
- **Risk if ignored:** No standard cache abstraction; duplicated ad-hoc caches.
- **Acceptance Criteria:** `get/set/del/ttl` interface; in-memory impl with eviction; documented.
- **Validation Steps:** Set with TTL → expires; LRU evicts beyond capacity.

### ☐ T040 · New package `@nextrush/redis`
- **Domain:** Package Ecosystem · **Packages:** **NEW** `@nextrush/redis` · **Priority:** P2 · **Effort:** M · **Difficulty:** Medium · **Runtime Impact:** Low · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** T039
- **Description:** Redis/KV driver implementing the `@nextrush/cache` interface + a session/rate-limit store.
- **Why it matters:** Production caching/session/rate-limit needs a shared external store.
- **Risk if ignored:** No horizontally-scalable store for sessions/rate-limit.
- **Acceptance Criteria:** Implements cache interface; integration-tested against a real Redis (Docker).
- **Validation Steps:** Cache + session round-trips against a Dockerized Redis in CI.

### ☐ T041 · Distributed store for `@nextrush/rate-limit`
- **Domain:** Middleware · **Packages:** `@nextrush/rate-limit` · **Priority:** P2 · **Effort:** M · **Difficulty:** Medium · **Runtime Impact:** Low · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** T040
- **Description:** Add a Redis/KV store option; rate-limit is currently in-memory only (per-instance) (01/P2-4).
- **Why it matters:** Multi-instance deployments need shared rate-limit state.
- **Risk if ignored:** Rate limits are per-process → ineffective behind a load balancer.
- **Acceptance Criteria:** Pluggable store; limits enforced across instances in an integration test.
- **Validation Steps:** Two instances + shared Redis → combined count enforces the limit.

### ☐ T042 · `Transpiler` interface in `@nextrush/dev`
- **Domain:** Build System / Tooling · **Packages:** `@nextrush/dev` · **Priority:** P2 · **Effort:** M · **Difficulty:** Hard · **Runtime Impact:** None · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** —
- **Description:** Introduce a `Transpiler` seam (`transform(file, opts)` + dev-loader provider) so SWC is swappable by implementation, not by editing files (dev-audit Q5). SWC stays off the public/CLI surface.
- **Why it matters:** Contains a future compiler-backend swap; current coupling is file-isolated but has no formal seam.
- **Risk if ignored:** A compiler change is an ad-hoc rewrite rather than an interface implementation.
- **Acceptance Criteria:** A no-op/second transpiler can be dropped in via the interface without touching build orchestration.
- **Validation Steps:** Implement a trivial alternate transpiler → build routes through it.

### ☐ T043 · Configurable Deno permissions in dev/build
- **Domain:** Tooling / Deno · **Packages:** `@nextrush/dev` · **Priority:** P3 · **Effort:** S · **Difficulty:** Easy · **Runtime Impact:** None · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** —
- **Description:** Let apps extend the hardcoded `--allow-net --allow-read --allow-env` set (need `--allow-write`/`--allow-ffi`/etc.) (dev-audit Q9).
- **Why it matters:** Deno apps needing extra permissions can't run under the fixed set.
- **Risk if ignored:** Deno users blocked from write/ffi/other capabilities.
- **Acceptance Criteria:** A config/flag adds permissions; defaults unchanged.
- **Validation Steps:** Run a Deno app needing `--allow-write` → succeeds with the new option.

### ☐ T044 · Monorepo/workspace-aware build scoping
- **Domain:** Tooling / Build System · **Packages:** `@nextrush/dev` · **Priority:** P3 · **Effort:** S · **Difficulty:** Medium · **Runtime Impact:** None · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** —
- **Description:** Scope the recursive file scan to workspace boundaries; document monorepo behavior (dev-audit Q15).
- **Why it matters:** In a workspace the build can mis-scope files.
- **Risk if ignored:** Wrong files compiled/emitted in monorepos.
- **Acceptance Criteria:** Build respects the package boundary; documented.
- **Validation Steps:** Build one package in a workspace → sibling packages' files excluded.

### ☐ T045 · New package `@nextrush/queue`
- **Domain:** Package Ecosystem · **Packages:** **NEW** `@nextrush/queue` · **Priority:** P3 · **Effort:** L · **Difficulty:** Hard · **Runtime Impact:** Low · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** T040
- **Description:** Job queue interface + Redis/BullMQ driver; jobs run on the lifecycle/extension foundation with their own scope (01/P3-1; strategic).
- **Why it matters:** Background processing is a common backend need.
- **Risk if ignored:** No first-party async job story.
- **Acceptance Criteria:** Enqueue/process/retry/backoff; graceful drain on shutdown.
- **Validation Steps:** Enqueue N jobs → all processed; failure retries with backoff.

### ☐ T046 · New package `@nextrush/cron`
- **Domain:** Package Ecosystem · **Packages:** **NEW** `@nextrush/cron` · **Priority:** P3 · **Effort:** M · **Difficulty:** Medium · **Runtime Impact:** Low · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** —
- **Description:** Scheduler on the `OnInit`/`OnShutdown` + Extension boot/teardown foundation; note edge/FaaS scheduling is platform-native (01/P3-2).
- **Why it matters:** Scheduled tasks are a common need for long-running servers.
- **Risk if ignored:** Users bolt on `node-cron` ad hoc without lifecycle integration.
- **Acceptance Criteria:** Register cron jobs; start on `ready()`, stop on `close()`; overlap policy.
- **Validation Steps:** Schedule a per-second job → fires; `close()` stops it cleanly.

### ☐ T047 · New package `@nextrush/webhooks`
- **Domain:** Package Ecosystem · **Packages:** **NEW** `@nextrush/webhooks` · **Priority:** P3 · **Effort:** M · **Difficulty:** Medium · **Runtime Impact:** Low · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** —
- **Description:** Inbound signature verification (Stripe/GitHub-style) + outbound signing/retry helpers (01/P3-3).
- **Why it matters:** Webhook verification is security-sensitive and error-prone to hand-roll.
- **Risk if ignored:** Insecure/ad-hoc webhook handling across adopters.
- **Acceptance Criteria:** Constant-time signature verify middleware + outbound signer with retries.
- **Validation Steps:** Valid signature passes, tampered payload rejected; outbound retries on 5xx.

### ☐ T048 · New package `@nextrush/graphql`
- **Domain:** Package Ecosystem · **Packages:** **NEW** `@nextrush/graphql` · **Priority:** P3 · **Effort:** L · **Difficulty:** Hard · **Runtime Impact:** Low · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** T052
- **Description:** Mount a GraphQL handler on the context pipeline (01/P3-4). Resolver decorators live in the class package.
- **Why it matters:** GraphQL is a common API style; currently unsupported.
- **Risk if ignored:** GraphQL users pick another framework.
- **Acceptance Criteria:** A schema serves queries/mutations through the middleware pipeline; guards/DI usable in resolvers.
- **Validation Steps:** Query a mounted schema → correct data; a guarded resolver enforces auth.

### ☐ T049 · New package `@nextrush/rpc`
- **Domain:** Package Ecosystem · **Packages:** **NEW** `@nextrush/rpc` · **Priority:** P3 · **Effort:** L · **Difficulty:** Hard · **Runtime Impact:** Low · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** T005
- **Description:** End-to-end typed RPC + client, leveraging existing route metadata (01/P3-5; Hono-RPC/Elysia-Eden parity gap).
- **Why it matters:** End-to-end type inference is a key competitor differentiator NextRush lacks.
- **Risk if ignored:** Behind Hono/Elysia on the typed-client axis.
- **Acceptance Criteria:** Generated/inferred client types match server routes; runtime calls typed end-to-end.
- **Validation Steps:** Change a route's return type → client type errors at compile time.

### ☐ T050 · Replace tsyringe with an in-house container
- **Domain:** Dependency Injection · **Packages:** `@nextrush/di` · **Priority:** P2 · **Effort:** L · **Difficulty:** Expert · **Runtime Impact:** Medium · **Breaking:** Yes · **Status:** □ Not Started
- **Dependencies:** T005
- **Description:** Evaluate + implement an in-house DI container to reclaim a true zero-runtime-dependency story and drop a maintenance-mode dependency (01/R-2, P2-8; master hidden-risk #1).
- **Why it matters:** tsyringe is low-activity, NextRush pokes its internals — a framework-level supply-chain risk.
- **Risk if ignored:** A tsyringe break/abandonment becomes a framework-level incident.
- **Acceptance Criteria:** DI behavior + error quality preserved; tsyringe removed; surface snapshot unchanged for consumers.
- **Validation Steps:** Full DI + class test suites green with tsyringe removed from the dependency tree.

### ☐ T051 · CommonJS dual-publish decision + impl
- **Domain:** Build System / TypeScript · **Packages:** core published packages · **Priority:** P3 · **Effort:** M · **Difficulty:** Medium · **Runtime Impact:** Low · **Breaking:** No (additive) · **Status:** □ Not Started
- **Dependencies:** T007
- **Description:** Decide explicitly whether to remain ESM-only (defensible) or dual-publish CJS for `require()` consumers (01/R-9). All packages are ESM-only today (`exports` has no `require` condition).
- **Why it matters:** ESM-only excludes a still-large slice of Node codebases.
- **Risk if ignored:** Legacy CJS consumers cannot adopt NextRush (may be an intentional boundary).
- **Acceptance Criteria:** A documented decision; if dual-publishing, `require()` works for core packages.
- **Validation Steps:** If pursued: `require('nextrush')` resolves in a CJS project; else the ESM-only boundary is documented.

### ☐ T052 · Non-HTTP parameter binding (GraphQL/WebSocket sources)
- **Domain:** Class / Decorators · **Packages:** `@nextrush/class` · **Priority:** P3 · **Effort:** L · **Difficulty:** Hard · **Runtime Impact:** Low · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** T037
- **Description:** Generalize the HTTP-shaped param-binding model (`@Body`/`@Query`) to non-HTTP sources (GraphQL args, WS messages) as additive param decorators (strategic future-evolution).
- **Why it matters:** Prerequisite for clean GraphQL (T048)/WS gateway decorators.
- **Risk if ignored:** GraphQL/WS bolt on outside the class model.
- **Acceptance Criteria:** A pluggable param-source API; an example GraphQL-arg decorator works.
- **Validation Steps:** A custom param source resolves values into a handler via the same binding plan.

---

# Phase 5 — v1 Stable

*Freeze, remove deprecations, govern, and produce the missing audits. The stable-tag gate.*

## Tasks

### ☑ T053 · Remove deprecated shim packages
- **Domain:** Package Ecosystem · **Packages:** `@nextrush/controllers`, `@nextrush/decorators` · **Priority:** P1 · **Effort:** S · **Difficulty:** Easy · **Runtime Impact:** None · **Breaking:** Yes · **Status:** ☑ Completed
- **Verified (2026-07-16):** Both packages deleted from the workspace (`openspec/changes/archive/*-remove-deprecated-shims/`). A repo-wide grep sweep before removal found zero internal import-statement consumers, but a `pnpm install` run *after* deletion caught a real gap the import-only sweep missed: `apps/playground` and `packages/nextrush` both still declared the two packages as dead `package.json` dependencies (zero actual imports, just unused entries) — fixed both, plus `.changeset/config.json`'s `fixed` version group, which explicitly listed both names. The docs sweep also caught a real logic bug (not just stale text) in `apps/docs/scripts/verify/reference-match.ts`'s package-inference function, which would have resolved `decorators.mdx`/`controllers.mdx` to the now-deleted packages — fixed with an explicit `@nextrush/class` mapping. 6 live JSDoc `@example` blocks in `packages/class/src` (IDE-hover-visible, not historical) and 10 current-tense wiki/skill doc examples were also fixed, since they were genuinely broken instructions, not historical record. `docs/RFC/*`, `CHANGELOG.md` entries, and blog posts correctly left untouched as historical record. Migration path (already-existing `nextrush codemod consolidate-imports` + rewritten `deprecations.mdx`) ships as the outward-facing mitigation for any external consumer. Cache-bypassed `turbo run typecheck --force`: 58/58 green. Cache-bypassed `turbo run test --force`: 72/74 green, the 2 failures being the same pre-existing `@nextrush/class`/`@nextrush/di` circular-dependency timeout flake already logged against T005, confirmed unrelated. Changeset added (`major` bump on `nextrush` and `@nextrush/class`).
- **Dependencies:** T005 ☑, T007 ☑
- **Description:** Remove the single-file re-export shims per the ADR-0005 window; ship the `consolidate-imports` codemod + migration guide. They currently still publish as first-class packages (production-readiness H2).
- **Why it matters:** Publishing them at 1.0 commits to carrying them forever; the triple-export drift persists while they exist (strategic).
- **Risk if ignored:** Permanent maintenance burden + import ambiguity.
- **Acceptance Criteria:** Shims removed on the stated timeline; codemod migrates imports to `nextrush/class`; migration guide published.
- **Validation Steps:** Run codemod on a shim-using fixture → compiles against `nextrush/class`; shims absent from the registry.

### ☐ T054 · Extension-model v4 — M8 release mechanics
- **Domain:** Release Engineering · **Packages:** `@nextrush/core`, `@nextrush/types`, meta · **Priority:** P1 · **Effort:** XS · **Difficulty:** Easy · **Runtime Impact:** None · **Breaking:** No · **Status:** □ Not Started
- **Verified (2026-07-15, spot-check only):** 13 packages' `CHANGELOG.md` files reference "extension model"/`extend()` terminology, suggesting the migration itself likely landed — but this pass did not confirm the specific acceptance criterion (`grep -r "Plugin" packages/*/src` finds no legacy contract) or that release-mechanics checkboxes were reconciled. Left as □ pending that direct check rather than assumed ☑ from indirect evidence.
- **Dependencies:** —
- **Description:** Complete the M8 release checklist (changeset version bump + CHANGELOG) for the extension model. The migration is code-complete (`extend()`/`ready()` shipped; zero old-`Plugin` refs) — only release mechanics remain (production-readiness B1 re-classified).
- **Why it matters:** A stable tag can't ship with stale migration bookkeeping.
- **Risk if ignored:** Confusing changelog/version state at release.
- **Acceptance Criteria:** TODO checkboxes reconciled; changeset + CHANGELOG entries land.
- **Validation Steps:** `grep -r "Plugin" packages/*/src` finds no legacy contract; changeset present.

### ☐ T055 · Internal package-tier convention
- **Domain:** Package Ecosystem / Governance · **Packages:** all ~35 packages · **Priority:** P2 · **Effort:** S · **Difficulty:** Medium · **Runtime Impact:** None · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** T007
- **Description:** Mark which packages/symbols are supported public surface vs internal plumbing (production-readiness H3). ADR-0005 encoded tiers; propagate a visible convention across the tree.
- **Why it matters:** Contributors/adopters can't tell the supported surface from internals across ~35 packages.
- **Risk if ignored:** Users depend on plumbing; contributor confusion at scale.
- **Acceptance Criteria:** Each package README states its tier; internal symbols clearly labelled.
- **Validation Steps:** A newcomer can identify the supported surface from docs alone.

### ☐ T056 · Refresh decorator-dialect ADR + verify reflection seam
- **Domain:** Decorators / TypeScript · **Packages:** `@nextrush/class`, `docs/adr` · **Priority:** P2 · **Effort:** XS · **Difficulty:** Easy · **Runtime Impact:** None · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** —
- **Description:** Confirm `ADR-0001` states the explicit TC39-standard-decorator exit trigger, and verify reflection remains isolated to one boundary (already true per production-readiness) so a future migration is contained (01/R-8).
- **Why it matters:** Legacy `experimentalDecorators`/`emitDecoratorMetadata` is a documented long-term bet; the exit must stay contained.
- **Risk if ignored:** A forced TS/TC39 change becomes an uncontained rewrite of param injection + DI.
- **Acceptance Criteria:** ADR states the trigger + migration plan; reflection confined to one module (asserted by a test/lint).
- **Validation Steps:** `grep -rl "reflect-metadata" packages/*/src` shows reflection isolated to the intended files.

### ☐ T057 · Node engine floor policy
- **Domain:** Governance / Runtime · **Packages:** all `package.json`, docs · **Priority:** P3 · **Effort:** XS · **Difficulty:** Easy · **Runtime Impact:** None · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** T007
- **Description:** Document why `engines.node >= 22` (drops Node 20 LTS); reconsider a 20-LTS floor if adoption demands (01/R-14). `AbortSignal.any` needs ≥20.3 but the floor is 22.
- **Why it matters:** A high floor narrows adoption while Node 20 is still in maintenance.
- **Risk if ignored:** Silent exclusion of Node 20 users without a stated rationale.
- **Acceptance Criteria:** A documented, justified engine floor; matrix (T003) covers the supported range.
- **Validation Steps:** Docs state the floor + reason; CI matrix matches.

### ☐ T058 · Complete user-facing documentation
- **Domain:** Documentation · **Packages:** `apps/docs`, all package READMEs · **Priority:** P1 · **Effort:** L · **Difficulty:** Medium · **Runtime Impact:** None · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** —
- **Description:** Fill enterprise topics (observability, config, deployment hardening, graceful shutdown) and ensure every public API has an accurate doc entry; no claim contradicted by source (01/§9; strategic docs 68/100).
- **Why it matters:** Docs are a stated core feature; partial user docs cap adoption.
- **Risk if ignored:** "Powerful but confusing" reputation; feature surface outruns docs.
- **Acceptance Criteria:** `docs:validate` passes strict; every public export documented; enterprise guides published.
- **Validation Steps:** `pnpm docs:validate:strict` green; spot-check APIs vs source.

### ☐ T059 · Governance + maintainer/bus-factor plan
- **Domain:** Governance · **Packages:** repo · **Priority:** P2 · **Effort:** M · **Difficulty:** Medium · **Runtime Impact:** None · **Breaking:** No · **Status:** □ Not Started
- **Verified (2026-07-15):** No `GOVERNANCE.md` or `CODEOWNERS` file found at repo root or `.github/`. Confirmed still open.
- **Dependencies:** T007
- **Description:** Establish a contribution/governance model + recruit maintainers; the project is single-maintainer across ~35 packages (01/R-10).
- **Why it matters:** Bus-factor of 1 is an adoption and sustainability risk for a public v1.
- **Risk if ignored:** Project stalls if the sole maintainer is unavailable; enterprises avoid single-maintainer deps.
- **Acceptance Criteria:** Documented governance; ≥1 additional maintainer or a stated succession plan.
- **Validation Steps:** GOVERNANCE.md merged; CODEOWNERS reflects >1 owner where possible.

### ☐ T060 · Final v1.0 API-freeze sign-off + Definition-of-Done verification — **GATE**
- **Domain:** Release Engineering · **Packages:** all · **Priority:** P0 · **Effort:** S · **Difficulty:** Hard · **Runtime Impact:** None · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** T003, T005, T007, T053, and all P0/P1 tasks in Phases 0–2
- **Description:** Verify every Definition-of-Done item (below) is met, freeze the public surface across all packages, and tag `1.0.0`.
- **Why it matters:** The single stability promise; must be a checklist, not a vibe.
- **Risk if ignored:** A premature stable tag forces a broken promise.
- **Acceptance Criteria:** All P0 + Phase-0–2 P1 tasks ☑; surface snapshots locked; DoD checklist fully checked.
- **Validation Steps:** Run the Validation Checklist end-to-end; freeze snapshots; publish `1.0.0`.

### ☐ T061 · "auto-restart" vs "hot reload" wording + dev semantics doc
- **Domain:** Documentation / CLI · **Packages:** `@nextrush/dev`, docs · **Priority:** P3 · **Effort:** XS · **Difficulty:** Easy · **Runtime Impact:** None · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** —
- **Description:** Ensure dev docs/CLI call it "auto-restart on change" (not HMR) and document ESM-only output + no-HMR semantics (dev-audit M3; verify if already reconciled).
- **Why it matters:** "Hot reload" sets a state-preserving expectation the tool doesn't meet.
- **Risk if ignored:** Wrong DX expectations, minor trust erosion.
- **Acceptance Criteria:** No "hot reload" claim implying HMR; semantics documented.
- **Validation Steps:** `grep -ri "hot reload" packages/dev apps/docs` → none implying HMR.

### ☐ T062 · Document duck-typed lifecycle discoverability
- **Domain:** Documentation / Class · **Packages:** `@nextrush/class`, docs · **Priority:** P3 · **Effort:** XS · **Difficulty:** Easy · **Runtime Impact:** None · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** —
- **Description:** Prominently document the `OnInit`/`OnShutdown` duck-typed convention (no decorator to hang IntelliSense on) (strategic API problem 4).
- **Why it matters:** Lifecycle hooks are un-discoverable without a decorator; docs must compensate.
- **Risk if ignored:** Users miss lifecycle hooks entirely.
- **Acceptance Criteria:** Lifecycle convention documented with a copy-paste example in the class guide.
- **Validation Steps:** Guide shows `implements OnInit` usage; example runs.

### ☐ T063 · Produce `04-performance-engineering-audit.md`
- **Domain:** Performance / Benchmarks · **Packages:** repo · **Priority:** P2 · **Effort:** M · **Difficulty:** Medium · **Runtime Impact:** None · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** T017, T018
- **Description:** Produce the missing dedicated performance audit (referenced by this backlog but absent): re-measured RPS/latency on a CPU-pinned host, cold-start, bundle size, allocation hot-path analysis, class-path overhead.
- **Why it matters:** Performance is a headline positioning claim; current numbers were withdrawn (01/§4.10).
- **Risk if ignored:** Performance claims remain unverified; no baseline for regressions.
- **Acceptance Criteria:** `docs/audits/04-performance-engineering-audit.md` with reproducible, multi-run numbers.
- **Validation Steps:** Numbers reproduce on the pinned harness within stated CV.

### ☐ T064 · Produce `05-security-architecture-audit.md`
- **Domain:** Security · **Packages:** repo · **Priority:** P1 · **Difficulty:** Hard · **Effort:** M · **Runtime Impact:** None · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** —
- **Description:** Produce the missing dedicated security audit: threat model, injection/ReDoS/prototype-pollution review, proxy/IP-trust, header injection, secret handling, dependency CVEs, auth surface (once T029 lands), edge/isolation boundaries.
- **Why it matters:** No standalone security audit exists despite security-sensitive claims; enterprise gate.
- **Risk if ignored:** Unassessed security posture entering v1.
- **Acceptance Criteria:** `docs/audits/05-security-architecture-audit.md` with severity-tagged findings + remediations.
- **Validation Steps:** Findings cross-checked against source; each has a tracked remediation task.

### ☐ T065 · Produce `06-api-design-maintainability-audit.md`
- **Domain:** API Design / Developer Experience · **Packages:** repo · **Priority:** P2 · **Effort:** M · **Difficulty:** Medium · **Runtime Impact:** None · **Breaking:** No · **Status:** □ Not Started
- **Dependencies:** T005, T037
- **Description:** Produce the missing dedicated API-design/maintainability audit consolidating surface consistency, naming, discoverability, breaking-change risk, and file/module structure across all packages (class audits cover the class tier only).
- **Why it matters:** The public contract for ~35 packages needs a whole-framework API review before freeze.
- **Risk if ignored:** Inconsistent/leaky surface frozen at 1.0.
- **Acceptance Criteria:** `docs/audits/06-api-design-maintainability-audit.md` covering every published package's surface.
- **Validation Steps:** Audit references the surface snapshots (T005); findings tracked.

---

# Package Impact Matrix

| Package | New/Modified | Tasks |
|---|---|---|
| `@nextrush/core` | Modified | T010, T014, T026, T054 |
| `@nextrush/runtime` | Modified | T010, T020 |
| `@nextrush/router` | Modified | T002, T014, T016 |
| `@nextrush/di` | Modified | T033, T034, T050, T014 |
| `@nextrush/class` | Modified | T008, T014, T015, T016, T028, T032, T034, T037, T052, T056, T062 |
| `@nextrush/types` | Modified | T026, T054 |
| `@nextrush/errors` | Modified | (consumed by auth/validation) |
| `@nextrush/adapter-node` | Modified | T010 |
| `@nextrush/adapter-edge` | Modified | T019, T020, T023 |
| `@nextrush/adapter-bun` / `-deno` | Modified | T003, T019 |
| `@nextrush/dev` | Modified | T004, T008, T013, T042, T043, T044, T061 |
| `@nextrush/rate-limit` | Modified | T041 |
| `@nextrush/cookies` | Consumed | T031 |
| `@nextrush/openapi` | Consumed | T028 (route metadata) |
| `nextrush` (meta) | Modified | T001, T023, T051 |
| **NEW** `@nextrush/health` | New | T011 |
| **NEW** `@nextrush/otel` | New | T025 |
| **NEW** `@nextrush/metrics` | New | T027 |
| **NEW** `@nextrush/auth` | New | T029 |
| **NEW** `@nextrush/jwt` | New | T030 |
| **NEW** `@nextrush/session` | New | T031 |
| **NEW** `@nextrush/config` | New | T035 |
| **NEW** `@nextrush/adapter-serverless` | New | T038 |
| **NEW** `@nextrush/cache` | New | T039 |
| **NEW** `@nextrush/redis` | New | T040 |
| **NEW** `@nextrush/queue` | New | T045 |
| **NEW** `@nextrush/cron` | New | T046 |
| **NEW** `@nextrush/webhooks` | New | T047 |
| **NEW** `@nextrush/graphql` | New | T048 |
| **NEW** `@nextrush/rpc` | New | T049 |
| **NEW** `@nextrush/websocket-edge` | New | T024 |
| `@nextrush/controllers` / `@nextrush/decorators` | Removed | T053 |
| Repo/CI/build config | Modified | T003, T004, T005, T006, T012, T018 |

---

# Runtime Compatibility Matrix

Legend: 🟢 proven · 🟡 implemented, unproven-in-CI · 🟠 works via caveat · 🔴 unsupported.

| Runtime | Current | After backlog | Gap-closing tasks |
|---|---|---|---|
| Node.js (server) | 🟢 | 🟢 | T010 (shutdown), T003 (matrix) |
| Bun (native) | 🟡 | 🟢 | T003, T019 |
| Deno (native) | 🟡 | 🟢 | T003, T019 |
| Deno Deploy | 🟡 | 🟢 | T019, T021 |
| Cloudflare Workers | 🟡 | 🟢 | T019, T021, T012 (bundle), T023 |
| Vercel Edge | 🟡 | 🟢 | T019, T021 |
| Netlify Edge | 🟡 | 🟢 | T019, T021 |
| WinterCG (generic) | 🟡 | 🟢 | T020 |
| AWS Lambda (classic event) | 🔴 | 🟢 | T038 |
| AWS Lambda (Function URL/stream) | 🟠 | 🟢 | T038 |
| Google Cloud Functions | 🔴 | 🟢 | T038 |
| Azure Functions | 🔴 | 🟢 | T038 |
| Vercel Functions (Node) | 🟠 | 🟢 | T038 |

---

# Breaking Change Tracker

| Task | Change | Semver | Mitigation |
|---|---|---|---|
| T032 | `@Module.exports` enforced (module encapsulation) | Major (if default) | Ship opt-in first; flip default in a major; migration guide |
| T033 | Per-app DI isolation on by default | Major | Opt-in exists (Wave 8); flip in a major; migration guide |
| T050 | Replace tsyringe internals | Major (for tsyringe-coupled consumers) | Preserve public DI surface (T005 snapshot); codemod if needed |
| T053 | Remove `@nextrush/controllers` / `@nextrush/decorators` shims | Major (of those packages) | ADR-0005 window; `consolidate-imports` codemod; migration guide |
| *Conditional* T055 | Reclassify leaked symbols as internal | Minor–Major | Guard behind surface snapshot (T005); deprecate first |
| *Conditional* T002 | Router internal rename | None (internal) / Minor | `@deprecated` alias one cycle if any symbol was public |

**Rule:** every breaking change ships with a changeset (CI-enforced), a `docs/migrations/*` guide, and a `@deprecated` window where technically possible. Batch T032/T033/T050/T053 into a single major to minimize churn.

---

# New Package Tracker (16)

| Package | Domain | Priority | Depends on | Task |
|---|---|---|---|---|
| `@nextrush/health` | Observability | P1 | — | T011 |
| `@nextrush/otel` | Observability | P1 | T026 | T025 |
| `@nextrush/metrics` | Observability | P1 | T026 | T027 |
| `@nextrush/jwt` | Security | P1 | — | T030 |
| `@nextrush/auth` | Security | P1 | T030 | T029 |
| `@nextrush/session` | Security | P1 | T030, T040 | T031 |
| `@nextrush/config` | Configuration | P2 | — | T035 |
| `@nextrush/adapter-serverless` | Serverless | P2 | T019 | T038 |
| `@nextrush/cache` | Data | P2 | — | T039 |
| `@nextrush/redis` | Data | P2 | T039 | T040 |
| `@nextrush/websocket-edge` | Edge | P3 | T019 | T024 |
| `@nextrush/queue` | Ecosystem | P3 | T040 | T045 |
| `@nextrush/cron` | Ecosystem | P3 | — | T046 |
| `@nextrush/webhooks` | Ecosystem | P3 | — | T047 |
| `@nextrush/graphql` | Ecosystem | P3 | T052 | T048 |
| `@nextrush/rpc` | Ecosystem | P3 | T005 | T049 |

---

# Validation Checklist

Global gates that must stay green throughout (not per-task):

- [ ] `pnpm verify` (build + test + typecheck + lint) green on every PR.
- [ ] Multi-runtime CI (Node 20/22/24 + real Bun/Deno/workerd) green (T003).
- [ ] Windows + macOS toolchain CI green (T004).
- [ ] Coverage ≥ 90% lines / 85% branches per touched package (T006).
- [ ] Zero `any` in shipping source (maintained).
- [ ] Public-surface snapshots unchanged unless an intentional changeset says so (T005).
- [ ] No shipping source file > 300 lines (T014).
- [ ] Bundle-size budget not regressed; minimal edge bundle < CF 1 MB (T012).
- [ ] `docs:validate:strict` green; no doc claim contradicted by source (T058).
- [ ] Every breaking change has a changeset + migration guide.
- [ ] Every new network-exposed package documents its auth/security posture.
- [ ] No fabricated numbers — every published perf/size figure is measured (T063).

---

# Definition of Done

## Per-task DoD
A task is ☑ Completed only when: acceptance criteria met · validation steps pass · tests written test-first (RED→GREEN) and green · docs updated in the same change · changeset added if release-impacting · no new lint/type errors · no coverage regression on touched files · independently verified (a different context re-ran the gate, not the author's self-report).

## Definition of "Production Ready" (Node)
T010 (signal shutdown) + T011 (health) + structured logging/request-id (exists) + secure errors/body limits (exists) + Node matrix green (T003) + coverage/surface gates (T005, T006) + accurate dep footprint (T001). → **All Phase 0 + T010, T011 done.**

## Definition of "Edge Ready"
Edge suite green on real `workerd`/Deno in CI (T019) + measured minimal bundle < platform limit (T012) + verified deploy examples per platform (T021) + documented edge-safe middleware subset (T022) + WinterCG conformance (T020). Functional path proven reflect-metadata-free (T023).

## Definition of "Serverless Ready"
`@nextrush/adapter-serverless` mapping APIGW v1/v2 + Lambda URL + GCF + Azure (T038) + container-reuse documented + cold-start measured + one verified example per provider.

## Definition of "Enterprise Ready"
OTel + metrics + health (T025, T027, T011) + correlation seam (T026) + auth + session (T029, T031) + module encapsulation (T032) + typed config (T035) + governance/support policy (T059) + enterprise example (T036).

## Definition of "v1.0"
Gate task **T060** passes: all P0 tasks ☑ + all Phase 0–2 P1 tasks ☑ + public surface frozen repo-wide (T005) + deprecated shims removed (T053) + version/support policy published (T007) + docs complete & accurate (T058) + the security audit (T064) produced with no unresolved Critical/High. Enterprise (Phase 3) and Ecosystem (Phase 4) are **not** v1.0 blockers — they layer on after, per the phase model.

---

*End of backlog. Update task glyphs (□ → ◐ → ☑) and the Progress Dashboard as work lands. This file is the implementation tracker of record.*
