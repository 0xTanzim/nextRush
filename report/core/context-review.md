# NextRush `NodeContext` — Request-Lifecycle & V8 Overhead Audit

> **Type:** read-only V8/performance audit. No `packages/**` code changed.
> **Scope:** `NodeContext` construction, object layout, hidden-class stability, allocation, and its
> dispatch/middleware interaction — *only*. Routing was cleared separately
> (`report/router-engine-review.md`); not re-reviewed here.
> **Trigger:** the router review's R-05 pointed here — `NodeContext` (0.79% CPU) + `composedSingle`
> (0.50%) were the only NextRush-specific CPU terms outside shared HTTP work.
> **Evidence basis:** the shipped source, the **compiled** `dist/index.js` (for field-layout truth,
> not TS-source intuition), a `--trace-deopt` run under live load, the `bench:alloc:context`
> micro-bench, and the route-params CPU profile (`report/route-params-profile.md`). Every number
> below was read from a tool, not asserted.

---

## Executive Summary

**`NodeContext` is not a meaningful, fixable source of request overhead.** It is already the product
of ~8 shipped micro-optimizations (HP-1/2/5/7/14/15, NF-2), and every V8 concern the audit brief
raises resolves to "already optimal" or "inherent and correctly kept":

- **Construction allocates one object — the instance itself.** For a GET request everything else is
  shared or lazy: `runtime` is a cached singleton, `bodySource` is a shared singleton for bodyless
  methods, `query`/`params` are shared frozen empties, and `_raw`/`_state`/`_abortController` are
  lazy. Measured per-request work: **8.05 B/op** net-retained vs 56 B/op pre-trim (`bench:alloc:context`, 85.6% below legacy, cv 0).
- **The object shape is stable and hidden classes are preserved — proven at runtime.** A
  `--trace-deopt` run under a route-params load produced **13 total deopts, zero of them on
  `NodeContext`, `matchRoute`, `matchNodeIndexed`, `composedSingle`, or `getClientIp`** — the 13 are
  ordinary boot/warmup churn in unrelated code. The hot path stays TurboFan-optimized.
- **The 1.3% CPU (context 0.79% + dispatch 0.50%) sits on a 24%-idle, I/O-bound path.** Trimming it
  does not convert to RPS, for the same reason the router's 4% didn't — the server is not CPU-bound
  at this load. This is the same wall the router review and the concurrency re-test both hit.

**Recommendation: no code change.** The one optimization a naive audit would propose — pooling/reusing
the context instance — is a **rejected anti-pattern** here (Finding C-04), and the honest next lever
(if the ~7% route-params gap is even real on clean hardware) is shared HTTP work, not context.

---

## What was verified (non-findings, with evidence)

### V-01 — Construction cost is minimal; one allocation per request

- **File / Function:** `packages/adapters/node/src/context.ts` / `NodeContext` constructor (`:104`).
- **Evidence:** the constructor assigns refs and shared/lazy values only. `this.runtime = getRuntime()`
  — `getRuntime()` is `cachedRuntime ??= detectRuntime()` (`runtime/src/detection.ts:132`), a cached
  read. `this.query = EMPTY_QUERY` and `this.params = EMPTY_PARAMS` are shared frozen null-proto
  singletons. `this.bodySource = METHODS_WITHOUT_BODY.has(method) ? createEmptyBodySource() : new NodeBodySource(req)`
  → for GET, `createEmptyBodySource()` returns a **singleton** (confirmed by the body-source test
  "should return singleton"). `this.method = req.method?.toUpperCase()` is zero-alloc for already-
  uppercase ASCII (V8 returns the same string — established as a non-finding in prior router work).
- **Allocation impact:** the `NodeContext` instance itself + (POST only) one `NodeBodySource`. For
  the GET route-params path: **one object**. `bench:alloc:context` = 8.05 B/op net-retained.
- **CPU impact:** 0.79% (route-params CPU profile).
- **V8 impact:** none adverse — see V-02.
- **Verdict:** optimal for a class-based context. No change.

### V-02 — Object shape is stable; hidden classes are preserved (runtime-confirmed)

