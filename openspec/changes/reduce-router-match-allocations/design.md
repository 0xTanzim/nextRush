## Context

Three prior remediation changes (`fix-benchmark-measurement-integrity`,
`add-benchmark-cpu-allocation-profiling`, `reduce-per-request-floor-cost`, all archived) closed 8
of the reconciliation report's 12 recommendations. Two of the four remaining ones (Rec 3/4) are
blocked on a dedicated CPU-pinned hardware session and are explicitly out of scope here. This
change picks up the two that are code-actionable today: Rec 10 (F-02, param-path allocation) and
the non-codegen half of Rec 11 (F-11, missing benchmark scenarios), plus Rec 12 (an ADR, no code).

Verified directly against source before scoping (not from the report's own tables, which have a
real internal inconsistency — its top Progress Tracker and its §14 recommendations table disagree
on which recs are resolved):

- `openspec/specs/router/spec.md`'s existing "A matched request allocates a single `RouteMatch`
  object" requirement is **already satisfied** — `matchRoute()` returns exactly one `RouteMatch`
  object literal per call. This is a ratified floor, not a regression to fix. F-02's real,
  still-open allocation source is *inside* the tree walk: `matchNodeIndexed()` (confirmed via the
  code graph: `alloc_in_loop: 6`) builds an explicit `WalkFrame[]` stack fresh on every call, and
  `matchRoute()` allocates fresh `bindNames`/`bindValues` arrays (`const bindNames: string[] = []`)
  on every call too. These are the ≈10-11 allocations F-02 actually names.
- `canonicalizePath()`'s `{rejected, path}` result-object shape (also cited in F-02's own
  diagram) is confirmed governed by the existing "A single canonicalization function owns
  request-path normalization" requirement and RFC-029 (deferred, not shipped) — reshaping it is
  explicitly out of scope for this change, same conclusion the prior `reduce-per-request-floor-cost`
  change already reached.
- `compose()` already has 0-length/1-length fast paths and `Application.callback()` calls it once,
  not per-request — the "chain built during requests" framing of F-11 no longer describes current
  behavior. What's still open is the **general path** (2+ middleware) still walking an index-based
  recursive `dispatch()`, and 3 of the 4 benchmark scenarios Rec 11 named to measure that path
  (`send(object)`, static file, ≥1MB POST) are genuinely missing from `apps/benchmark/config/scenarios.js`
  — only the `middleware-stack` scenario (5 layers) exists.

## Goals / Non-Goals

**Goals:**
- Reduce `matchNodeIndexed()`'s per-call allocation count for the parameterized-route match path
  without changing any observable match result, param value, or `RouteMatch` shape.
- Add the 3 missing benchmark scenarios so the general dispatch path has real, byte-parity-checked
  coverage across all compared frameworks before any dispatch-side change is attempted.
- Investigate whether a non-codegen improvement to the general-path (2+ middleware) dispatch cost
  exists; if none clears the bar, record that conclusion rather than force a change.
- Write the `server.timeout`/handler-race ADR Rec 12 named as a pure decision task.

**Non-Goals:**
- Rec 3/4 (CPU-pinned baseline capture, three-arm A/B) — explicitly deferred, needs a
  human-scheduled hardware session, not code.
- Any `new Function`-based middleware-chain codegen — permanently forbidden by the reconciliation
  report's own "explicitly do not change" table (breaks CSP-restricted/edge runtimes, defeats
  runtime independence, unauditable). If the general-path investigation concludes codegen is the
  only remaining lever, the conclusion is "not viable under this constraint," not an exception.
- Reshaping `canonicalizePath()`'s `{rejected, path}` return shape — RFC-029-gated, deferred.
- Reducing the `RouteMatch` object itself below one allocation — the existing router spec
  requirement ratifies exactly one allocation as the contract; going below that (e.g. output
  parameters, a shared mutable result) would violate an existing, security-adjacent requirement
  (the same object also carries `middleware`, whose single-attachment guarantee the requirement
  explicitly protects) and is not attempted here.

## Decisions

