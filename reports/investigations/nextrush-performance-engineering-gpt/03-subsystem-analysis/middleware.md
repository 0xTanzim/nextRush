# Subsystem Analysis — Middleware

**Playbook phase:** Part 4 §4.13 (Middleware). **Status: Structural analysis Completed;
performance-contribution analysis Blocked** (see [`../02-runtime-profiling.md`](../02-runtime-profiling.md)).

Related canonical reports: [`../01-benchmark-analysis.md`](../01-benchmark-analysis.md)
(`middleware-stack` is idiomatic, not like-for-like) · [`../04-root-cause-analysis.md`](../04-root-cause-analysis.md)
(middleware contribution: Unknown) · [`../05-solution-engineering.md`](../05-solution-engineering.md).

## Purpose

`Application.callback` composes registered middleware into a single dispatch function invoked per
request; `compose` chains middleware in Koa-style `ctx.next()` order.

## Present design

**Confirmed (structure):** `Application.callback` composes registered middleware **once** (at
setup/boot time, not per request), then each request awaits the composed chain and handles errors
at the top level. `compose` itself:
- Takes a **registration snapshot** at composition time.
- Has explicit **zero-middleware and one-middleware fast paths** — the one-middleware path
  allocates a `next` closure and dispatches directly, without the general recursive dispatch
  machinery.
- The **general path** recursively dispatches, creating a `next` closure and layer-tracking state
  per call, while preserving two specific semantic guarantees: calling `next()` more than once is
  detectable/rejectable ("double-next"), and a middleware that throws synchronously is handled the
  same way as one that rejects asynchronously ("sync-throw" semantics).

## Benefits of the present design

- Composing once at boot rather than per-request avoids re-building the middleware chain on every
  request — a clear, deliberate cost amortization.
- Fast paths for 0 and 1 middleware avoid the general recursive machinery for the common case of a
  small middleware stack (which most benchmark scenarios in `apps/benchmark` exercise, since only
  `middleware-stack` deliberately stacks middleware).
- Preserving double-next detection and sync-throw semantics are correctness/DX guarantees
  (`AGENTS.md` §12 — errors are part of the API) that any allocation-reduction change must not
  regress.

## Structural costs

The general recursive dispatch path allocates a `next` closure and layer-tracking state per
middleware per request — a structural cost that scales with middleware-stack depth. Every
like-for-like benchmark scenario in this run other than `middleware-stack` (idiomatic, excluded
from cross-framework causal conclusions per `../01-benchmark-analysis.md` §2) uses the framework's
default/minimal middleware setup, so the general recursive path's per-layer cost is not isolated by
any scenario in the current benchmark data at more than one layer.

## Evidence status

| Claim | Status |
| --- | --- |
| `callback` composes once, not per request | **Confirmed** (source structure) |
| `compose` has explicit 0/1 fast paths and a general recursive path | **Confirmed** (source structure) |
| Double-next and sync-throw semantics are preserved by design | **Confirmed** (source structure) |
| Middleware dispatch overhead contributes to the Hello/Empty/JSON gaps | **Unknown** — no like-for-like scenario isolates middleware-chain depth as a variable, and no profile exists |

## Finding

### F-MIDDLEWARE-01 — Middleware dispatch contribution to the observed RPS gap is unmeasured and not isolated by any current benchmark scenario

- **Status/confidence:** Structure Confirmed; performance impact Unknown (not even elevated to
  Hypothesis — see rationale below).
- **Priority:** Not ranked in the top 3 hypotheses (see [`../04-root-cause-analysis.md`](../04-root-cause-analysis.md));
  documented here so the subsystem is not silently skipped.
- **Current situation/evidence:** All like-for-like scenarios use minimal middleware (structure,
  Confirmed); the one scenario that stacks middleware (`middleware-stack`) is explicitly idiomatic
  and excluded from cross-framework causal conclusions (`../01-benchmark-analysis.md` §2). There is
  therefore no clean benchmark signal to reason from for this subsystem specifically, unlike the
  adapter, router, or body-parser, which each have a scenario or structural correlation to point
  at.
- **Present-design benefits:** see above (amortized composition, fast paths, semantic guarantees).
- **Root cause:** Unknown — no candidate has been ranked because no evidence, benchmark or
  structural correlation, points here more than to the shared per-request overhead already
  attributed to the adapter/router hypotheses.
- **Runtime/performance impact:** Unknown.
- **Recommendation:** No action. If future profiling of the shared per-request path (P0 in
  [`../07-optimization-roadmap.md`](../07-optimization-roadmap.md)) surfaces middleware dispatch as
  a meaningful CPU/allocation contributor, open a dedicated middleware-depth benchmark scenario
  before any source change (Middleware/context/response candidates need dedicated evidence, per
  this investigation's constraints).
- **Alternatives:** Not evaluated — no problem statement exists yet.
- **Trade-offs:** Not applicable.
- **Risks:** None from inaction; the risk of premature action is optimizing a subsystem with no
  measured cost while leaving the actually-dominant subsystem un-investigated.
- **Expected improvement:** Unknown.
- **Migration difficulty:** Not applicable — no change proposed.
- **Validation:** Not applicable until a profile or dedicated scenario produces a finding to
  validate.

## Edge cases (playbook §4.9)

Deep middleware stacks, middleware that throws synchronously vs. asynchronously, and middleware
ordering under dynamic registration are structurally handled (per the semantics above) but have no
dedicated performance benchmark in the current suite. Their performance characteristics under load
are Unknown.
