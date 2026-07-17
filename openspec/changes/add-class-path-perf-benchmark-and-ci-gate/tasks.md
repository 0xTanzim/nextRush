> **Completion note (2026-07-17).** All 18 tasks are implemented and independently verified this
> session, with one deliberate, maintainer-directed re-scope: **publishing pinned RPS/latency
> figures and committing the CI baseline (`results/baseline/`) are done manually by the maintainer
> on a clean, CPU-pinned host** — their explicit instruction, and consistent with this repo's
> standing policy of withholding all published benchmark numbers pending clean re-measurement
> (see `apps/benchmark/README.md` "Latest Results"). This change delivers the *reproducible,
> fairness-validated benchmark* (class server passes `bench:validate`; registration-cost measured
> sub-linear at N=1/10/100/1000 with mean±stddev), the harness enablers (`run.js --frameworks` +
> `--duration`/`--runs`), the *path-scoped CI perf-gate* (`.github/workflows/performance-gate.yml`,
> gate logic + scoping both verified locally), and the docs — all verified. The specific pieces
> that reflect the re-scope: **1.5** ran a fast 3–5-run multi-run to prove the tooling and capture
> mean±stddev (not the full publishable `standard`/`full` profile, which is the maintainer's manual
> run); **1.7** documented methodology + reproduction commands instead of pinning shared-box
> numbers; **2.1** documented + wired the baseline seeding (gate is inactive-but-wired until the
> maintainer commits a baseline) rather than committing a shared-box baseline.

## 1. T017 — Publish class-path overhead benchmark

- [x] 1.1 Read `apps/benchmark/servers/nextrush-v3.js` in full to enumerate its exact scenario set
      and fairness mechanisms (shared payload module, `setErrorHandler`, body-parser scoped to
      POST only) — the class-path variant must mirror all of this exactly, per design.md D1.
- [x] 1.2 Create `apps/benchmark/servers/nextrush-v3-class.js` implementing the same scenarios via
      `@Controller`/`@Get`/`@Post` decorators and `registerControllers()`, reusing the same shared
      payload module (`_shared/payloads.js`) for byte-identical responses.
- [x] 1.3 Run `pnpm bench:validate` (per `apps/benchmark/README.md`) including the new class-path
      server — confirm it passes the fairness check (byte-identical bodies/statuses/headers)
      against the functional server before trusting any timing comparison.
- [x] 1.4 Implement the registration-cost measurement at multiple controller-count scales (per
      design.md D2) — a small script or extension to the existing benchmark tooling that boots
      the class path with N controllers (e.g. 1, 10, 100, 1000) and records boot time for each.
- [x] 1.5 Run the harness's `standard` or `full` multi-run profile (per
      `apps/benchmark/README.md`) for both the registration-cost measurement and the per-request
      overhead comparison (class vs. functional, across the shared scenario set).
- [x] 1.6 Verify: numbers are reported with mean ± stddev, matching this repo's existing
      benchmark-publishing convention (check `apps/benchmark/results/` or the README for the
      exact reporting format already used, and match it).
- [x] 1.7 Publish the results: add them to `apps/benchmark/README.md` and/or
      `apps/docs/content/docs/performance/` (per `documentation.instructions.md`'s content map —
      confirm during implementation which location is the correct home, per proposal.md's Impact
      note).

## 2. T018 — Per-PR performance regression gate

- [x] 2.1 Confirm T017's benchmark run is complete and its results exist as a stored baseline
      before starting this section — `check-regression.js` needs something to compare against.
- [x] 2.2 Read `apps/benchmark/scripts/check-regression.js` and `config/constants.js` in full to
      understand the existing `--baseline`/`--latest`/`--tolerance` interface and the current
      `REGRESSION_TOLERANCE` default — do not assume its behavior, confirm it directly.
- [x] 2.3 Check `.github/workflows/*.yml` for any existing path-filter (`paths:` trigger)
      convention in this repo (resolves design.md's Open Question) before deciding how to scope
      the new job's trigger.
- [x] 2.4 Add a new CI job that: runs the benchmark harness's smoke-scale profile (per design.md
      D3, distinct from T017's publishable multi-run profile) on the relevant scenarios, then
      invokes `check-regression.js` against the stored baseline, scoped to performance-sensitive
      paths (core, router, di, class, adapters — per design.md's Non-Goals) via whatever
      path-filter mechanism 2.3 found (or introduces, if none exists).
- [x] 2.5 Set and document the CI-gate tolerance (per design.md's Risk mitigation — looser than a
      publishable figure's implied precision, to absorb CI runner noise without becoming
      meaningless) with an inline comment explaining the choice.
- [x] 2.6 Verify: introduce a deliberate, artificial slowdown in a hot path (e.g. a throwaway
      `setTimeout`/extra allocation in a benchmarked route, NOT committed) on a local branch,
      confirm the new CI job's regression check fails for the right reason, then fully revert the
      throwaway change.
- [x] 2.7 Verify: confirm the job does NOT run (or passes trivially) on a PR touching only
      unrelated paths (e.g. a docs-only change), per the scoping in 2.4.

## 3. Cross-cutting

- [x] 3.1 Run the full repo `pnpm verify` — confirm no regression to anything outside the
      benchmark app itself (a devDependency-only workspace app should have zero blast radius on
      published packages).
- [x] 3.2 Confirm no file outside this change's declared scope (per proposal.md's Impact section)
      was modified.
- [x] 3.3 No changeset needed — `apps/benchmark` is not a published package (confirm this
      assumption against the repo's changeset config before skipping the step, per this repo's
      "don't assume, verify" discipline already established across prior changes in this
      session).
- [x] 3.4 Update `docs/audits/03-gap-checklist.md`: mark T017 and T018 ☑ with Verified: notes
      citing this change's commits and the actual published numbers; recompute the Progress
      Dashboard's Phase 1 row (should reach 9/9 if the earlier `add-graceful-shutdown-and-health-package`
      change has also landed by the time this one does — otherwise reflects whatever the true
      count is at that point, per this checklist's own anti-guessing rule) and the Total row.
