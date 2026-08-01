# Root Cause Analysis (Canonical)

**Playbook phase:** Part 5 — Root Cause Analysis. **Status: Bounded by the blocked evidence gate**
(see [`02-runtime-profiling.md`](./02-runtime-profiling.md)) — structural classification is
Completed; causal confirmation is Blocked. This is the canonical hypothesis ranking for the
investigation; subsystem files link here rather than re-deriving priority.

Related: [`01-benchmark-analysis.md`](./01-benchmark-analysis.md) (the gaps under investigation) ·
[`02-runtime-profiling.md`](./02-runtime-profiling.md) (why no hypothesis below is Confirmed) ·
[`03-subsystem-analysis/`](./03-subsystem-analysis/) (per-subsystem detail) ·
[`05-solution-engineering.md`](./05-solution-engineering.md) (what happens if a hypothesis is
confirmed).

## 1. Root-cause boundary statement

Per this investigation's governance and the playbook's §1.6 "Evidence Over Assumptions" and §3.7
confidence-labeling principle: **no root cause in this section may be labeled Confirmed or Strong
Evidence.** The runtime-evidence gate (§2, `02-runtime-profiling.md`) is blocked — no CPU profile,
allocation profile, GC trace, or event-loop trace exists against current source. Every causal
statement below is a Hypothesis, ranked by how well it is structurally motivated and how directly
testable it is — not by confidence that it is correct.

## 2. Confirmed patterns (benchmark-data level — not yet causes)

These two patterns are Confirmed as *observations in the benchmark data*. They motivate the
hypotheses in §3 but do not themselves identify a mechanism.

1. **Scaling-saturation pattern:** the gap versus raw Node.js is largely established by 64
   connections and does not grow proportionally from 64c to 256c for most scenarios (Hello −16.6%→
   −18.1%; Route Params −29.5%→−28.9%; Empty −25.4%→−25.1%). Source: `01-benchmark-analysis.md`
   §3–§4.
2. **Payload-size dilution pattern:** minimal-payload scenarios (Hello, Empty) show larger relative
   gaps than the large-payload scenario (Large JSON −11.3% vs. Hello −18.1%/Empty −25.1% at 256c).
   Source: `01-benchmark-analysis.md` §3.

Both patterns are consistent with a **fixed, per-request, largely concurrency-saturated overhead**
somewhere in the shared request path — but "consistent with" is not "proves." Multiple different
mechanisms (adapter timeout machinery, context construction, response-write structure) could each
independently produce this same aggregate pattern, and the benchmark data cannot distinguish
between them. This is precisely why the runtime-evidence gate exists.

## 3. Ranked hypotheses

### Hypothesis priority 1 — Adapter handler-timeout/lifecycle machinery

**Claim:** the enabled 30-second default timeout path in the Node adapter (`Promise.race`, extra
Symbol/promise/timer/closure allocations) contributes to the shared scaling deficit.

- **Why ranked #1:** it is the only hypothesis **confirmed to execute on literally every
  benchmarked request** (the benchmark server calls `listen(app, PORT)` with no options, and the
  adapter default is non-zero — both Confirmed facts, not inference). It also has an existing,
  low-risk, one-variable diagnostic already built into the code (the `timeout <= 0` fast path),
  making it the cheapest hypothesis to test cleanly.
- **Supporting structural reasoning:** the enabled path is the single largest concentration of
  distinct allocation-and-scheduling machinery (Symbol, promise, race array, follower `.then`,
  timeout Promise, `setTimeout`, executor/callback closures) identified anywhere in this
  investigation's source reading, and it runs before router/middleware/context work even begins.
- **Detail and finding:** [`03-subsystem-analysis/request.md`](./03-subsystem-analysis/request.md)
  (F-ADAPTER-01).
- **What would confirm or reject it:** the P0 default-timeout-vs-`timeout=0` A/B (see
  [`07-optimization-roadmap.md`](./07-optimization-roadmap.md)).

### Hypothesis priority 2 — Dynamic route matcher frame/bind allocation

**Claim:** per-request `WalkFrame`/`bindNames`/`bindValues` allocation during dynamic-route
backtracking contributes to the Route Params (−28.9% at 256c) and Deep Route (−22.4%) deficits.