**D1 — Pool `WalkFrame[]` and the binding arrays per matcher instance, not per-request or
module-level.** A module-level singleton pool would corrupt state across concurrent requests
sharing one event-loop tick (two in-flight `matchRoute()` calls on the same router before either
resolves — always true here since a route match itself is synchronous end-to-end today, but this
is exactly the invariant the pool must not silently assume forever). Per-matcher-instance pooling
(one reusable scratch buffer living on the `Router`/matcher object, reset at the start of each
call rather than reallocated) is safe under the router's current synchronous-walk invariant and
gives the same reuse benefit without introducing shared cross-request state. Alternative
considered: a `WeakMap`-keyed per-request pool — rejected, adds a lookup cost on every call that
likely exceeds the allocation it saves, and the router has no natural per-request handle to key
on without threading one through every call site.

**D2 — Depth-bounded frame reuse, not a resizable pool.** The trie walk is already
iterative-not-recursive specifically as a recursion-depth DoS guard (an existing, explicit "do not
touch" item in the reconciliation report). Any reuse mechanism preserves that guard: a fixed-size
reusable array sized to a documented maximum practical route depth (checked against the router's
existing max-depth handling, not invented here), with the existing depth-guard logic unchanged —
never a mechanism that grows unbounded per request, which would just relocate the same DoS surface
into the pool's own growth.

**D3 — The 3 new benchmark scenarios follow the existing 10 scenarios' conventions exactly.**
`identicalWork: true` where every framework does byte-identical work (the static-file and
≥1MB-POST scenarios), matching the existing `deep-route`/`large-json` pattern; `send(object)` is
its own scenario per Rec 11's naming (not folded into an existing one) because it exercises a
distinct dispatch code path (F-09's finding) that the existing 10 scenarios don't touch. No
existing scenario is modified.

**D4 — The general-path dispatch investigation happens after the benchmark scenarios ship, not
before.** Measuring a dispatch change against scenarios that don't exist yet would repeat exactly
the "measured against a broken instrument" problem the reconciliation report's Week 1 already
fixed for the timing harness — the same discipline applies here: instrument first, then measure.

## Risks / Trade-offs

- **[Risk]** A pooled `WalkFrame[]`/binding-array scratch buffer sized wrong for an unusually deep
  route tree could either under-allocate (correctness bug) or over-allocate (memory waste, no
  perf benefit) → **Mitigation**: size the reusable buffer from the router's own existing
  registered-route depth at build time (known at registration, not guessed), with a documented
  fallback (grow-once, not grow-per-request) if a runtime path genuinely exceeds it.
- **[Risk]** Reuse could silently reintroduce cross-request state bleed if a future change makes
  any part of the walk asynchronous → **Mitigation**: an explicit synchronous-walk invariant
  comment on the pooled structure (per this repo's comment-discipline convention — contract
  statement, not a reasoning trace) plus a test that would fail if the walk ever awaited mid-frame.
- **[Trade-off]** Not pursuing codegen for the general dispatch path leaves 2+-middleware
  applications without the same fast-path treatment 0/1-middleware apps already have →
  accepted, since the report's own constraint (CSP/edge/auditability) is a durable architectural
  boundary (AGENTS.md §7's runtime-independence mandate), not a preference to revisit lightly.

## Migration Plan

No public API changes, no migration path needed — every change here is internal to `matchRoute`'s
implementation (same exported signature, same `RouteMatch` shape) or purely additive (3 new
benchmark scenarios, 1 new ADR). Rollback is a plain revert if the allocation-gate CI check
(already wired by `fix-benchmark-measurement-integrity`) regresses.

## Open Questions

- What is the actual maximum practical route-tree depth to size the reusable frame buffer against?
  Needs a query against the router's own registration-time depth tracking before task
  implementation, not a guessed constant.
- Does the general-path dispatch investigation (Goal 3) surface anything at all within the
  non-codegen constraint, or does it conclude "no viable non-codegen improvement exists"? Both are
  acceptable outcomes for this change — tasks.md scopes this as an investigation task with an
  explicit written conclusion either way, not a task that must ship a code change to be "done."
