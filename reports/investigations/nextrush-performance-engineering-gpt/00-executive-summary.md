# NextRush Runtime Performance Investigation — Executive Summary

| Field            | Value                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| **Report type**   | Performance                                                            |
| **Scope**         | NextRush core request lifecycle (adapter, router, middleware, context, body-parser, serializer, static) vs. benchmark suite in `apps/benchmark` |
| **Date**          | 2026-07-28                                                             |
| **Investigator**  | se-implementer (documentation-only node)                              |
| **Inspected commit** | `feat/dev` @ `5f77df1fcedcf62923ce08361e45e07bc9e9772c` (source baseline only — **not proven** to be the benchmarked revision; see [Benchmark Notes](./appendix/benchmark-notes.md)) |
| **Status**        | Complete — evidence-gated; runtime profiling remains explicitly Blocked |
| **Related**       | [`01-benchmark-analysis.md`](./01-benchmark-analysis.md), [`02-runtime-profiling.md`](./02-runtime-profiling.md), [`04-root-cause-analysis.md`](./04-root-cause-analysis.md), prior: `report/router/route-params-profile.md` (secondary, non-reproducible — see below) |

## Playbook phase

This report synthesizes Part 0 (Preparation) through Part 8 (Roadmap) at the summary level.
Detailed phase-by-phase status lives in [`appendix/investigation-checklist.md`](./appendix/investigation-checklist.md).
**Headline: Parts 0–2 (preparation, benchmark assessment) are Completed. Part 3 (runtime
profiling/evidence) is Blocked — no current profiling artifacts exist. Parts 4–8 proceed only as
far as the blocked evidence gate allows: structural analysis is Completed, causal attribution is
Blocked.**

## What was investigated

The publishable benchmark run (`2026-07-27T15-42-50`, `standard` profile) shows NextRush trailing
raw Node.js and Fastify at concurrency, while placing competitively at 1 connection on several
scenarios. This investigation used that benchmark artifact plus current NextRush source to build a
structural explanation of *where* request-lifecycle cost is plausibly concentrated. It does **not**
run any profiler, benchmark, or test — it is a synthesis of already-existing, approved evidence
under `docs/playbooks/performance-review-playbook.md`.

## Overall health assessment

NextRush's like-for-like score (90/144) sits behind raw Node (139), Fastify (112), and Hono (91),
and ahead of Koa (45) and Express (27) — see [`01-benchmark-analysis.md`](./01-benchmark-analysis.md)
for the full table. The gap versus raw Node.js is **largely established by 64 connections already**
(e.g. Hello −16.6% at 64c vs. −18.1% at 256c) and **narrows sharply for large payloads** (Large JSON
−11.3% at 256c vs. Empty −25.1%). This pattern is consistent with a **fixed, per-request,
concurrency-sensitive overhead** shared across scenarios — but the benchmark data alone cannot name
which subsystem or line of code causes it. No CPU profile, heap profile, GC trace, or event-loop
trace exists in the current workspace to close that gap (see [`02-runtime-profiling.md`](./02-runtime-profiling.md)).
Historical reports reference such artifacts, but the raw files are absent and the historical
numbers are secondary, unverified, and drawn against source that may since have changed — the
project's own adapter/router files inspected in this investigation appear structurally newer than
what the historical report describes.

## Top findings

1. **F-BENCH-01** — The only publishable session lacks a benchmark commit SHA, captures framework
   versions after the run, contains contradictory warmup provenance, and has no independent-session
   peer: `2026-07-27T15-42-22` is a duplicate, while `latest/` is quick/raw-only/non-publishable.
   **Confirmed** (artifact metadata). Priority: **P0** measurement integrity; this limits trend and
   code-to-result attribution but does not itself identify or cause runtime overhead.
2. **F-GATE-01** — No current CPU/heap/GC/event-loop evidence exists to attribute the gap to a
   specific subsystem. **Confirmed** (absence of artifacts). Priority: **P0** — this blocks every
   causal recommendation below it.
3. **F-ADAPTER-01** — The benchmark configuration exercises the adapter's default 30-second
   handler-timeout machinery (`Promise.race`, extra Promise/Symbol/timer allocations) on every
   request, because the benchmark server calls `listen(app, PORT)` with no options and the adapter
   default is non-zero. **Confirmed** (source + config reading). Whether this machinery is
   performance-material is **Unknown** — no profile isolates its cost. Priority: **P1** (highest
   ranked untested hypothesis).
4. **F-ROUTER-01** — The dynamic route matcher allocates per-request frame/bind-name arrays during
   backtracking, structurally distinct from the O(1) static path. **Confirmed** (source reading).
   Whether this allocation is a *meaningful* contributor to the Route Params (−28.9% at 256c) and
   Deep Route (−22.4%) gaps is **Hypothesis** — a prior, now-unverifiable report claimed this cost
   was small (~4% CPU) against different code and absent raw artifacts; this claim is **not**
   adopted as current fact.
5. **F-BODY-01** — `NodeBodySource.buffer` and the JSON body-parser add per-request listener/promise
   machinery on top of `Buffer.concat`, and POST JSON already shows a below-parity gap at 1
   connection (unlike most other scenarios). **Confirmed** (source + benchmark data). Causal
   contribution is **Hypothesis** — untested.

## Headline recommendation

**Do not implement any source optimization from this investigation.** The runtime-evidence gate is
blocked; every causal claim above the "structure confirmed" line is a hypothesis. The concrete next
step is the **P0 measurement phase** in [`07-optimization-roadmap.md`](./07-optimization-roadmap.md):
establish benchmark-commit provenance, capture CPU/allocation profiles for Hello/Empty/Route
Params/POST JSON, and run a controlled default-timeout-vs-timeout=0 A/B. Only evidence from that
phase can promote any hypothesis in [`04-root-cause-analysis.md`](./04-root-cause-analysis.md) to
Confirmed or Strong Evidence.

## Reading order

`01-benchmark-analysis.md` → `02-runtime-profiling.md` → `03-subsystem-analysis/*` → `04-root-cause-analysis.md`
→ `05-solution-engineering.md` → `06-validation-regression.md` → `07-optimization-roadmap.md`.
Appendix files (`appendix/*`) are supporting material: phase checklist, benchmark provenance notes,
and open questions for evidence owners.
