# Subsystem — Middleware

**Playbook phase:** Part 4 §4.13, analysed with the §4.1–4.10 methodology
**Packages:** `@nextrush/core` — `packages/core/src/middleware.ts` (`compose`);
`@nextrush/router` — `packages/router/src/segment-trie.ts` (`compileExecutor`)
**Owns finding:** **P-03 (High)** — request-time chain construction where registration-time
compilation is possible

---

## 1. Purpose (§4.1)

Run an ordered chain of async functions around a handler, where each layer may act before and after
the rest of the chain, may short-circuit by responding, and may advance either by calling its `next`
argument or by calling `ctx.next()`. Two independent implementations exist for two levels:

- `compose()` — application-level chain (`app.use()`), owned by core.
- `compileExecutor()` — per-route chain (`router.get('/x', mw1, mw2, handler)`), owned by the router.

They deliberately mirror each other's semantics so per-route middleware behave identically to
application middleware.

## 2. Architecture (§4.2)

**`compose(middleware[])`** validates at compose time, snapshots the array, and returns one of three
shapes:

| Stack length | Returned shape | Per-request cost |
| ------------ | -------------- | ---------------- |
| 0 | `composedMiddleware` → `next()` or resolved promise | Minimal |
| **1** | `composedSingle` — **fast path**, no recursive dispatch, one `called` flag + one `nextFn` closure | Low |
| ≥ 2 | `composedMiddleware` → index-based recursive `dispatch(i)` | 1 `dispatch` closure + 1 `nextFn` closure **per layer** |

The `len === 1` fast path is a shipped optimisation and is well-reasoned in source: the `called`
guard is declared *inside* the returned function so it is per-invocation and cannot be corrupted
across concurrent requests, and the same guarded thunk is both passed as `next` and wired to
`ctx.setNext`, so double-call is caught on either surface.

**`compileExecutor(handler, middleware[])`** likewise returns two shapes:

| Middleware count | Returned shape | Per-request cost |
| ---------------- | -------------- | ---------------- |
| **0** | Direct `Promise.resolve(handler(ctx, NOOP_NEXT))`, no async frame (NF-1) | Low |
| ≥ 1 | A closure that builds a recursive `dispatch(i)` **at request time** | 1 `dispatch` closure + per layer: 1 `next` closure + 1 `Promise.resolve` + 1 `setNext` call |

## 3. Request lifecycle participation (§4.3)

Both run on **100% of requests**. In the benchmarked application shape:

- `compose` takes the `len === 1` fast path, because `app.route('/', router)` hits the root-mount
  fast path and produces a one-entry middleware stack. This is the cheapest possible configuration.
- `compileExecutor` takes the `len === 0` path for the eight scenarios with no per-route middleware,
  and the `len === 5` path for the `middleware-stack` scenario.

**The measured numbers therefore reflect the most favourable middleware configuration NextRush
supports.** A realistic application with `app.use(helmet())`, `app.use(cors())`, `app.use(json())`
would take `compose`'s general recursive path on every request, adding cost this benchmark never
exercises. The findings below are a lower bound.

## 4. Performance characteristics (§4.4)

Marginal cost of the 5-layer chain (`middleware-stack µs/req − that framework's own hello-world`),
from `01-benchmark-analysis.md` §4.2:

| | Total for 5 layers | Per layer | vs Fastify |
| --- | --- | --- | --- |
| Fastify | 4.36 µs | **0.87 µs** | — |
| Raw Node.js (real 5-function chain) | 5.22 µs | 1.04 µs | 1.2× |
| Hono | 9.72 µs | 1.94 µs | 2.2× |
| **NextRush v3** | **10.43 µs** | **2.09 µs** | **2.4×** |
| Koa | 5.31 µs | 1.06 µs | 1.2× |
| Express | 5.08 µs | 1.02 µs | 1.2× |

Two things stand out. NextRush's per-layer cost is the **highest in the suite**, and it is 2× the
cost of raw Node's hand-written `runChain` — which does the same logical work (call a function, it
sets a header, it calls `next`) with plain callbacks and no promises. Koa, whose async middleware
model NextRush's most closely resembles, achieves 1.06 µs/layer.

Middleware Stack is also NextRush's joint-widest gap: **−25.6% vs Fastify, −25.5% vs raw Node** at
256 connections, and its scaling ratio is **×1.01** from 1 → 64 connections (the flattest in the
suite alongside Route Parameters).

