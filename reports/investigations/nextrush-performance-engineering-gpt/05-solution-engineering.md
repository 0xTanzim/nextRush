# Solution Engineering (Canonical)

**Playbook phase:** Part 6 — Solution Engineering. **Status: Conditional / not started** — every
solution below is gated on evidence this investigation does not have (see
[`02-runtime-profiling.md`](./02-runtime-profiling.md)). This report is the canonical
alternatives/trade-off analysis; other reports link here rather than re-deriving it.

Related: [`04-root-cause-analysis.md`](./04-root-cause-analysis.md) (the hypotheses these solutions
would address) · [`06-validation-regression.md`](./06-validation-regression.md) (how each would be
validated) · [`07-optimization-roadmap.md`](./07-optimization-roadmap.md) (sequencing).

## 0. Governing constraint

Per this investigation's explicit instruction: **do not recommend source optimization as ready to
implement.** Every "alternative" documented below is a *conditional design sketch* — evaluated only
if its triggering hypothesis is confirmed by P0/P1 profiling — not a proposal queued for
implementation. No code change follows from this report directly.

## 1. Optimization goal, per hypothesis (playbook §6.1)

| Hypothesis | If confirmed, the optimization goal would be |
| --- | --- |
| #1 Adapter timeout machinery | Reduce per-request allocation/scheduling overhead in the enabled-timeout path without weakening the timeout guarantee |
| #2 Router dynamic-match allocation | Reduce per-request frame/bind allocation in dynamic-route matching without weakening precedence, decoding, or security properties |
| #3 Body-parser/BodySource overhead | Reduce per-request buffering overhead for the common single-chunk case without weakening limits, abort handling, or cross-runtime semantics |

## 2. Conditional alternatives — Hypothesis #1 (Adapter timeout machinery)

**Trigger:** the P0 default-timeout-vs-`timeout=0` A/B (`07-optimization-roadmap.md`) shows a
reproducible, threshold-meeting RPS difference attributable to the timeout path.

