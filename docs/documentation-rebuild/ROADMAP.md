# NextRush Documentation Rebuild — ROADMAP (tracker)

> This is the **tracker** for the rebuild. The full plan (why/what) lives in [`PLAN.md`](./PLAN.md).
> Update this file after finishing each task: tick the box, set status, add a dated note.
> **Progress:** 22 / 22 tasks complete. **REBUILD COMPLETE**, validated 2026-07-10.

## Legend

| Status | Meaning |
| ------ | ------- |
| ☐ `TODO` | Not started |
| ◐ `WIP` | In progress |
| ✅ `DONE` | Merged + verification gates green |
| ⛔ `BLOCKED` | Waiting on a dependency / decision |

**Verification gate (every task):** `pnpm build` clean · link-check green · code examples compile ·
generated tables match source · docs-standards quality score met.

## Milestones

| Milestone | Covers | Exit criteria |
| --------- | ------ | ------------- |
| **M0 — Foundations** | T1–T5 | Harness + registry + generated-reference pilot + templates in place; "done" is enforceable in CI. |
| **M1 — Skeleton** | T6–T8 | New IA, nav shell, Docs Hub live; old URLs redirect; zero content lost. |
| **M2 — Core content** | T9–T14 | start / one-page / concepts / reference / packages / guides rebuilt & verified vs source. No deprecated imports. |
| **M3 — Production** | T15 | A team can ship to prod from docs alone (Docker builds, health check responds). |
| **M4 — Depth & growth** | T16–T20 | recipes / migrate / internals+RFCs / resources / blog+showcase complete. |
| **M5 — Premium & launch** | T21–T22 | Ask AI + runnable examples + full-site a11y/perf/verification green; agent endpoints regenerated. Ready to publish. |

## Phase 0 — Foundations & guardrails  (Milestone M0 — ✅ DONE, validated 2026-07-10)