- **File / Function:** compiled `packages/adapters/node/dist/index.js` `NodeContext` class body + ctor.
- **Evidence (static):** the compiled class declares **every** field in the class body —
  `runtime;`, `bodySource;`, `body = void 0`, `params = EMPTY_PARAMS`, `status = 200`, `_req;`,
  `_res;`, `_raw;`, `_state;`, `_next = null`, `_responded = false`, `_abortController;` — so under
  native ES2022 field semantics (esbuild target node20) **every slot is defined at construction**.
  The lazy getters (`this._raw ??= …`, `this._state ??= {}`, `this._abortController = …`) therefore
  perform a **value transition on an existing slot (undefined → object)**, not a property addition —
  no hidden-class transition. The constructor's one branch (`if (questionIndex !== -1)`) assigns the
  **same two properties** (`path`, `query`) in both arms, so there is no conditional property
  addition. No `delete` anywhere in the context (the old `Reflect.deleteProperty` was in the router,
  already removed by HP-11).
- **Evidence (runtime):** `node --trace-deopt` under an 8s route-params `wrk` load → **13 total
  deopt events, zero touching `NodeContext`/`matchRoute`/`matchNodeIndexed`/`composedSingle`/
  `getClientIp`.** The hot path is optimized and stays optimized.
- **V8 impact:** monomorphic property access on a single stable hidden class; `ctx.params.id` access
  sites see one shape. `params` is either the frozen shared `EMPTY_PARAMS` or a fresh null-proto
  object (both objects, both null-proto — HP-13's pollution guard), so downstream `ctx.params`
  access stays monomorphic.
- **Verdict:** hidden classes are preserved. This is the audit's central V8 question and the answer
  is a clean pass. No change.

### V-03 — `ctx.state` / `ctx.raw` / `ctx.signal` laziness does not destabilize the shape

- **Evidence:** all three are pre-declared slots (V-02) populated via `??=` on first access. A
  request that reads `ctx.state` and one that doesn't share the same hidden class — only the slot's
  *value* differs (undefined vs `{}`). The setter `set state(v){ this._state = v }` writes the same
  slot. Prefix-mount symbol-key writes go through the getter (materialize then write).
- **Verdict:** correct lazy design; no shape divergence between requests. No change.

## Findings

### C-01 — `composedSingle` allocates one closure per request — **P3 (inherent, keep)**

- **File / Function:** `packages/core/src/middleware.ts` / `composedSingle` (`:128`).
- **Evidence:** per request it creates a `nextFn` closure capturing per-invocation `called` + `ctx`,
  wires it via `ctx.setNext(nextFn)`, and returns `Promise.resolve(only(ctx, nextFn))`. The
  `Promise.resolve` is near-free here — `only` is the de-asynced router middleware (NF-1) that already
  returns a native promise, and `Promise.resolve(p) === p`. So the per-request cost is **one closure**.
- **CPU impact:** 0.50% (route-params profile).
- **Allocation impact:** one closure per request (the `nextFn`); escape-analysis-relevant but it
  escapes (stored via `setNext`), so it is a real young-gen allocation.
- **Root cause:** the `nextFn` closure carries per-invocation state (`called`) for the "next() called
  multiple times" guard, and the dev-only double-response warning.
- **Proposed optimization:** none recommended. Removing the closure means dropping the multiple-`next()`
  detection — a real correctness/DX guarantee. Per the brief ("never sacrifice API clarity for tiny
  gains") and `AGENTS.md` §11, a ~0.5%-CPU closure on a 24%-idle path does not justify weakening a
  correctness guard.
- **Expected benefit:** ~0 RPS (see C-02). **Verdict: keep as an inherent, correct cost.**
- **Validation strategy:** if ever attempted, a route-params A/B at the deferred clean-host `--profile
  full`; revert if RPS does not move beyond stddev (it will not, per C-02).

### C-02 — Context+dispatch overhead is real but not RPS-relevant on this workload — **P2 (meta)**

- **Evidence:** context 0.79% + dispatch 0.50% = **1.3% of CPU**, on a route-params request that is
  **~24% idle** (I/O-bound; dominated by `writev` ~33% + JSON ~4.8%, both shared with every
  framework). The concurrency re-test (folded into `report/router-engine-review.md`'s Post-Review
  Update) confirmed the
  server could not be driven CPU-bound at c64/c128/c256 on this hardware — so no tested regime exists
  where shaving 1.3% of CPU raises RPS.
- **Root cause:** the ~7% route-params gap vs Fastify is an aggregate of many small shared + framework
  costs on an I/O-bound path, not a single hot spot in context or dispatch.
- **Proposed optimization:** measurement, not code — the deferred clean-host 5-run CPU-pinned
  `--profile full` A/B, to learn whether the ~7% is even real off a shared dev box. If it is, the
  target is the shared HTTP/response path, not context.
- **Expected benefit:** unknown until measured; likely near noise. **Verdict: do not optimize context
  for RPS.**
- **Validation strategy:** clean-host `--profile full` A/B (the one deferred global gate).

### C-04 — Context instance pooling / reuse — **REJECTED (overengineering trap)**

- **Candidate:** pool and reuse `NodeContext` instances across requests to avoid the one per-request
  allocation (V-01).
- **Why it is rejected, with reasoning:**
  1. **Correctness hazard.** The context legitimately **escapes** — it is passed to async handlers
     that may retain it past the response (logging, background work, `ctx.signal` listeners). Pooling
     a genuinely-escaping, async-retained object is a use-after-free class of bug, exactly the kind of
     hidden coupling `engineering-standards.md` forbids.
  2. **No measurable upside.** The instance is a short-lived young-generation object; V8's generational
     GC collects it cheaply, and GC is only ~1% of CPU in the profile (`report/route-params-profile.md`
     D3). Pooling trades a ~free scavenge for permanent reset-logic complexity and retention risk.
  3. **Escape analysis can't help and pooling can't either.** The object escapes, so it must be heap-
     allocated regardless; a pool doesn't remove the allocation cost so much as move it to reset cost +
     a liveness-tracking burden.
- **Verdict:** do not implement. Documented here so a future audit does not re-propose it without
  confronting these three reasons.
- **Validation strategy:** n/a — rejected on design grounds before measurement, per "identify
  overengineering" (`architecture-review.md`).

## V8 Analysis (the brief's core questions, answered)

- **Is Context construction expensive?** No — one object, cached runtime, shared/lazy everything;
  8.05 B/op net-retained.
- **Is object shape stable / are hidden classes preserved?** Yes — all slots defined at construction
  (compiled-output evidence), deterministic constructor, one branch assigning identical properties;
  **zero hot-path deopts under live load** (`--trace-deopt`).
- **Does Context escape unnecessarily?** It escapes **necessarily** (handed to the handler) — that is
  by design, not waste, and is why pooling is rejected (C-04).
- **Unnecessary allocations?** None beyond the instance (inherent) and `composedSingle`'s next-guard
  closure (inherent, C-01).
- **Does middleware mutate Context excessively?** No — middleware writes `ctx.status`, `ctx.state`
  (lazy slot), and response headers (on the `res` object). All are value writes on existing slots or
  the response; none churn the context's hidden class.
- **Megamorphic call sites?** None found — `ctx.params.id` and friends see one stable shape.

## Memory & Allocation Review

- **GET route-params:** 1 allocation (the `NodeContext` instance) + 1 closure (`composedSingle`'s
  `nextFn`). Both young-gen, both short-lived, GC ~1% CPU.
- **POST:** + 1 `NodeBodySource` (unavoidable — it wraps the request stream).
- **Micro-bench:** `bench:alloc:context` = 8.05 B/op net-retained (85.6% below the 56 B/op pre-trim
  baseline), cv 0 — deterministic.
- **Per the brief's rule** ("reject microbench-only wins"): there is no candidate optimization whose
  microbench win fails to show in HTTP — because there is no candidate optimization at all. Context is
  already lean; the audit's outcome is *confirmation + one rejection*, not a change to validate.

## Final Recommendations

1. **Make no change to `NodeContext` for performance.** It is construction-lean, shape-stable,
   deopt-free on the hot path, and its residual cost is inherent.
2. **Keep `composedSingle`'s per-request closure** — it is the multiple-`next()` correctness guard,
   not waste (C-01).
3. **Do not pool context instances** (C-04) — a real correctness hazard for ~0 measurable gain.
4. **The only useful next measurement is the deferred clean-host `--profile full` A/B** (C-02) — to
   learn whether the ~7% route-params gap is real; if it is, it lives in the shared HTTP/response
   path, which no context change addresses.
5. **Context is now cleared, like routing before it.** Two independent NextRush-specific CPU terms
   (matcher ~4%, context+dispatch ~1.3%) have each been audited to "not the lever." The consistent
   evidence across the whole program is that NextRush's request cost is dominated by shared, framework-
   agnostic I/O and serialization work — not by anything the framework's own hot code is doing wrong.
