# Appendix — Open Questions

Lists unresolved data/evidence needs and their probable owners, per this investigation's
constraint to list open questions "without inventing answers." Every item here is something this
documentation-only investigation could not resolve because it requires running a shell command,
profiler, or benchmark — capabilities explicitly withheld from this task.

## Provenance (blocks Phase 0 of the roadmap)

1. **What NextRush commit was actually benchmarked in run `2026-07-27T15-42-50`?** Owner: whoever
   runs the next benchmark session — must record the commit SHA in the run's metadata going
   forward. Until answered, every structural claim in
   [`../03-subsystem-analysis/`](../03-subsystem-analysis/) is a statement about *current* source
   (`5f77df1fcedcf62923ce08361e45e07bc9e9772c`), not provably the *benchmarked* source.
2. **Did framework warmup actually occur, and if so, with what parameters (duration, request
   count)?** The artifact's load table and its own methodology prose disagree (see
   [`benchmark-notes.md`](./benchmark-notes.md) §4). Owner: the benchmark harness maintainer —
   either the harness should record warmup parameters in the load table itself, or the
   methodology prose should be corrected to match what the harness actually does.
3. **What were the exact framework versions at the time of the run** (not read after the fact)?
   Owner: benchmark harness — capture versions at run start, not at report generation.

## Runtime evidence (blocks Phase 0 and everything downstream)

4. **What does a current CPU profile of the Hello, Empty, Route Params, and POST JSON scenarios
   show**, against the pinned commit from question 1? Owner: whoever executes the P0 phase in
   [`../07-optimization-roadmap.md`](../07-optimization-roadmap.md) — requires running the server
   under `--cpu-prof` (or equivalent) while under `wrk` load; this investigation could not run
   either.
5. **What does a current allocation profile of the same four scenarios show?** Same owner, same
   blocker (`--heap-prof` or equivalent).
6. **What is the GC count, pause duration, and heap growth for the same four scenarios?** Same
   owner, same blocker.
7. **What is the event-loop delay / event-loop utilization under the same load?** Same owner, same
   blocker.
8. **Does disabling the adapter's default timeout (`timeout <= 0`) change RPS at 64c/256c for
   Hello, holding everything else constant?** This is the single highest-value unanswered question
   in the entire investigation — it directly tests the #1-ranked hypothesis
   ([`../04-root-cause-analysis.md`](../04-root-cause-analysis.md)) with a change that already
   exists in the code (the fast path) and requires no new implementation, only running the A/B.
   Owner: whoever executes P0.

## Historical-artifact reconciliation (does not block Phase 0, but should not be forgotten)

9. **Do the raw artifacts cited by `report/router/route-params-profile.md`
   (`param-match-alloc-2026-07-18T14-13-26/param-match-alloc.json`,
   `heapprof-server/nextrush-route-params.heapprofile`,
   `cpuprof-server/nextrush-route-params.cpuprofile`,
   `route-params-ab-2026-07-18T14-26-18/route-params-ab.json`) exist anywhere outside the trees
   this investigation was permitted to search** (e.g. a different branch, a teammate's local
   machine, an external artifact store)? If they exist and can be re-attached with confirmed
   commit provenance, the router hypothesis in this investigation could potentially be
   re-evaluated against them **after** independently confirming they match current source — this
   investigation does not assume they exist elsewhere; it only notes the possibility. Owner:
   whoever authored that prior report, or the benchmark-artifact retention process (why were they
   not retained?).

## Scope gaps (informational, not blocking)

10. **Should a static-file-serving benchmark scenario be added**, and if so, what should its
    parameters be (file sizes, cache-hit/miss ratio, range-request frequency)? Owner: benchmark
    harness maintainer, per Phase 3 of [`../07-optimization-roadmap.md`](../07-optimization-roadmap.md).
    No answer is proposed here — this is a design question for whoever owns the benchmark suite,
    not something this investigation should decide unilaterally.
11. **Should the benchmark suite capture per-scenario resource aggregates (RSS/CPU) rather than
    only suite-wide aggregates?** The current suite-wide aggregation (see
    [`../01-benchmark-analysis.md`](../01-benchmark-analysis.md) §7) cannot attribute resource cost
    to any one scenario. Owner: benchmark harness maintainer.