## 5. Runtime behaviour (§4.5)

Per request, for a 5-layer route, from `compileExecutor`'s `len >= 1` branch:

```
executor(ctx)                       → 1 closure invocation
  let index = -1                    → captured variable
  dispatch = (i) => {...}           → 1 CLOSURE ALLOCATION per request
  dispatch(0)
    ├─ i=0: next = () => dispatch(1)   → 1 CLOSURE
    │       ctx.setNext(next)          → 1 call + 1 property write
    │       Promise.resolve(mw(ctx,next)) → 1 PROMISE (mw returns ctx.next())
    ├─ i=1: … same … × 4 more layers
    └─ i=5: ctx.setNext(NOOP_NEXT)
            Promise.resolve(handler(ctx, NOOP_NEXT)) → 1 PROMISE
```

**Per request: 1 `dispatch` closure + 5 `next` closures + 6 `Promise.resolve` calls + 6
`setNext` calls + 6 property writes.** Each layer in the benchmark is
`(ctx) => { ctx.set(h, v); return ctx.next(); }`, so every layer's return value is the promise from
`dispatch(i+1)`, which `Promise.resolve` then adopts — adding a microtask boundary per layer on top
of the closure allocations.

Contrast raw Node's `runChain`: one `index` variable, one `next` closure total (not per layer),
zero promises, zero microtasks. That is the 1.04 µs/layer.

## 6. Bottleneck analysis (§4.6)

| Observation | Category | Note |
| ----------- | -------- | ---- |
| `compileExecutor` **does not compile** for `len >= 1` | Architectural / naming-vs-behaviour mismatch | The function's name implies registration-time work. For the zero-middleware case it genuinely does compile (returns a specialised closure). For the case where compilation would actually pay — a known, fixed, ordered middleware array — it defers all structure to request time. |
| One closure per layer per request | Excessive allocation | The `next` for layer *i* is `() => dispatch(i+1)`. Both `i` and the chain are known at registration; only `ctx` varies. |
| `Promise.resolve()` wrapper per layer | Async overhead | Necessary for thenable adoption (correctly documented in source), but applied unconditionally including to layers that return the already-native promise from `dispatch` |
| `ctx.setNext(next)` per layer | Duplicate work | Wires the modern `ctx.next()` surface. Load-bearing (see §9) but paid even when no layer uses `ctx.next()` — which cannot be known here, though it *can* be known at registration by inspecting nothing… so it cannot be elided safely. |
| `compose` general path duplicates `compileExecutor`'s dispatch logic | Duplication (maintainability, not runtime) | Two near-identical recursive dispatchers in two packages; a change to one must be mirrored |

**Explicitly not a bottleneck:**
- The `len === 0` and `len === 1` fast paths. Both are present, correct, and effective. NF-1 (removing
  the extra async frame from the router→executor boundary) is verified shipped at HEAD.
- Double-`next()` detection. It costs one integer compare per layer. Removing it would trade a real
  correctness guarantee for a negligible gain and is rejected.

## 7. Root cause candidates (§4.7)

