## Why

T017 and T018 are the last two open P2 items in Phase 1, both in the benchmark/performance
domain, and T018 explicitly depends on T017's existence (a per-PR regression gate needs a
baseline number to compare against — for the class path specifically, no such baseline exists
today).

Verified directly against source:
- `apps/benchmark/servers/` contains `nextrush-v3.js` (functional path) plus comparison servers
  (Express, Fastify, Koa, Hono, raw Node) — but no class-based/DI-path server variant. T017's
  benchmark (functional vs. class path) cannot run today because half of what it needs to compare
  doesn't exist yet.
- `apps/benchmark/scripts/check-regression.js` already exists and implements "compare latest run
  against a pinned baseline, fail on regression" — confirmed via its own header comment. T018 is
  wiring this already-built tool into CI, not building a regression checker from scratch.

## What Changes

- Add a class-based/DI-path server variant to `apps/benchmark/servers/` (e.g.
  `nextrush-v3-class.js`), matching the existing `nextrush-v3.js`'s scenario coverage so the two
  are a fair, like-for-like comparison per this repo's own benchmark-fairness principle (`pnpm
  bench:validate` already asserts byte-identical response bodies across servers — the class
  variant must pass that same validation).
- Run the benchmark harness on the pinned, hardened setup (per `apps/benchmark/README.md`'s own
  "standard"/"full" multi-run profiles) to produce and publish registration-cost (boot time,
  scaling with controller count) and per-request overhead numbers, functional vs. class path.
- Add a CI job that runs `check-regression.js` against a stored baseline on every PR touching
  performance-sensitive paths, failing the PR on a significant regression.
- **BREAKING**: None. Both are additive to the benchmark app (a devDependency-only, non-published
  workspace app) — zero impact on any published package's runtime behavior or public API.

## Capabilities

### New Capabilities

- `class-path-overhead-benchmark`: The requirement that a reproducible, published benchmark
  measures and discloses the class/DI path's registration cost and per-request overhead relative
  to the functional path.
- `per-pr-performance-gate`: The requirement that CI fails a pull request on a significant
  throughput/latency regression against a stored baseline, using the existing regression-checker
  tool.

### Modified Capabilities

- None. No existing `openspec/specs/*` capability governs benchmark scenario coverage or a
  per-PR performance gate.

## Impact

- **Affected code:** New `apps/benchmark/servers/nextrush-v3-class.js` (or similar name,
  matching this directory's existing naming convention); `apps/benchmark/scripts/check-regression.js`
  (verify/extend if CI wiring needs a machine-readable exit code or output format it doesn't
  already have — check before assuming a change is needed); `.github/workflows/` (new CI job).
- **Affected docs:** `apps/benchmark/README.md` (documents the new class-path scenario and the
  CI regression gate); `apps/docs/content/docs/performance/` (if the published numbers belong
  there per this repo's docs-tiering convention — check `documentation.instructions.md`'s content
  map before deciding).
- **Dependencies:** T018 depends on T017 within this change (a regression gate needs the
  baseline T017 produces) — sequenced accordingly in tasks.md. Depends on T003 (multi-runtime CI
  matrix), already ☑, per the original checklist's own dependency note.
- **Systems:** CI gains a new job with real wall-clock cost (running a benchmark suite, even a
  smoke-scale one, is slower than a unit test). This is a disclosed tradeoff for catching
  performance regressions before they ship, consistent with this repo's own "no per-PR perf gate"
  finding being treated as a real, worth-fixing gap.
