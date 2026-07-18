## Context

`packages/core/src/middleware.ts` `compose()` is the heart of the request pipeline. Today it has
two paths:

- **`len === 0`** — fast path: returns a function that just calls the tail `next` (or resolves).
- **`len >= 1`** — the general path: returns `composedMiddleware`, which per request declares
  `let index = -1`, defines a recursive `dispatch(i)` closure, and for each layer builds a
  `nextFn` closure, wires `ctx.setNext(nextFn)`, and calls `Promise.resolve(fn(ctx, nextFn))`.
  The `index` counter is what detects `next()` being called more than once (`if (i <= index) return
  Promise.reject(new Error('next() called multiple times'))`).

The overwhelmingly common application shape has a **single** middleware in the stack — the mounted
router. `apps/benchmark/servers/nextrush-v3.js` is exactly this: `app.route('/', router)` →
`middlewareStack = [router.routes()]`. So every request runs the full general-path machinery
(a `dispatch` closure + index guard + a `nextFn` closure + a `Promise.resolve` wrap) purely to
invoke one middleware — which then runs its **own** dispatch inside
`packages/router/src/segment-trie.ts` `compileExecutor`. That redundant layer is finding **HP-6**,
the audit's only **P0**.

The constraint that makes this a spec rather than a patch: `compose()`'s current behavior is a
contract many things depend on — `ctx.next()` and the `next` argument advancing the same chain,
the multiple-`next()` rejection, synchronous-throw-to-rejection conversion, non-`Error` wrapping,
the double-response warning, and per-request state isolation across concurrent requests. A fast
path that drops any of these is a correctness regression, not an optimization.

## Goals / Non-Goals

**Goals:**

- A `len === 1` execution path in `compose()` that is allocation-lighter than the general path
  (no recursive `dispatch` closure, no index-comparison per call) yet produces **byte-for-byte
  identical observable behavior** for the single layer.
- Preserve, provably and under test, the full multiple-`next()` semantics (2/3/…/n calls, sync
  and async, and across mixed `ctx.next()` / `next`-argument surfaces) and per-request isolation
  under concurrency.
- Keep `compose()` the single source of truth for middleware semantics.
- Gate acceptance on a benchmark A/B (`--profile full`) and a parity + concurrency test matrix.

**Non-Goals:**

- **Not** unifying the two dispatch engines (core `compose` and router `compileExecutor`) or
  adding a "router-direct-entry" that lets the app skip a dispatch layer entirely. That removes
  the *async frame* and the whole redundant layer (the larger part of HP-6) but has per-request
  blast radius across router + core and needs its own RFC. Deferred; noted in Open Questions.
- **Not** removing or restructuring the Context object, and **not** touching `application.ts`
  `callback()`'s try/catch. `callback()` is unchanged and benefits automatically.
- **Not** implementing any other audit finding (HP-1, HP-7, HP-9…). One concern per change.
- **Not** changing any public API, type, or the `ComposedMiddleware` signature.

## Decisions

**D1 — The fast path lives inside `compose()`, never duplicated into `callback()`.**
The alternative (special-case `middlewareStack.length === 1` in `application.ts` and invoke the
middleware directly there) would copy the guard + double-response warning + error-wrapping logic
into a second location. That is precisely how the multiple-`next()` guard would silently rot — two
implementations drifting. Keeping the fast path in `compose()` means `callback()` is unchanged and
there is one authority for middleware semantics. Chosen over the `callback()` approach for
divergence safety.

**D2 — Multiple-`next()` detection is preserved with a per-invocation guard, declared inside the
returned per-request function.** The general path uses `let index = -1` scoped inside
`composedMiddleware`; the fast path uses the equivalent minimal state for one layer — a boolean
`called` (or a small counter) declared **inside the returned `(ctx, next) => …` function body**,
so each request invocation gets its own. Sketch (illustrative, not normative — the spec defines
behavior, not code):

```ts
if (len === 1) {
  const only = stack[0];
  return function composedSingle(ctx: Context, next?: Next): Promise<void> {
    let called = false;                       // PER-INVOCATION — never hoisted
    const nextFn = (): Promise<void> => {
      if (called) return Promise.reject(new Error('next() called multiple times'));
      called = true;
      if (warnDoubleResponse && ctx.responded) console.warn(/* identical text, index 0 */);
      return next ? next() : Promise.resolve();
    };
    if (ctx.setNext) ctx.setNext(nextFn);     // D3: same thunk as the arg
    try {
      return Promise.resolve(only(ctx, nextFn));
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
  };
}
```

The hoisting hazard (declaring `called` outside `composedSingle`, which would share it across
requests) is the single most dangerous bug this change could introduce; it is called out as a
Risk and covered by a dedicated concurrency-isolation test. Chosen over reusing the full `index`
machinery because a single layer needs only a one-bit guard, which is what buys the allocation
saving; behavior is identical.

**D3 — `ctx.next()` and the `next` argument MUST resolve to the exact same guarded thunk.**
This is the correctness lynchpin. The general path wires `ctx.setNext(nextFn)` with the same
`nextFn` it passes as the argument, so a double-call is caught no matter which surface each call
came through (`ctx.next()` then `next()`, or vice versa). The fast path builds **one** `nextFn`
per invocation and both passes it as the argument and hands it to `ctx.setNext`. Building two
separate thunks would let a caller invoke each once and evade the guard — explicitly forbidden and
tested.

