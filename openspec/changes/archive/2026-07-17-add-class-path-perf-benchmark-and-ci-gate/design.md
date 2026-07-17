## Context

`apps/benchmark/servers/nextrush-v3.js` benchmarks the functional path across 6 scenarios (hello
world, JSON, large JSON, path params, query params, deep nested params, POST with body parsing) —
confirmed by reading the file directly. No class-based/DI-path variant exists in the same
directory. `apps/benchmark/scripts/check-regression.js` already implements the comparison logic
(`--baseline`/`--latest`/`--tolerance` flags, exits 1 on regression) per its own header comment —
this is a mature, already-built tool waiting for CI wiring, not something to build from scratch.

## Goals / Non-Goals

**Goals:**
- Add a class-path server variant with the same scenario coverage as `nextrush-v3.js`, passing
  the harness's existing `pnpm bench:validate` fairness check (byte-identical response bodies
  across all compared servers).
- Produce and publish real, reproducible numbers: class-path registration cost (scaling with
  controller count) and per-request overhead vs. the functional path.
- Wire the existing `check-regression.js` into CI so a PR that regresses performance fails
  before merge, not after a user reports it.

**Non-Goals:**
- Not adding class-path variants of every comparison framework (Express/Fastify/Koa/Hono) — this
  benchmark is specifically functional-vs-class WITHIN NextRush, not a new cross-framework
  comparison axis. The existing cross-framework comparison (nextrush-v3 vs others) is unaffected
  and unexpanded by this change.
- Not building a new regression-detection algorithm — `check-regression.js` already exists and
  works; this only wires it into a CI trigger it doesn't currently have.
- Not making the per-PR gate block on every PR regardless of what changed — scope the CI trigger
  to paths likely to affect performance (core, router, di, class, adapters) so an unrelated docs
  or middleware-only PR doesn't pay the benchmark's wall-clock cost for no reason. Exact path
  filters are a during-implementation decision informed by this repo's existing CI path-filtering
  conventions, if any exist.

## Decisions

**D1 — The class-path benchmark server registers N controllers via `registerControllers()`,
mirroring the functional server's exact scenario set through class/decorator equivalents.**
For the numbers to mean anything as a "functional vs. class" comparison, the two servers must do
literally the same work through each path's idiomatic mechanism — a `@Controller`+`@Get`
decorator pair per functional route, not a hand-rolled DI setup that doesn't reflect real usage.
Alternative considered: benchmark only boot/registration cost, skip per-request comparison.
Rejected — the checklist's own acceptance criteria explicitly asks for both registration cost AND
per-request overhead; a benchmark measuring only one half would under-deliver on a task already
scoped to measure both.

**D2 — Registration-cost measurement varies controller count (e.g. 1, 10, 100, 1000) to
characterize how boot cost scales, not just a single fixed-N data point.**
The checklist's own "why it matters" note specifically calls out "hidden boot cost at 1000+
controllers" as the risk being addressed — a single-N benchmark wouldn't reveal a scaling
problem (e.g. O(n²) registration) that only shows up at larger N. Measure at multiple points on
the pinned harness and report the curve, not just one number.

**D3 — The CI regression gate runs a fast, low-N "smoke" scenario, not the full multi-run
"standard"/"full" publishable profile from `apps/benchmark/README.md`.**
Per that README's own distinction — only `standard` (3 runs) and `full` (5 runs) profiles back
*publishable* figures; a per-PR gate needs to be fast enough to run on every relevant PR without
becoming a bottleneck. Alternative considered: run the full multi-run profile in CI for maximum
statistical confidence. Rejected — the existing README already establishes that this repo
distinguishes "quick smoke" from "publishable, multi-run" benchmarking; the per-PR gate is
explicitly the former, and the class-path benchmark numbers published in docs (T017's own
deliverable) are the latter, run separately and less frequently.

## Risks / Trade-offs

- **[Risk]** A class-path benchmark server that doesn't precisely mirror the functional server's
  scenarios would produce a misleading "class is N% slower" number if the comparison isn't
  actually apples-to-apples.
  → **Mitigation**: Reuse the harness's own `pnpm bench:validate` fairness check (per this
  repo's benchmark README) to assert byte-identical response bodies/statuses between the new
  class-path server and `nextrush-v3.js` before trusting any timing number from either.
- **[Risk]** A CI performance gate is inherently noisier than a correctness test (shared CI
  runner contention, no CPU pinning in most CI environments) — a flaky failure on an unrelated
  PR erodes trust in the gate and gets it ignored/disabled.
  → **Mitigation**: Set the regression tolerance deliberately loose for the CI-gate profile
  (D3's smoke scenario) compared to what a publishable figure would use — the goal is catching a
  gross regression (e.g. an accidental O(n²) introduced in a hot path), not flagging normal CI
  jitter. Document the chosen tolerance and rationale in the CI job's own config/comments.
- **[Risk]** Path-scoping the CI trigger (Non-Goals) could miss a real regression introduced by
  a change the filter doesn't anticipate touching (e.g. a middleware change that indirectly
  slows the hot path via a shared utility).
  → **Mitigation**: Accept this as a deliberate, disclosed tradeoff — a benchmark gate on every
  single PR regardless of path would be prohibitively slow for a ~35-package monorepo; scope
  narrowly now, widen the path filter later if a real regression is found to have slipped through
  an under-scoped filter (a lesson-memory-worthy finding if it happens, not a reason to over-scope
  preemptively).

## Migration Plan

No runtime/data migration. T017 (new server + published numbers) and T018 (CI wiring) ship as
separate commits — T017 first, since T018's CI gate needs T017's baseline to compare against.
Both are additive to a devDependency-only app; revertible independently.

## Open Questions

- Does this repo have an existing CI path-filter convention (e.g. `paths:` in a GitHub Actions
  trigger) to follow for scoping T018's gate, or would this be the first such filter introduced?
  Check `.github/workflows/*.yml` during implementation before inventing a new pattern.
