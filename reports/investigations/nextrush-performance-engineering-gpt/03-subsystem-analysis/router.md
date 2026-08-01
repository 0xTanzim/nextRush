# Subsystem Analysis — Router

**Playbook phase:** Part 4 §4.2, §4.12 (Router). **Status: Structural analysis Completed;
performance-contribution analysis Blocked** (see [`../02-runtime-profiling.md`](../02-runtime-profiling.md)).

Related canonical reports: [`../01-benchmark-analysis.md`](../01-benchmark-analysis.md) (Route
Params −28.9% at 256c, Deep Route −22.4% at 256c) · [`../04-root-cause-analysis.md`](../04-root-cause-analysis.md)
(Hypothesis priority 2) · [`../05-solution-engineering.md`](../05-solution-engineering.md)
(conditional router experiment).

## Purpose

The router resolves an incoming request path to a registered handler and extracts any path
parameters. It participates in every request.

## Present design

**Static routes (Confirmed — structure):** matched through an O(1) map lookup, sharing a single
`EMPTY_PARAMS` value across requests. This path performs no per-request parameter-related
allocation.

**Dynamic routes (Confirmed — structure):** the matcher canonicalizes the path, then walks the
segment trie iteratively (not recursively, avoiding stack-depth risk on adversarial paths). Per
request, it allocates:
- `bindNames` / `bindValues` working arrays.
- An initial `WalkFrame` array, plus additional frame objects created while backtracking through
  ambiguous segments (e.g. a static segment and a dynamic segment both matching at the same
  depth).
- Slice/decode operations per matched segment.
- A single null-prototype params object materialized once matching succeeds.

## Benefits of the present design

- The static fast path is genuinely allocation-free per request (shared `EMPTY_PARAMS`), which is
  the common case for many real applications' hottest routes.
- The iterative (non-recursive) walk avoids a recursion-depth DoS vector on deeply nested or
  adversarial paths — a documented security property, not an accident.
- Null-prototype params defend against prototype-pollution via crafted parameter names — a
  documented security requirement (`project-rules.instructions.md` §2, §4).
- Backtracking preserves route-precedence semantics (static beats dynamic beats wildcard at the
  same depth) rather than requiring registration-order-sensitive workarounds.

## Structural costs

The dynamic-match path allocates multiple short-lived objects (frame array, frame objects,
bind-name/value arrays) per request, in contrast to the static path's zero allocation. This is a
structural fact about the code, independent of whether it is measurable at benchmark scale.

## Evidence status

| Claim | Status |
| --- | --- |
| Static route map is O(1) with shared `EMPTY_PARAMS` | **Confirmed** (source structure) |
| Dynamic match allocates frame/bind arrays during backtracking | **Confirmed** (source structure) |
| This allocation is a *meaningful* contributor to the Route Params / Deep Route RPS gap | **Hypothesis** — no CPU or allocation profile exists against current code (gate: [`../02-runtime-profiling.md`](../02-runtime-profiling.md)) |
| A prior report's claim that the matcher is ≈4% CPU / ≈0.34% sampled heap | **Not adopted** — computed from now-absent raw artifacts against unpinned, possibly-stale source (see [`../02-runtime-profiling.md`](../02-runtime-profiling.md) §3) |

## Finding

### F-ROUTER-01 — Dynamic route matching allocates per-request frame/bind state; contribution to the Route Params / Deep Route gap is unmeasured

- **Status/confidence:** Structure Confirmed; performance impact Hypothesis.
- **Priority:** P1 (second-ranked hypothesis in [`../04-root-cause-analysis.md`](../04-root-cause-analysis.md)).
- **Current situation/evidence:** The dynamic matcher allocates `bindNames`/`bindValues`, a
  `WalkFrame` array, and additional frame objects during backtracking, then materializes params
  once (source structure, Confirmed). Route Params shows the largest like-for-like gap versus raw
  Node.js at 256c (−28.9%) and 64c (−29.5%); Deep Route shows −22.4% at 256c (`../01-benchmark-analysis.md`
  §3–§4).
- **Present-design benefits:** iterative non-recursive walk (DoS-safe), correct precedence
  semantics, null-prototype param safety (see above).
- **Root cause:** Unknown. The correlation between "route has dynamic segments" and "route shows
  the largest gap" is suggestive but not sufficient — Query and POST JSON also show large gaps
  without the same matcher path being obviously implicated, and no profile isolates matcher CPU/
  allocation share under current code.
- **Runtime/performance impact:** Unknown; unmeasured against current source.
- **Recommendation:** Do not modify the matcher. Capture CPU + allocation profiles for the Route
  Params and Deep Route scenarios against the pinned commit (see
  [`../07-optimization-roadmap.md`](../07-optimization-roadmap.md) P1) before considering any
  change.
- **Alternatives:** (evaluated only if profiling isolates meaningful cost) reducing per-request
  frame/bind allocation while preserving the static fast path, dynamic precedence, decoding,
  wildcard/backtracking, null-prototype params, and concurrency safety; a shared mutable
  scratch/pool structure is explicitly *not* an approved alternative without independent proof it
  is safe under concurrent requests (see [`../05-solution-engineering.md`](../05-solution-engineering.md)).
- **Trade-offs:** Not assessed — no approved solution exists yet at this evidence level.
- **Risks:** A premature allocation-reduction change risks breaking precedence, decoding, or
  security properties for an unproven gain; the last thing rewritten here (per the historical
  report, its own account of HP-11/12/13) was already changed twice on structural reasoning alone.
- **Expected improvement:** Unknown (no experiment has run).
- **Migration difficulty:** Not assessed — no change proposed.
- **Validation:** Full matrix in [`../06-validation-regression.md`](../06-validation-regression.md);
  route-specific: differential matcher tests, precedence/backtracking/wildcard test suite,
  null-prototype param safety test, plus the ≥3% scenario-specific RPS threshold at 64c/256c.

## Edge cases (playbook §4.9)

Deep routing and route-parameter extraction are both represented in the current benchmark (Deep
Route, Route Params scenarios). Wildcard routes, ambiguous-precedence backtracking depth, and very
long dynamic segments are **not** separately benchmarked — their performance characteristics are
Unknown.
