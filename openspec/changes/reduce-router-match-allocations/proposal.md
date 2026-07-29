## Why

The performance reconciliation report (`reports/investigations/performance-investigation-reconciliation.md`)
identified two structural allocation sources still open after three prior remediation changes
(`fix-benchmark-measurement-integrity`, `add-benchmark-cpu-allocation-profiling`,
`reduce-per-request-floor-cost` — all archived): a `RouteMatch` object plus its two binding
arrays allocated fresh on every single `matchRoute()` call (Rec 10 / F-02, ≈10-11 allocations per
request), and the general-path middleware dispatch (2+ middleware) still walking an index-based
recursive `dispatch()` rather than a compiled executor, with 3 of the 4 benchmark scenarios that
would measure it still missing (Rec 11 / F-11). These are the highest-priority OPEN findings that
do not require a dedicated CPU-pinned hardware session — Rec 3/4 (the pinned baseline itself) stay
explicitly out of scope for exactly that reason.

## What Changes

- Reduce `matchRoute()`'s per-call allocation count by removing the fresh `RouteMatch` object
  literal on the hot return paths and reusing the binding-name/binding-value arrays across calls
  (pooled per matcher instance, not per-request) where doing so is provably safe under the
  router's existing re-entrancy/no-`async`-in-hot-path invariants.
- Add the 3 missing benchmark scenarios Rec 11 named: `send(object)` dispatch, static-file
  serving, and a ≥1MB POST body — so the general middleware/dispatch path Rec 11 also names has
  real coverage before any dispatch-side change is measured.
- Investigate the general-path (2+ middleware) dispatch cost with a **non-codegen** approach only
  — the report's own "explicitly do not change" table forbids `new Function`-based chain
  compilation (breaks CSP/edge runtimes, defeats runtime independence, unauditable). If no
  non-codegen improvement clears its own allocation/behavior gate, this half of Rec 11 is
  recorded as investigated-and-not-viable rather than forced.
- Open the `server.timeout`/handler-race ADR that Rec 12 named as a pure decision task (no code
  change) — the coupling between the default request timeout and the Node adapter's
  race-vs-cancel mechanism has never had its rationale written down as a decision record.

## Capabilities

### New Capabilities

(none — every change below is an implementation-detail improvement to an existing capability's
allocation profile or benchmark coverage, not a new requirement)

### Modified Capabilities

- `router`: no requirement-level behavior changes — `matchRoute()`'s observable contract (same
  match results, same param values, same middleware/executor return shape) is unchanged; only its
  allocation profile changes. Included here only if the delta spec review in design.md concludes
  a requirement actually needs updating (e.g. a new "matcher instances may reuse internal scratch
  state across calls" invariant worth stating); otherwise no spec delta is produced for this
  capability and design.md will say so explicitly.
- `performance-gate`: the 3 new benchmark scenarios extend this capability's existing "framework
  overhead is measured across representative scenarios" contract — a delta spec adds the 3
  scenarios to the set this capability's requirements already reference.

## Impact

- **Code**: `packages/router/src/match-route.ts`, `packages/router/src/matching.ts` (the
  `WalkFrame` binding arrays), possibly `packages/router/src/router.ts` if pooling needs to live
  on a matcher/router instance rather than as a module-level singleton (module-level pooling would
  break under concurrent requests sharing one event loop tick — a design.md decision, not decided
  here).
- **Benchmark suite**: `apps/benchmark/config/scenarios.js` (3 new scenario entries),
  `apps/benchmark/servers/*.js` (implement the 3 new endpoints per server, matching the existing
  `identicalWork`/byte-parity discipline the other 10 scenarios already follow).
- **Docs**: a new ADR under `docs/adr/` for the `server.timeout` decision (Rec 12) — no RFC
  needed, this is a decision-record for an existing behavior, not a new architecture.
- **Out of scope, explicitly**: Rec 3/4 (the CPU-pinned `--profile full` baseline capture and the
  CPU-pinned three-arm timeout A/B) — both remain blocked on a dedicated, human-scheduled
  multi-hour hardware session, not on code. `new Function`-based middleware-chain codegen is
  permanently out of scope per the reconciliation report's own "do not touch" table, not merely
  deferred.