**D4 — Rejection message and double-response warning text MUST be identical to the general path.**
Downstream code and tests may assert on `'next() called multiple times'` and on the warning text.
To prevent drift between the two paths, extract the shared message string(s) and the double-response
warn into a small shared helper/constant that both the general path and the fast path use, rather
than re-typing the literals. Chosen over duplicating literals (drift risk) — parity is asserted by
test on the exact strings, including the `index 0` reference in the warning.

**D5 — The fast-path boundary must not perturb the other paths.** `len === 0` keeps its existing
fast path; `len >= 2` keeps the existing general path unchanged. The `len === 1` branch is purely
additive. A regression test at `len === 2` (and the full existing compose suite) guards that the
general path was not altered.

**D6 — Acceptance is measurement-gated, not vibes.** The justification is performance, so the
change is only accepted if: (a) an allocation micro-benchmark shows the `dispatch` closure is gone
on the `len === 1` path; (b) `pnpm bench:validate` confirms byte-identical responses; (c)
`pnpm bench:compare --profile full` (5 runs, CPU-pinned) shows **no regression** on Hello World /
Route Params, ideally a measurable gain beyond stddev. If the full-profile A/B shows no movement
beyond noise, the change is parked or reverted — it does not merge on aesthetics. This mirrors the
repo's "measure before optimizing" steering and the router change's D4 discipline.

**D7 — Honest scope of the win.** The fast path still allocates one `nextFn` closure per request
(unavoidable while preserving the guard, `setNext` wiring, and the double-response warning). What
it removes is the recursive `dispatch` function closure, the index-comparison branching, and one
call-indirection — on 100% of single-middleware requests. This is the **safe portion** of HP-6.
The larger part (removing the async frame / the whole redundant layer via engine unification) is
D-noted as a deferred follow-up, not smuggled in here.

## Risks / Trade-offs

- **[Risk] The fast path silently drops multiple-`next()` detection** (the naive
  `return only(ctx, next ?? noop)` implementation). → **Mitigation:** D2's per-invocation guard is
  mandatory; the spec pins 2/3/n-call scenarios (sync, async, mixed-surface) and the test matrix
  asserts the identical rejection message. A fast path without the guard fails the suite.
- **[Risk] Per-request state leak under concurrency** (guard hoisted out of the per-call closure),
  causing request A's `next()` count to corrupt request B. → **Mitigation:** D2 mandates the guard
  is declared inside the returned per-invocation function; a dedicated high-concurrency isolation
  test (many interleaved invocations, a mix of single- and double-callers) proves no cross-talk.
- **[Risk] Message / warning-text drift between the two paths.** → **Mitigation:** D4's shared
  constant/helper; a parity test asserts exact string equality on both the rejection and the warn.
- **[Risk] Another `compose()` caller passes a meaningful tail `next` for a `len === 1` stack**
  and the fast path mishandles it. → **Mitigation:** the `(ctx, next?)` contract is preserved
  (the tail `next` is invoked on the first — and only the first — `next()` call); a test covers
  "fast path with a provided tail next"; callers of `compose()` are audited (via `trace_path`)
  before merge.
- **[Risk] Touching the universal request path introduces a regression elsewhere.** →
  **Mitigation:** full `@nextrush/core` suite + adapter-level routing integration tests + the
  cross-adapter parity expectation (compose is shared core) + coverage stays ≥90% with the new
  branch covered.
- **[Risk / honest] The A/B shows no gain beyond noise.** → **Mitigation:** D6 gates merge on the
  full-profile result; a no-movement outcome parks the change rather than merging a churn-only
  edit. The allocation micro-benchmark still documents the reduced garbage even if RPS is
  within stddev, informing the deferred engine-unification follow-up.

## Migration Plan

No runtime migration and no consumer-facing change — the optimization is behavior-preserving by
construction and the capability spec's scenarios are the regression contract. Ship as a single-file
change to `compose()` behind the full test matrix and the benchmark gate; it is independently and
trivially revertible (drop the `len === 1` branch → fall back to the general path). Follow the
repo's RED→GREEN→REFACTOR: land the failing edge-case/concurrency/parity tests first, then the
branch, then the benchmark gate.

## Open Questions

- **Engine unification (the rest of HP-6):** should a follow-up let the app invoke the router's
  match-and-run without a second dispatch wrapper (removing the async frame entirely) when there is
  no app-level middleware? Larger blast radius across core + router; RFC-gated; explicitly out of
  scope here. Revisit once this change's A/B quantifies how much the closure/branch removal alone
  buys.
- **Analogous router-side fast path:** `compileExecutor` already has a `len === 0` fast path; a
  single-route-middleware fast path is a symmetric optimization but is router scope, not this
  change. Note for a future router pass (audit HP-9/HP-10/HP-11 batch), not here.
- **Guard representation:** boolean `called` vs. reusing an `index`-style counter — either satisfies
  the spec; the implementer picks the minimal form that passes the parity suite. Left to
  implementation, not pinned by the spec.