| Alternative | Description | Advantages | Disadvantages |
| --- | --- | --- | --- |
| A. Keep `Promise.race`, do nothing | Status quo | Zero risk, zero effort, correctness fully proven in production today | Leaves any confirmed cost unaddressed |
| B. Behavior-preserving single-settlement state machine | Replace the race with a state machine that tracks handler/timeout settlement explicitly, avoiding the race-array/follower-then allocation shape | Potentially fewer allocations per request | New correctness surface to prove: clean 504, late-settlement suppression, rejection handling, socket-timeout independence, shutdown behavior, cross-adapter parity — each must be independently re-verified; higher implementation/review cost |
| C. Lazy timer allocation (only arm the timeout timer if the handler hasn't settled within some short grace window) | Avoids allocating a timer for handlers that resolve near-instantly | Could reduce cost specifically for fast handlers (Hello, Empty) | Introduces a second timing threshold to reason about and test; unclear if it changes worst-case behavior meaningfully; not evaluated for correctness here |

**This investigation does not select between A/B/C.** Selection requires the P0 A/B result first,
then — if the timeout path is confirmed causal — an RFC per `tdd-workflow.md` (repo) and
`AGENTS.md` §20, because this touches a public-facing default (adapter `timeout` behavior) and any
change to it needs migration analysis. This report documents the alternatives for that future RFC
to start from; it is not itself that RFC.

## 3. Conditional alternatives — Hypothesis #2 (Router dynamic-match allocation)

**Trigger:** CPU/allocation profiles of Route Params and Deep Route (P1, conditional on P0) show a
reproducible, threshold-meeting share of cost in the matcher's frame/bind allocation.

| Alternative | Description | Advantages | Disadvantages |
| --- | --- | --- | --- |
| A. Keep current matcher, do nothing | Status quo | Zero risk; matcher has already been hardened twice (HP-11/12/13 per the historical report) and a prior, now-secondary profile suggested low cost | Leaves any confirmed cost unaddressed |
| B. Reduce per-request frame/bind array allocation (e.g. reuse a request-scoped scratch structure sized to expected depth) | Fewer short-lived allocations per dynamic match | Directly targets the confirmed structural cost | Must preserve static fast path, dynamic precedence/backtracking, decoding, wildcard matching, null-prototype param safety, and concurrency safety — a **shared mutable scratch/pool is explicitly not approved without independent proof it is safe under concurrent requests** (risk of cross-request state leakage) |
| C. Segment-trie restructuring (e.g. the radix-tree alternative referenced in `docs/RFC/runtime-adapters/015-router-radix.md`) | Deeper architectural change to the matching algorithm itself | Could address allocation and lookup cost together if profiling shows the current approach is structurally, not just incidentally, expensive | Large migration effort; the historical report explicitly declined to green-light this on route-params grounds because it estimated the addressable cost as much smaller than the remaining gap — that estimate is inadmissible now (secondary/absent artifacts), so this alternative's justification must be re-earned from fresh evidence, not inherited from the old conclusion |

**This investigation does not select between A/B/C.** Any change to matching semantics or data
structures is RFC-gated (`architecture.instructions.md` — routing is one of the always-RFC-gated
areas per `tdd-workflow.md`).

## 4. Conditional alternatives — Hypothesis #3 (Body-parser/BodySource overhead)

**Trigger:** CPU/allocation profile of POST JSON (P1, conditional on P0) shows a reproducible,
threshold-meeting share of cost in buffering/parsing.

| Alternative | Description | Advantages | Disadvantages |
| --- | --- | --- | --- |
| A. Keep current buffering, do nothing | Status quo | Zero risk; current design already caches results and enforces limits correctly | Leaves any confirmed cost unaddressed |
| B. Single-chunk/empty-Buffer fast path | Skip `Buffer.concat` when the body arrives in exactly one `data` event (common for small JSON payloads in a low-latency benchmark) | Avoids an allocation+copy for the common small-body case | Must preserve content-length limit enforcement, abort/413 handling, and result caching for the multi-chunk and oversized cases — a fast path that skips a limit check would reopen a DoS vector; requires explicit multi-chunk/oversized/abort test coverage, not just a happy-path benchmark win |
| C. Streaming JSON parse (parse incrementally as chunks arrive, rather than buffer-then-parse) | Avoids materializing the full buffer before parsing begins | Could reduce peak memory and latency for large bodies | Large-payload benefit is irrelevant to this benchmark's small POST JSON payload; adds real complexity (partial-JSON error handling, cross-runtime streaming semantics) for a benefit not evidenced by current data |

**This investigation does not select between A/B/C.** Public API/behavior is not touched by
Alternative B if correctly scoped (it is purely an internal buffering optimization), but it still
requires the standard TDD/regression discipline (`tdd-workflow.md`) before any implementation.

## 5. Middleware / Context / Response candidates

No conditional alternatives are documented for these subsystems. Per this investigation's
constraints, they "need dedicated evidence" before even a conditional design sketch is appropriate
— unlike hypotheses #1–#3, which have a structural correlation to a benchmark signature to design
against, these three currently have none (see `04-root-cause-analysis.md` §4). If a future profile
implicates one of them, this report should be updated with the same conditional-alternative
structure used above — not a subsystem-specific ad hoc recommendation.

## 6. Serializer and static file serving

**Serializer:** no alternative is documented. `03-subsystem-analysis/serializer.md` (F-SERIALIZER-01)
gives the reasoning: the serialization primitive is shared across every compared framework, making
it a structurally unlikely source of a NextRush-specific gap, and current data does not justify
evaluating a replacement.

**Static file serving:** no alternative is documented. `03-subsystem-analysis/static-files.md`
(F-STATIC-01) requires a dedicated benchmark scenario to exist before any optimization work — this
is a prerequisite gap, not a solution-design gap.

## 7. Expected improvement — decision thresholds, not forecasts

Per this investigation's explicit instruction, expected improvement for every unrun experiment is
`Unknown`. The thresholds below are **go/no-go criteria for treating a hypothesis as confirmed
enough to proceed to implementation planning** — they are not promised or forecast gains:

- **Shared-path experiments (Hypothesis #1 — adapter):** reproducible ≥5% RPS improvement at both
  64c and 256c, with non-overlapping/noise-aware evidence (e.g. confidence intervals or repeated
  runs that don't overlap, not a single-run point estimate), lower bytes/request, and no p99 or
  semantic regression.
- **Route/body-specific experiments (Hypotheses #2, #3):** reproducible ≥3% scenario-specific RPS
  improvement (Route Params/Deep Route for #2; POST JSON for #3), same noise-aware and no-regression
  requirements.

Falling short of these thresholds is a valid, informative outcome (it demonstrates the hypothesis
was not the dominant contributor) — it is not a failed investigation.

## 8. Playbook cross-reference

This report satisfies Part 6 (§6.1 Define Optimization Goal, §6.2 Explore Alternatives, §6.3
Evaluate Trade-offs) of `docs/playbooks/performance-review-playbook.md` at the conditional-design
level the evidence gate permits. §6.4–§6.6 (impact estimation, risk assessment, implementation
strategy) are intentionally left as `Unknown`/deferred per §7 above and are picked up procedurally
in [`07-optimization-roadmap.md`](./07-optimization-roadmap.md).
