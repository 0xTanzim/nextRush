# Subsystem Analysis — Context

**Playbook phase:** Part 4 §4.14 (Context). **Status: Structural analysis Completed;
performance-contribution analysis Blocked** (see [`../02-runtime-profiling.md`](../02-runtime-profiling.md)).

Related canonical reports: [`../01-benchmark-analysis.md`](../01-benchmark-analysis.md) (Hello,
Empty scenarios — minimal-payload, context-dominated relative cost) · [`../04-root-cause-analysis.md`](../04-root-cause-analysis.md).

## Purpose

`NodeContext` wraps the raw Node.js `req`/`res` into the framework's Context API (`ctx`), which is
constructed once per request and is the sole surface application/middleware code touches
(`architecture.instructions.md` — "Request/response goes through the Context API — never raw
`req`/`res`").

## Present design

**Confirmed (structure):**
- Construction uppercases the HTTP method.
- Scans the URL string for a `?` to detect a query string.
- Uses a **shared `EMPTY_QUERY`** value when no query string is present (no allocation).
- **Parses the query string eagerly only when one is present** (not lazily on first access, and
  not unconditionally).
- Stores headers and resolves the client IP.
- Default (no-trust) IP resolution can return the direct socket IP quickly without walking
  proxy-header chains — but this investigation does not exaggerate that path's cost or claim it is
  free; it is simply not the slow, multi-header-parsing path that a trust-proxy configuration would
  exercise.

`parseQueryString` (used when a query string is present) uses a null-prototype result object and a
single-pass `indexOf`/`slice`/decode loop, explicitly avoiding a `split()`-produced intermediate
array — a documented allocation-avoidance choice, bounded by size/count limits (input-validation
discipline per `engineering-standards.md`).

## Benefits of the present design

- Shared `EMPTY_QUERY` avoids allocation for the common case of no query string (Hello, Empty,
  JSON scenarios all have no query string).
- Eager-only-when-present query parsing avoids parsing work entirely when there is nothing to
  parse, rather than always allocating a parser closure for possible lazy invocation.
- Single-pass `indexOf`/`slice`/decode avoids the extra array allocation a naive `split('&')`
  approach would produce.
- Null-prototype result defends against prototype pollution via crafted query keys — a security
  requirement, not an optional optimization (`project-rules.instructions.md` §2).

## Structural costs

Every request constructs a `NodeContext` (method uppercase, URL scan, header storage, IP
resolution) regardless of scenario — this is fixed, unconditional per-request work, structurally
consistent with the "fixed per-request overhead" pattern flagged in
[`../01-benchmark-analysis.md`](../01-benchmark-analysis.md) §4 (Hello/Empty showing the largest
relative gaps).

## Evidence status

| Claim | Status |
| --- | --- |
| Context construction is unconditional per-request work (method, URL scan, headers, IP) | **Confirmed** (source structure) |
| `EMPTY_QUERY` sharing and conditional query parsing avoid allocation on the no-query path | **Confirmed** (source structure) |
| `parseQueryString` avoids `split()`-array allocation via single-pass scan | **Confirmed** (source structure) |
| Context construction is a *meaningful* contributor to the Hello/Empty gap specifically (vs. adapter/router/body work also present in the same request) | **Unknown** — no profile isolates context-construction cost from the rest of the per-request path |

## Finding

### F-CONTEXT-01 — Context construction is fixed, unconditional per-request work; its share of the Hello/Empty gap is unmeasured

- **Status/confidence:** Structure Confirmed; performance impact Unknown.
- **Priority:** Not one of the top 3 ranked hypotheses in [`../04-root-cause-analysis.md`](../04-root-cause-analysis.md) — grouped there under "middleware/context/response contributions are Unknown."
- **Current situation/evidence:** Context construction happens on every request unconditionally
  (structure, Confirmed). Hello and Empty — the two scenarios with the smallest response payload —
  show the largest relative gaps versus raw Node (−18.1%, −25.1% at 256c), consistent with *some*
  fixed per-request cost mattering more when the rest of the request is cheap, but this pattern is
  shared across the adapter, router (static path is free but still runs), context, and response
  write — context construction cannot be isolated from those as the specific cause with current
  evidence.
- **Present-design benefits:** shared empty-query object, conditional query parsing, allocation-
  conscious query-string scan, null-prototype safety (see above).
- **Root cause:** Unknown.
- **Runtime/performance impact:** Unknown.
- **Recommendation:** No action. Context/response candidates explicitly need dedicated profiling
  evidence before any change is proposed, per this investigation's constraints — a CPU profile of
  the Hello scenario (P0 in [`../07-optimization-roadmap.md`](./../07-optimization-roadmap.md))
  would show whether context construction is a visible frame at all.
- **Alternatives:** Not evaluated — no problem statement exists yet at the profiling level.
- **Trade-offs:** Not applicable.
- **Risks:** None from inaction.
- **Expected improvement:** Unknown.
- **Migration difficulty:** Not applicable.
- **Validation:** Not applicable until a profile produces a finding to validate; full matrix at
  [`../06-validation-regression.md`](../06-validation-regression.md) if one does.

## Edge cases (playbook §4.9)

Requests with unusually large header sets, requests with a trust-proxy configuration engaging
multi-header IP resolution, and requests with very long query strings are not separately
benchmarked. Their context-construction cost under those conditions is Unknown.