**Primary — architectural: request-time construction of a registration-time-known structure.** The
middleware array for a route is fixed the moment `router.get(path, ...mw, handler)` is called. The
only per-request input is `ctx`. Yet the chain's linkage is rebuilt on every request. This directly
violates the framework's own stated principle — *prefer registration-time work over request-time
work* — and it is the reason the per-layer cost is 2.4× a framework that does compile
(`find-my-way` + Fastify's pre-built hook chain).

**Secondary — async overhead.** Six promise creations and up to six microtask boundaries per request
for a chain whose layers are, in the benchmark and in the overwhelming majority of real middleware,
**synchronous** (set a header, return). The promise machinery is paid for the possibility of
asynchrony rather than its occurrence. Raw Node's chain demonstrates the floor without it.

**Confidence: Confirmed** (both read in source at HEAD). **Strong evidence** for attribution: the
per-layer delta is measured, the mechanism is counted, and the raw-Node control isolates promise
machinery as the difference.

## 8. Optimisation opportunities (§4.8)

Full designs in `05-solution-engineering.md` S-03.

1. **True registration-time compilation.** At `compileExecutor` time, build the chain **backwards**:
   for `i = len-1 … 0`, create a closure that captures the *already-built* successor rather than an
   index. The per-request cost collapses to invoking the outermost closure — zero `dispatch` closure,
   zero per-layer `next` closures. The per-invocation double-`next` guard must be preserved by
   allocating one small per-request state object (or by keeping a per-layer `called` flag scoped to
   the invocation), which is a net reduction from *len+1* closures to *one* object.
2. **Elide the `Promise.resolve` wrapper when the layer's return is already a native promise.** The
   source comment correctly explains why `Promise.resolve` is used rather than
   `x instanceof Promise ? x : RESOLVED` — thenable adoption. A `typeof x?.then === 'function'`
   check preserves adoption while skipping the wrapper for `undefined` returns, which is the
   common synchronous-middleware case.
3. **Unify the two dispatchers.** Have `compose` and `compileExecutor` share one compiled-chain
   builder. Primarily a maintainability win (removes duplicated semantics across a package
   boundary), with the side effect that any future optimisation lands in both.
4. **Extend the `len === 1` fast path to `len === 2`.** Two-layer stacks are common
   (`app.use(cors()); app.use(json())`). Lower value than item 1 and partially subsumed by it.

## 9. Edge cases reviewed (§4.9)

Every one of these is a semantic that an optimisation must not break. They are the reason a naive
"just inline the chain" rewrite is risky.

| Case | Current behaviour | Preserve? |
| ---- | ----------------- | --------- |
| Layer calls `next()` twice | Rejects with `next() called multiple times` | **Yes** |
| Layer calls `ctx.next()` instead of its argument | Advances the same chain — `ctx.setNext` is wired to the identical thunk before each layer | **Yes** |
| Layer throws synchronously | Converted to a rejected promise, not a sync throw | **Yes** |
| Layer throws a non-`Error` | Wrapped in `new Error(String(err))` | **Yes** |
| Layer returns a non-promise **thenable** | Adopted and awaited via `Promise.resolve` | **Yes — this is why the wrapper exists** |
| **Handler calls `ctx.next()`** | `setNext(NOOP_NEXT)` makes it a safe no-op | **Yes — load-bearing.** Source documents this as NF-4a: without it, a handler's `ctx.next()` would leak into app-level middleware mounted *after* the router, because the general `compose` dispatch wires `ctx._next` to advance into that middleware. This is the single most likely thing a chain rewrite would silently break. |
| Layer responds without calling next | Chain ends; `warnDoubleResponse` warns in non-production if a later layer also responds | Yes |
| Concurrent requests through the same compiled route | Safe today because every mutable piece (`index`, `called`) is per-invocation | **Yes — a compiled chain must not hoist per-request state into the closure** |

## 10. Investigation summary (§4.10)

| | |
| --- | --- |
| **Finding** | P-03 — per-route middleware chains are constructed at request time although the chain is fully known at registration time; per-layer dispatch costs 2.4× Fastify's and 2× a plain callback chain |
| **Evidence** | Middleware Stack −25.6% vs Fastify / −25.5% vs raw Node @256; per-layer marginal cost 2.09 µs vs Fastify 0.87 / raw Node 1.04 / Koa 1.06; scaling ratio ×1.01; per-request inventory of 6 closures + 6 promises read in `compileExecutor` at HEAD |
| **Root cause** | Architectural — request-time construction of a registration-time-known structure; secondary async/promise overhead on predominantly synchronous layers |
| **Runtime impact** | +1.22 µs per middleware layer per request vs Fastify; scales linearly with stack depth, so cost grows with application maturity |
| **Performance impact** | Middleware Stack projected 22,217 → ~29,800 rps at parity (+34%) in combination with P-01 |
| **Recommendation** | Compile the chain backwards at registration time; conditionally elide the `Promise.resolve` wrapper; unify the two dispatchers |
| **Trade-offs** | A compiled chain is harder to read than an index loop and must be covered by tests for all eight §9 semantics, especially `NOOP_NEXT` termination. Registration cost rises marginally (paid once per route at boot) — a favourable trade the framework's own principles endorse. |
| **Priority** | **High** (widest gap jointly with route-params; grows with real application shape) |
| **Confidence** | Confirmed (mechanism) / Strong evidence (attribution) |
| **Validation** | `06-validation-regression.md` V-03; the repo's existing `bench:alloc:compose` and `bench:alloc:dispatch` harnesses are directly applicable |

**Cross-references:** `router.md` (owner of `compileExecutor`'s call site),
`04-root-cause-analysis.md` §4, `05-solution-engineering.md` S-03.