- **Why ranked #2:** Route Params and Deep Route show the two largest like-for-like gaps in the
  entire suite, and both scenarios specifically exercise the dynamic-match path (as opposed to
  Hello/Empty/JSON's static path, which is confirmed allocation-free). This is a real structural
  correlation, not merely "a different design exists."
- **Caveat — do not adopt the historical numbers:** a prior report (`report/router/route-params-profile.md`)
  claims this matcher is only ≈4% of CPU and ≈0.34% of sampled heap in a real-server profile. That
  claim is **not adopted** here: its raw artifacts are absent from the current workspace, its
  source provenance is unpinned, and current adapter/router source appears structurally newer than
  what it describes profiling (see [`02-runtime-profiling.md`](./02-runtime-profiling.md) §3). This
  investigation treats the historical conclusion as neither confirmed nor refuted for current code
  — it is simply inadmissible as current evidence.
- **Detail and finding:** [`03-subsystem-analysis/router.md`](./03-subsystem-analysis/router.md)
  (F-ROUTER-01).
- **What would confirm or reject it:** current CPU + allocation profiles of Route Params and Deep
  Route against the pinned commit (P1 in `07-optimization-roadmap.md`, conditional on P0 landing).

### Hypothesis priority 3 — BodySource buffering / body-parser overhead

**Claim:** `NodeBodySource.buffer`'s listener/settlement machinery and the JSON body-parser's
guard/decode/parse/validate chain contribute to the POST JSON deficit.

- **Why ranked #3:** POST JSON is the only like-for-like scenario **already below parity at 1
  connection** (`01-benchmark-analysis.md` §5) — unlike Hello/Empty/Route Params, whose gaps only
  become material under concurrency. A low-concurrency deficit points toward request-specific
  per-call work (buffering, parsing) rather than the concurrency-sensitive shared costs that
  hypotheses #1 and #2 are structurally better suited to explain.
- **Detail and finding:** [`03-subsystem-analysis/body-parser.md`](./03-subsystem-analysis/body-parser.md)
  (F-BODY-01).
- **What would confirm or reject it:** current CPU + allocation profile of the POST JSON scenario
  (P1 in `07-optimization-roadmap.md`, conditional on P0 landing).

## 4. Unranked — Unknown, not merely low-priority

These subsystems have **no** ranked hypothesis, which is a distinct and stronger statement than
"ranked #4/#5":

- **Middleware, Context, Response** — each has confirmed structural facts (see the respective
  subsystem files) but **no benchmark scenario or structural correlation** singles any of them out
  more than the shared per-request overhead already attributed to hypotheses #1–#3. They require
  dedicated evidence before they can even be ranked, not just before they can be confirmed.
- **Serialization** — actively de-prioritized (not merely unranked) because `JSON.stringify` is a
  shared V8 primitive paid by every compared framework for an equivalent payload; see
  [`03-subsystem-analysis/serializer.md`](./03-subsystem-analysis/serializer.md) (F-SERIALIZER-01).
- **Static file serving** — unrepresented, not merely unprofiled: no benchmark scenario exercises
  it at all. See [`03-subsystem-analysis/static-files.md`](./03-subsystem-analysis/static-files.md)
  (F-STATIC-01).

## 5. What this ranking is and is not

**Is:** a prioritization of where to spend the limited, high-value P0/P1 profiling effort described
in [`07-optimization-roadmap.md`](./07-optimization-roadmap.md), based on (a) confirmed execution
on every request, (b) structural correlation with the largest observed gaps, and (c) distinct
benchmark signatures (concurrency-sensitive vs. low-concurrency-material) that make each hypothesis
independently testable.

**Is not:** a claim that hypothesis #1 is more likely correct than #2 or #3, or that any of them is
confirmed, partially confirmed, or "probably right." Per the evidence gate, all three remain
Hypothesis until profiled against current, pinned source.

## 6. Playbook cross-reference

This report satisfies Part 5 (§5.1 Identify Root Cause, §5.2 Classify, §5.3 Measure Impact — to the
extent measurable without profiling data) of `docs/playbooks/performance-review-playbook.md`.
§5.4–§5.6 (optimization opportunities, trade-offs, prioritization) are carried forward into
[`05-solution-engineering.md`](./05-solution-engineering.md) and
[`07-optimization-roadmap.md`](./07-optimization-roadmap.md).
