# Appendix — Benchmark Notes

Records provenance details, the duplicate-directory finding, and `latest/` handling for the
benchmark artifact used in [`../01-benchmark-analysis.md`](../01-benchmark-analysis.md). This file
exists so those details don't have to be re-litigated or copied into the canonical report.

## 1. The publishable run

**Run ID `2026-07-27T15-42-50`**, `standard` profile (3 runs/configuration), wrk 4.2.0, Node
v26.4.0, Intel i5-8300H (8 logical cores), 30s per measurement, 1/64/256 connections, 4 wrk
threads, pipelining disabled, fixed scenario order, CPU/client pinning off. 540 timed measurements
total (6 frameworks × 10 scenarios × 3 connection levels × 3 repeats). This is the run
[`../01-benchmark-analysis.md`](../01-benchmark-analysis.md) reports.

## 2. Commit provenance gap

The benchmark artifact **did not record a commit SHA** for the NextRush revision under test. This
investigation's source baseline (`feat/dev @ 5f77df1fcedcf62923ce08361e45e07bc9e9772c`) is a
*current* inspection baseline, chosen because it is the branch/commit available to inspect now — it
is explicitly **not proven** to be the same revision that produced the benchmark numbers. Any
structural finding in [`../03-subsystem-analysis/`](../03-subsystem-analysis/) is a statement about
*current* source; whether that source was identical to the benchmarked source is unverified. This
is precisely the gap Phase 0 of [`../07-optimization-roadmap.md`](../07-optimization-roadmap.md)
is designed to close for future runs.

## 3. Framework version provenance gap

Framework version strings referenced anywhere in the benchmark reporting were read at
**report-generation time**, not captured at the moment the run executed. If any framework's
published version changed between the benchmark run and report generation, the recorded version
string could be stale relative to what was actually measured. This is a distinct gap from the
commit-SHA gap above (this one affects the five comparison frameworks and raw Node.js; the SHA gap
affects NextRush specifically) but has the same practical fix: record versions/commits at run time,
not after the fact.

## 4. Warmup/methodology internal inconsistency

The benchmark artifact contains **two disagreeing statements about warmup**:
- The load table itself records framework warmup, per-scenario warmup, cooldown, pause, and GC
  tracing as **`not recorded`**.
- A later prose methodology paragraph in the same artifact states that warmup **did occur**.

This investigation does **not** pick one statement as authoritative over the other — doing so
would be inventing certainty the artifact itself doesn't have. Both statements are documented here
so a future reader knows this is an artifact-internal inconsistency, not an oversight by this
investigation. Whichever statement is true has a real bearing on how the 1-connection numbers in
particular should be read (a cold, unwarmed first measurement behaves differently from a warmed
one) — this is one of the reasons [`../01-benchmark-analysis.md`](../01-benchmark-analysis.md) §5
explicitly frames 1c results as "a latency probe," not a throughput signal to be taken at face
value.

## 5. The mislabeled duplicate directory

`apps/benchmark/results/2026-07-27T15-42-22` embeds the **same run ID** (`2026-07-27T15-42-50`)
inside its content as the primary publishable directory, and its retained content is identical.
This is a **mislabeled duplicate of the same run**, not a second, independent measurement session.
Treating it as a second data point would silently double-count one run's data and could create a
false impression of independent-session repeatability that the benchmark data does not actually
have (see [`../01-benchmark-analysis.md`](../01-benchmark-analysis.md) §6 — within-run CV is low,
but there is exactly one session, not two).

## 6. The `latest/` directory

`latest/` is run `2026-07-28T01-14-45`: **raw Node.js only**, **Hello World scenario only**, a
1-second "quick" profile, **one repeat**, and explicitly marked non-publishable by the benchmark
tooling itself. This investigation does **not** use `latest/` for any trend claim or any
NextRush-vs-raw comparison — it covers neither NextRush nor most scenarios, and its own duration/
repeat count fall well short of the `standard` profile's methodology. Its only relevance to this
investigation is as a reminder that not every directory under `apps/benchmark/results/` is a valid
source for a publishable claim — the run ID and profile type must always be checked before citing a
number from that tree.

## 7. Net effect on this investigation

None of the provenance gaps above invalidate the benchmark data as a *pattern-level* signal (the
scaling-saturation and payload-dilution patterns documented in
[`../04-root-cause-analysis.md`](../04-root-cause-analysis.md) §2 are robust to them — they'd hold
under either warmup interpretation, and don't depend on the exact commit SHA). They do mean that
**no number from this run should be treated as precisely reproducible against a specific, cited
commit** until a future run closes these gaps, which is exactly what
[`../07-optimization-roadmap.md`](../07-optimization-roadmap.md) Phase 0 requires before any
validation benchmark (`../06-validation-regression.md`) can be considered trustworthy.