| # | Task | Status | Depends on | Notes |
| - | ---- | ------ | ---------- | ----- |
| T1 | Lock source-of-truth & retire stale steering | ✅ DONE | — | Segment trie, `nextrush/class`, real pkg count. Done in prior session; folded into this phase's record. |
| T2 | Verification harness (link-check, example-compile, lint, reference-match) | ✅ DONE | — | `pnpm docs:verify`. Validator: fresh independent seed (fabricated link + nonexistent `Router.explodeEverything()`) correctly failed; baseline 655 findings reproduced exactly. |
| T3 | Package registry (single source of truth for 35 pkgs) | ✅ DONE | — | Validator independently re-walked all `package.json`s (fresh script, not implementer's list) — byte-identical to registry. Parity script pass/fail both reproduced with a different induced package (`@nextrush/csrf`). |
| T4 | Generated-reference tooling pilot (`fumadocs-typescript`) | ✅ DONE | T2 | Pilot on `reference/context` (`Context` @ `packages/types/src/context.ts`). Validator ran a full production build (267 pages) and proved generation via `ndjson` appearing in built output but absent from the `.mdx` source text. |
| T5 | Page templates & standards | ✅ DONE | T2 | 7 templates + STANDARDS.md. Validator caught the implementer's report as factually wrong (lint logic *did* exist, just unwired) — wired it, ran it, 0 findings. |

**Validator overall verdict: PASS.** Zero framework-source (`packages/*/src`) modifications by any T2–T5 implementer — confirmed via `git diff`/`git status`. No secrets introduced.

**Flags raised during validation (both resolved 2026-07-10):**
- `apps/docs/next.config.mjs` gained a webpack build-worker CPU cap (`experimental.cpus: 2`) from the T4 implementer, undisclosed in its report. Reviewed: in-scope (`apps/docs/**`), blast radius 0–1 (trivial/single-file/immediate-failure-if-wrong) — a reasonable guardrail against the docs build starving other processes on this machine. **Accepted as-is.**
- `performance/index.mdx`, `packages/router/src/*`, `packages/types/src/router.ts`, and new router/core test files were flagged as unclaimed changes in the working tree. Confirmed **pre-existing, unrelated prior-session work** — not touched by any Phase 0 docs implementer. No action needed for Phase 0; noted here so it isn't conflated with this phase's diff later.
- Follow-up carried to Phase 1: wire `checkLint()` permanently against `docs/documentation-rebuild/templates/` in the T2 orchestrator rather than the current ad hoc one-off.

## Phase 1 — Skeleton & shell  (Milestone M1 — ✅ DONE, validated 2026-07-10)

| # | Task | Status | Depends on | Notes |
| - | ---- | ------ | ---------- | ----- |
| T6 | Scaffold IA + nav + redirects (no content loss) | ✅ DONE | T5 | `getting-started/`→`start/`, `api-reference/`→`reference/`, `examples/`→`guides/examples/`; 5 new placeholder sections (production/recipes/migrate/internals/resources) with explicit "coming later" Callouts, no fake content. `performance/` & `community/` kept top-level (deferred fold to T15/T19). Validator independently fetched 8 self-picked old URLs (different set than implementer's) — all 200 via real redirect meta-refresh, all destinations resolve clean with no double-redirect. Build: 335 pages, 51/51 legacy redirects generated. |
| T7 | Top-level navigation shell + switchers | ✅ DONE | T6 | 6 destinations + search + version affordance (`3.1.0`, correctly a disabled/stub switcher, not real multi-version) + Ask AI slot (stub → GitHub Discussions, real backend deferred to T21). Validator fetched 4 self-picked routes incl. `/blog` and `/packages` — nav genuinely persistent, not one-off. All 6 nav link destinations 200, zero 404s. |
| T8 | Docs Hub launchpad page | ✅ DONE | T3, T6 | Hero/CTAs, capability finder, path cards, 6 featured packages. Validator independently re-extracted all 20 unique hrefs from the raw file (not the implementer's list) — all 200. Featured-package copy verbatim-matched the real registry's `summary` field (spot-checked 3/6) — confirmed not fabricated. |

**Validator overall verdict: PASS**, with two precision corrections recorded here rather than rounded up:

1. **`pnpm docs:verify`'s link-check gate is green** (the specific claim T6 makes), but the **overall harness command still exits 1** (500 pre-existing findings: 495 compile + 5 lint) — carried over from the Phase-0-documented baseline, confirmed byte-unchanged or trivial-href-only in the touched files. T6/T7/T8 did not introduce this and are not required to fix it, but implementer reports describing this as "docs:verify clean" were imprecise. **Do not report the harness as fully green until a later phase's content rewrite retires the baseline findings.**
2. **Framework source flag, now tracked explicitly (not a Phase 1 violation):** `packages/router/src/router.ts`, `packages/router/src/radix-tree.ts`, `packages/types/src/router.ts` (+ new/changed test files, + `packages/router/ROUTER_AUDIT.md`) remain modified in the working tree. Confirmed via file mtimes (~17h before any Phase 1 docs file) and zero mention in any implementer's file scope — this is unrelated, pre-existing router-package work, not something this rebuild touched. Flagged in both Phase 0 and Phase 1 validation; **should be committed or moved to its own branch before it's mistaken for in-scope drift in a future phase's diff.**

**Judgment calls disclosed (real content vs. placeholder — do not conflate):**
- `production/`, `recipes/`, `migrate/`, `internals/`, `resources/` = structural placeholders only, confirmed empty-but-scaffolded.
- Docs Hub's "Go to Production" / "Migrate from Express" cards point at the real existing `guides/deployment` / `guides/migration` (not the empty placeholders) — a disclosed, verified-200 workaround until T15/T17 land.
- `/packages` and `/blog` are real, non-404, reachable routes but intentionally placeholder content ahead of T13/T20.
- Version switcher and Ask AI are intentionally non-functional stubs ahead of T21 — not mis-sold as complete.

## Phase 2 — Core content rebuild  (Milestone M2 — ✅ DONE, validated 2026-07-10)

| # | Task | Status | Depends on | Notes |
| - | ---- | ------ | ---------- | ----- |
| T9  | `start/` tutorial spine | ✅ DONE | T6 | Verified already-accurate; real quick-start smoke test re-run twice (implementer + validator, independently) against the built `nextrush` package — curl output matches docs exactly. |
| T10 | "NextRush in One Page" overview | ✅ DONE | T9 | Rewrote `start/overview.mdx` into a full single-scroll tour, 16 deep-dive links, all independently verified against the real file tree incl. all 5 Wave-A concept pages and the new `reference/class/` structure. |
| T11 | `concepts/` incl. modules, DI scopes, interceptors, filters, lifecycle | ✅ DONE | T5 | **P0 drift fix**, validated byte-for-byte vs `@nextrush/class` source. Zero deprecated imports, zero "radix tree". `middleware-internals.mdx`/`package-hierarchy.mdx` relocated to `internals/` ahead of schedule. |
| T12 | `reference/` capability clusters + generated tables | ✅ DONE | T3, T4 | Deprecated `di/` + `plugins/controllers.mdx` retired into a real `class/` cluster (7 pages: index, decorators, controllers, modules, di, di-container, di-errors). **Caught by validator and fixed same-session:** first pass left the old `di/`+`plugins/controllers.mdx` duplicated alongside the new cluster (cleanup dispatched, re-verified via direct directory listing); second pass had a real fabricated-API defect — `di.mdx`/`di-container.mdx`/`di-errors.mdx` showed `Config`/`Injectable`/`Optional`/`delay`/`DIError`-family/metadata-utility imports as coming from `nextrush/class` when they only exist in `@nextrush/di` (confirmed via `packages/class/src/index.ts`, which re-exports only `Service`/`Repository`/`container`/`createContainer`/`inject`/`Container`). All three pages corrected: every non-re-exported symbol now shown importing from `@nextrush/di` directly; fresh build + grep sweep confirm zero remaining incorrect imports. |
| T13 | Top-level Packages/Ecosystem directory | ✅ DONE | T3 | 35 real cards, filters, search. One stale cross-link (`di-decorators`→ old path) found by validator after T11's rename, fixed same-session, re-verified. |
| T14 | `guides/` + capability finder; fold in examples | ✅ DONE | T5 | `guides/examples/` genuinely emptied and removed; unique content merged into `class-based.mdx` (constructor-injection testing pattern, functional-vs-class comparison table) and `rest-api.mdx` (typed-error-classes section). **Caught by validator and fixed same-session:** first pass left `guides/examples/` non-empty (cleanup dispatched, re-verified via direct listing); second pass flagged the promised typed-error-classes content existed as plain prose, not the claimed `<Callout>` — wrapped in a real `Callout` component to match the original claim exactly. |

**Validator overall verdict: PASS** (after two rounds of independently-caught, same-session-fixed defects — this is the loop working as designed, not a clean first pass). Every fix in this phase was independently re-verified with fresh build/grep output before being marked done — including the fixes I (the orchestrating agent) applied directly, which were checked with the same rigor as sub-agent output.

**Two-wave execution:** Wave A (T11 concepts, T13 packages directory) ran first and was gated/validated before Wave B (T9 start, T10 one-page, T12 reference, T14 guides) started, since Wave B's cross-links all depend on T11's real, final page paths. This dependency-correct sequencing is *why* the di-decorators cross-link break was caught immediately rather than propagating into Wave B's content.

**Defect log (for pattern-awareness in later phases):**
1. Wave A: stale `package-links.ts` guide link to a page T11 deleted (`di-decorators`→`dependency-injection`). Root cause: cross-task link, neither implementer's own scope covered the other's file.
2. Wave B round 1: T12 and T14 both failed their own stated exit criteria (old reference split not retired; `guides/examples/` not emptied) — implementer self-reports claimed completion that direct directory listing disproved. Caught by the orchestrating agent's own spot-check *before* dispatching the validator on unfinished work.
3. Wave B round 2: T12's DI reference pages had a fabricated import surface (documented `nextrush/class` imports for symbols that only exist in `@nextrush/di`) — the exact kind of error a hardcoded-sample compile-check (`docs:verify`'s check 2 only scans the first 15 files alphabetically) will never catch, and self-report otherwise would have shipped. T14's promised Callout was present as prose, not the actual component. Both fixed and re-verified with fresh build output before this phase was marked done.

**Follow-ups carried to later phases (flagged by the validator, not yet fixed — do not re-discover these, act on them):**
- `apps/docs/scripts/verify/reference-match.ts`'s package-inference regex still hardcodes the old `api-reference/` prefix — it has silently checked zero files since the T6/T12 rename. Fix before relying on that check again.
- `apps/docs/src/app/agent-spec.json/route.ts` still calls the router "Radix tree routing" and lists `@nextrush/decorators`/`@nextrush/controllers` as independent packages rather than deprecated shims (its `doc_url` links are already correct). Fix in T22 (agent-endpoint regeneration) at the latest.
- `pnpm docs:verify`'s overall exit code remains non-zero on a pre-existing, shrinking baseline (655→500→350 findings across Phases 0–2) confined to `concepts/`/`community/` files not yet touched by content-accuracy work. Link-check itself is fully green sitewide. Do not report the harness as "fully passing" until a later content phase retires this baseline.

## Phase 3 — Production & day-2  (Milestone M3 — ✅ DONE, validated 2026-07-10)

| # | Task | Status | Depends on | Notes |
| - | ---- | ------ | ---------- | ----- |
| T15 | `production/` spine (config, deploy+docker, observability, security, caching, scaling, tuning, benchmarking) | ✅ DONE | T11 | Split into 5 parallel disjoint sub-scopes (T15a config+reliability, T15b deployment+Docker, T15c observability, T15d security+caching+scaling, T15e perf+benchmarking). **Docker hard gate independently reproduced from scratch** by the validator (fresh container/port, not reusing the implementer's build): `docker build` succeeded, container reported `healthy` after 2 consecutive probes, `/health` and `/` both returned real 200s, full cleanup verified. **One real defect caught and fixed:** T15b's bun/deno/edge adapter pages showed `import { createApp, createRouter } from '@nextrush/core'` (9 occurrences) — `createRouter` is exported only from `@nextrush/router`, not `@nextrush/core` (confirmed via `packages/core/src/index.ts`'s barrel). Missed by both the implementer's own check and the automated harness's compile-check sampling; caught only by the validator's direct source cross-reference — exactly the failure mode Phase 2's lesson warned about. Fixed directly across all 3 files, re-verified with fresh build + targeted grep (distinguished from the 4 correct `import ... from 'nextrush'` meta-package usages elsewhere in production/, which genuinely do bundle both). Also refreshed the stale `production/index.mdx` placeholder (was still showing a Phase-1 "content landing in phases" Callout after 9/9 real sections shipped). |

## Phase 4 — Depth & growth  (Milestone M4 — ✅ DONE, validated 2026-07-10)

| # | Task | Status | Depends on | Notes |
| - | ---- | ------ | ---------- | ----- |
| T16 | `recipes/` cookbook | ✅ DONE | T14 | 6+ recipes (pagination, JWT auth, per-user rate-limit, CORS, Postgres, background jobs), each verified against real source. Validator re-ran the pagination smoke test fresh, independently — output matched exactly incl. the `page=0` 400 rejection. |
| T17 | Consolidated `migrate/` (express/koa/fastify/nestjs + deprecations + upgrade) | ✅ DONE | T11, T12 | 7 pages. Highest-risk page (`from-nestjs.mdx` decorator mapping, `deprecations.mdx` import map) validated line-by-line against `packages/class/src/index.ts` + `decorators/src` + `controllers/src` real exports — 100% match, zero fabrication. `guides/migration.mdx` correctly left as a real resolving pointer, not a 404. |
| T18 | `internals/` + RFCs/ADRs + versioning policy | ✅ DONE | T11 | 8 pages. **Highest-scrutiny item, confirmed genuine:** the dependency graph in `package-hierarchy.mdx` is programmatically derived (validator independently re-ran the generation script fresh — byte-identical output to what's embedded in the page), not hand-drawn. RFC/ADR existence check: `docs/RFC` (12), `docs/adr` (6), `docs/audits` (4), `docs/migrations` (1) all confirmed real via fresh `find`/`git status`. |
| T19 | `resources/` (faq, troubleshooting, glossary, compatibility matrix, changelog, roadmap) | ✅ DONE | T3 | 6 pages. The stale "31k RPS" figure flagged in Phase 3 is confirmed **fully retired** (repo-wide grep, zero matches) — `community/faq.mdx` relocated to `resources/faq.mdx` and fixed rather than just moved. Compatibility matrix cross-checked against 5 freshly-read `package.json` files by the validator, independent of the implementer's numbers. |
| T20 | Blog + Showcase | ✅ DONE | T7 | Real `/blog` with 2 fact-checked posts (release announcement, class-consolidation deep-dive) — every specific claim independently verified against source. **Anti-fabrication check on `/showcase`, treated with security-issue-level scrutiny:** confirmed a genuinely empty `entries` array with a real "coming soon" state and zero fabricated company/testimonial names — this was explicitly checked as an integrity concern, not just a quality note. |

**Validator overall verdict: PASS — the first fully clean phase in this rebuild, no fix-and-reverify cycle needed.** Both designated highest-scrutiny items (T18's generated-graph claim, T20's anti-fabrication check) were independently reproduced as genuine, not just plausible-looking. One thread the validator flagged as "not fully closed" (an `internals/contributing` link) was personally re-checked and confirmed resolving correctly — closed out before this entry was written.

## Phase 5 — Premium & launch  (Milestone M5 — ✅ DONE, validated 2026-07-10 — REBUILD COMPLETE)

| # | Task | Status | Depends on | Notes |
| - | ---- | ------ | ---------- | ----- |
| T21 | Feature-rich layer (Ask AI, runnable embeds, feedback, runtime switcher, copy-as-markdown) | ✅ DONE | T8, T12 | **Ask AI**: real BM25 retrieval (Orama) over real doc content, honestly disclosed as retrieval-not-generation (no LLM configured in this environment) — validator ran its own novel query and confirmed the top result traced to real source. **Embeds**: StackBlitz form-POST on hello-world/quick-start, well-formed against the real published `nextrush` npm package. **Feedback widget**: honestly disclosed as non-functional under static export (no `out/api/feedback`) rather than silently mis-sold as working. **Runtime switcher**: all 4 tabs (Node/Bun/Deno/Edge) cross-checked against real adapter barrels. **Copy-as-markdown**: real `/api/mdx/*.md` endpoint verified. |
| T22 | Launch hardening + full-site verification | ✅ DONE | all | Both known defects fixed and independently re-verified live: `agent-spec.json` no longer says "Radix tree" and correctly marks `@nextrush/decorators`/`@nextrush/controllers` as `deprecated: true`; `reference-match.ts`'s stale `api-reference/` regex fixed — the check now genuinely scans `reference/` instead of silently checking 0 files since Phase 2. Lighthouse re-run independently on the home page: 87/100/100 (perf/a11y/seo), exact match. Final build: **474/474 pages**, exit 0. Final harness: **411 findings**, 100% pre-existing/untouched-file baseline (same as Phase 4's number — confirms zero regression from Phase 5's own changes). |

**Validator overall verdict: PASS — FINAL VERDICT FOR THE ENTIRE 22-TASK REBUILD: PASS.** Every T21/T22 claim independently re-derived from raw output (BM25 query, live endpoint fetches, a fresh Lighthouse run, a fresh build+harness run) — zero fabrication found. Regression sweep across 3 earlier-phase fixes (Phase 3's `createRouter` import fix, Phase 2's DI-import fix, Phase 5's own density claim) found **zero regressions**.

**Two things honestly disclosed rather than smoothed over, consistent with this rebuild's standard:**
1. ~~Docker rebuild not independently re-executed in this final pass~~ — **RESOLVED 2026-07-10 (later session).** Disk headroom improved to 75GB free; re-ran the full gate from scratch at the user's request: `docker build --no-cache` succeeded (17 packages, 0 vulnerabilities, identical to the original build), container reported `healthy` in 8s, `/health` returned real `HTTP/1.1 200 OK` `{"status":"ok"}`, `/` returned real `HTTP/1.1 200 OK` `{"message":"Hello from NextRush in Docker!"}`, Docker's own health-probe log showed 2 consecutive exit-code-0 checks, and full cleanup (container + image) was confirmed empty afterward. This is the third independent reproduction of this exact gate across the rebuild (Phase 3's original validator, Phase 5's implementer, and now this closing re-verification) — zero drift, zero regression.
2. **Two content files** (`concepts/routing.mdx`, `concepts/request-lifecycle.mdx`) received small, correct, in-scope-in-spirit link/import fixes (`@nextrush/core`+`@nextrush/router`→`nextrush` meta package; removed a stale `@nextrush/controllers` mention) that neither T21 nor T22's implementer disclosed making. Personally confirmed both diffs are genuinely correct and harmless — a process-hygiene gap (undisclosed scope), not a correctness defect. Still open as a minor process note; not a functional issue.

**Mid-phase infrastructure interruption (recorded for the log, not a task failure):** the first Phase 5 dispatch failed outright — the root filesystem hit 100% used (816MB free), which prevented even starting a sub-agent session. Diagnosed before any blind retry: cleared `apps/docs/.next` (~600MB) and the repo's root `.turbo/cache`+`.turbo/daemon` (~770MB) — both fully regenerable build artifacts, zero source or content touched. This bought headroom to resume, but the underlying pressure was machine-wide (`/home/tanzim` at 279GB total, well outside this task's scope) — escalated to the user rather than guessing further into unrelated files, then resumed once the user confirmed more headroom existed.

## Progress log

Append a dated entry when a task changes status.

- _2026-07-10_ — Plan approved; PLAN.md + ROADMAP.md created. All tasks TODO. Next: T1–T2.
- _2026-07-10_ — Phase 0 (T1–T5) complete and independently validated. Sub-agent pipeline:
  4 parallel se-implementers (harness, registry, generated-reference pilot, templates) →
  se-validator re-executed every check from raw output, zero trust in self-report. Overall
  verdict: PASS. Two incidental flags reviewed and resolved (see Phase 0 table notes above).
  Next: Phase 1 (T6 scaffold IA + nav + redirects).
- _2026-07-10_ — **Phase 1 (T6–T8) complete and independently validated.** T6 ran alone first
  (hard dependency), then T7 + T8 in parallel against disjoint file scopes (confirmed zero
  overlap by validator). Overall verdict: PASS, with two precision corrections logged (harness
  overall exit code is non-zero on pre-existing baseline findings — link-check itself is green;
  and the pre-existing unrelated `packages/router/*` working-tree changes, now tracked as its
  own item below rather than a repeated footnote). Next: Phase 2 (T9–T14, core content rebuild).

- _2026-07-10_ — **Phase 2 Wave A (T11, T13) validated with one cross-task finding, now fixed.**
  T11 (concepts P0 drift fix: modules/DI-scopes/interceptors/filters/lifecycle) verified byte-
  for-byte against `@nextrush/class` source by the validator — zero invented APIs, zero
  deprecated imports, zero "radix tree" references. T13 (real Packages directory, 35 cards)
  independently verified — 43/44 links passed; validator caught ONE stale link
  (`package-links.ts` still pointed at `/docs/concepts/di-decorators`, which T11 correctly
  deleted/renamed to `dependency-injection.mdx` — a cross-task break neither implementer's own
  check would catch). Fixed directly (2-line change), rebuilt, and independently re-verified:
  new path 200s, old path correctly 404s (page genuinely gone, not a link bug), `/packages`
  still renders 35 cards. Wave A now clean. Proceeding to Wave B (T9, T10, T12, T14).
- _2026-07-10_ — **Phase 2 Wave B (T9, T10, T12, T14) complete after two rounds of caught-and-
  fixed defects; full Phase 2 now DONE and validated.** Round 1: T12 and T14 implementers
  self-reported completion that direct directory-listing checks disproved (old reference split
  not retired; `guides/examples/` not emptied) — caught before validation even started, fixed
  via targeted cleanup dispatch. Round 2: the independent validator found a real fabricated-API
  defect in T12's new DI reference pages (`Config`/`Injectable`/`Optional`/`delay`/DIError-family
  documented as importable from `nextrush/class` when they only exist in `@nextrush/di`) and one
  unfulfilled claim in T14 (promised Callout existed as plain prose). Both fixed directly and
  re-verified with fresh build + grep output. See the Phase 2 table above for full defect log
  and three follow-up items flagged for later phases (stale reference-match.ts regex, stale
  agent-spec.json wording, shrinking-but-nonzero docs:verify baseline). Next: Phase 3 (T15,
  production spine).
- _2026-07-10_ — **Phase 3 (T15, production spine) complete and independently validated.**
  Split into 5 parallel disjoint sub-scopes (config+reliability, deployment+Docker,
  observability, security+caching+scaling, perf+benchmarking) so each implementer verified
  one real package surface at a time. The Docker hard gate (`docker build` + running
  container + `/health` 200 response) was independently reproduced from a completely fresh
  container/port by the validator — genuinely confirmed, not rubber-stamped. One real
  fabricated-import defect (bun/deno/edge deployment pages importing `createRouter` from
  `@nextrush/core` instead of `@nextrush/router`, 9 occurrences) was caught by the validator's
  direct source cross-reference after slipping past both the implementer's own check and the
  automated harness — fixed directly across all 3 files, re-verified with a fresh build and a
  targeted grep (correctly distinguishing it from 4 legitimate `import ... from 'nextrush'`
  meta-package usages elsewhere, which genuinely do bundle both `createApp`+`createRouter`
  per `packages/nextrush/src/index.ts`). Stale `production/index.mdx` Phase-1 placeholder
  also refreshed now that all 9 sections are real. See the Phase 3 table above for full
  record. Next: Phase 4 (T16–T20: recipes, migrate, internals+RFCs, resources, blog+showcase).
- _2026-07-10_ — **Phase 4 (T16–T20) complete and independently validated — first fully clean
  phase, zero fix-and-reverify cycle needed.** 5 parallel disjoint sub-scopes. Both designated
  highest-scrutiny items held up under independent reproduction: T18's dependency graph is
  genuinely script-generated (validator re-ran the generator fresh, byte-identical output),
  and T20's `/showcase` anti-fabrication check confirmed a real empty state with zero
  fabricated social proof (checked with the same weight as a security finding, per this
  session's explicit instruction). The Phase-3-flagged stale "31k RPS" figure is confirmed
  fully retired. One validator-flagged loose thread (an internals cross-link) personally
  re-checked and confirmed resolving. Next: Phase 5 (T21–T22, the final gate).
- _2026-07-10_ — **Phase 5 (T21-T22) interrupted mid-dispatch by a disk-space infrastructure
  failure** (root filesystem at 100%, 816MB free — a sub-agent session couldn't even start).
  Diagnosed and freed ~1.4GB via regenerable build-cache cleanup only (`apps/docs/.next`,
  root `.turbo/cache`+`.turbo/daemon`) — zero source/content touched. Underlying pressure was
  machine-wide and out of this task's scope; escalated to the user rather than guessing
  further, then resumed once more headroom was confirmed.
- _2026-07-10_ — **REBUILD COMPLETE. Phase 5 (T21-T22) done; all 22/22 tasks validated.**
  Final independent validation personally re-derived every T21/T22 claim from raw output —
  a fresh BM25 query against the real Ask AI retrieval, live endpoint fetches for both fixed
  agent-spec.json defects, a fresh Lighthouse run (87/100/100, exact match), and a fresh
  full-site build+harness run (474 pages, 411 findings — identical to Phase 4's number,
  confirming zero regression). A 3-item regression sweep across earlier-phase fixes
  (Phase 3's createRouter fix, Phase 2's DI-import fix, Phase 5's own density claim) found
  zero regressions. Two items honestly disclosed rather than smoothed over: the Docker gate
  was not re-executed this pass (disk still only 1.6–2.1GB free — deemed too risky to attempt
  a second time after already causing one infrastructure failure; the Dockerfile is
  byte-unchanged since its independently-reproduced Phase 3 PASS, so risk is low but not
  zero) and two content files received small undisclosed-but-verified-correct link fixes.
  See the Phase 5 table above for the full closing record.
- _2026-07-10_ — **Docker gate closing re-verification, at user request.** Disk headroom had
  improved to 75GB free (from the 1.6–2.1GB that made re-running it too risky during Phase 5's
  own close). Re-ran the exact real artifact (`apps/docs/public/examples/docker-deploy/`) from
  scratch: `docker build --no-cache` succeeded (17 packages, 0 vulnerabilities — identical to
  the original build), container reached `healthy` in 8s, `/health` and `/` both returned real
  200s with the documented response bodies, Docker's own probe log showed 2 consecutive
  exit-0 checks, and full cleanup (container + image) confirmed empty afterward. Third
  independent reproduction of this exact gate across the rebuild — zero drift. The last
  disclosed open item from Phase 5's closing record is now resolved. Rebuild remains 22/22
  complete; only the minor process-hygiene note (two undisclosed-but-verified-correct link
  fixes) remains open, and it was never a functional defect.

**⚠ Tracked item (not part of this rebuild, but sitting in the shared working tree):**
`packages/router/src/router.ts`, `radix-tree.ts`, `packages/types/src/router.ts`, associated
test files, and `packages/router/ROUTER_AUDIT.md` are modified/untracked from an unrelated,
earlier session (router package work). Flagged by both the Phase 0 and Phase 1 validators as
out-of-scope-but-present. Recommend committing or branching this before the next phase's diff,
so it stops being re-flagged as a false-positive scope concern every validation pass.
