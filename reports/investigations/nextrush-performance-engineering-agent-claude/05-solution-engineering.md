# 05 — Solution Engineering

**Playbook phase:** Part 6 — Solution Engineering (§6.1–6.6, Sections A–C)

Every solution below states its goal, at least two alternatives, the trade-offs, the risk, and the
implementation strategy. Expected impact is separated into **measured**, **derived** and **estimated**,
and no solution is recommended on the strength of "it looks faster".

Code sketches are illustrative of the mechanism, not finished patches.

---

## S-00 — Close the process gap (P-00)

**Optimisation goal (§6.1):** make hot-path regressions impossible to land unnoticed, and make every
subsequent solution in this document measurable. This is the prerequisite for all others.

**Solution:** wire the tooling that already exists.

1. **Pin a baseline.** Run `pnpm bench:compare --profile full` on a CPU-pinned machine and commit the
   result to `apps/benchmark/results/baseline/`. The path is already whitelisted in
   `apps/benchmark/.gitignore` (`!/results/baseline/`) and is empty.
2. **Wire `check-regression.js` into CI** against that baseline, with a threshold wide enough to
   survive shared-runner noise (a 10% throughput-drop gate catches a P-01-class regression, which is
   ~16%, without flapping on scheduler noise).
3. **Add an allocation gate.** The `*-alloc.js` harnesses are deterministic (`cv≈0` in the team's own
   published runs, e.g. `bench:alloc:dispatch` 832.1 → 56.1 B/req). Bytes-per-request is a far better
   CI signal than throughput because it is noise-free on shared hardware. Add a **new**
   `bench:alloc:handler` harness covering `createHandler`, which is currently uncovered — the exact
   gap that let P-01 land.

**Alternatives (§6.2):**

| Alternative | Assessment |
| ----------- | ---------- |
| Throughput gate only | **Insufficient** — too noisy on shared CI runners to set a tight threshold, so it would only catch gross regressions |
| Allocation gate only | **Insufficient** — would not catch a CPU-bound regression that allocates nothing (e.g. an added synchronous scan) |
| **Both, with allocation as the tight gate and throughput as the loose gate** | **Recommended** — plays to each signal's strength |
| Manual review checklist | Rejected — P-01 demonstrates that review does not catch this |

**Trade-offs (§6.3):** adds CI time (the alloc harnesses are seconds; a full throughput comparison is
too slow for per-PR and should run nightly or on a label). A committed baseline needs periodic
refresh, and a stale baseline produces false alarms — so the refresh policy must be documented.

**Risk (§6.5):** none to runtime behaviour. The only risk is a flaky gate eroding trust, which the
allocation/throughput split mitigates.

**Expected impact (§6.4):** zero direct performance gain. Prevents recurrence and makes S-01…S-06
verifiable. **This is why it is Phase 1 item 1.**

---

## S-01 — Remove the per-request timeout race (P-01) · Critical

**Optimisation goal (§6.1):** eliminate ~11 heap allocations, one timer insert/remove pair and ~3
microtask boundaries per request, **while preserving the F-04 cross-adapter parity contract exactly**:
a handler exceeding `timeout` must still yield `504`, still call `ctx.triggerTimeout()`, still avoid
clobbering a committed response, and still swallow a late handler rejection.

### Alternatives (§6.2)

**A1 — Hoist the sentinel only.** Move `Symbol('timeout')` to module scope.
*Removes 1 of ~11 allocations. One line. Zero risk.* Do this regardless of which larger option is
chosen; it is strictly free.

**A2 — Flag-and-callback (recommended first step).** Replace `Promise.race` with a `settled` flag:

```ts
const timerId = setTimeout(onTimeout, timeout);
let settled = false;
handlerPromise.then(
  () => { if (settled) return; settled = true; clearTimeout(timerId); finalizeSuccess(); },
  (err) => { if (settled) return; settled = true; clearTimeout(timerId); finalizeError(err); }
);
function onTimeout() {
  if (settled) return;
  settled = true;
  ctx.triggerTimeout();
  if (!ctx.responded && !res.headersSent) { /* 504 */ }
  handlerPromise.catch(() => undefined);   // still swallow the late rejection
}
```

*Removes the array, the race promise, the inner `new Promise`, its executor closure, one derived
promise and one `.catch` promise — roughly 6 of ~11 allocations and ~2 of ~3 microtask hops. Keeps the
per-request `Timeout` object.* Observable behaviour is identical; the settle-once semantics that
`Promise.race` provided implicitly are now explicit in the flag.

**A3 — One shared coarse timer (recommended target).** Replace per-request `setTimeout` with a single
server-owned sweep. Keep in-flight requests in a structure keyed by deadline bucket; a timer firing
every `min(timeout / 10, 1000)` ms expires whatever is overdue.

*Removes the remaining per-request `Timeout` object and both timer-list operations — reaching roughly
9 of ~11 allocations plus all timer churn.* Timeout precision degrades to one sweep interval, which at
a 30-second default is immaterial. Requires a per-request registration/deregistration in a
server-scoped structure; the structure itself must be O(1) for insert and remove, so a doubly-linked
list per bucket, not an array scan.

**A4 — Make the timeout opt-in (`DEFAULT_TIMEOUT_MS = 0`).** Fastest and simplest: the
`timeout <= 0` fast path already exists and costs one comparison.
**Rejected.** It silently removes a cross-runtime parity guarantee that was deliberately added by
`d97734e3`, and it changes a security-relevant default (an unbounded handler becomes unbounded again on
Node while remaining bounded on Bun/Deno/Edge). Reverting a correctness fix to win a benchmark is the
wrong trade, and it would reintroduce the divergence F-04 existed to close.

**A5 — Arm the timer lazily, only if the handler has not settled within one macrotask.** Most handlers
settle in microtasks, so the timer would rarely be created at all.
*Attractive in principle*, but scheduling the check itself costs a `setImmediate` per request, trading
one timer for another. **Not recommended** — A3 achieves more for comparable effort.

### Recommended path

**A1 + A2 immediately** (small, low-risk, independently revertible), then **A3** once S-00's
allocation gate can prove each step. Do **not** bundle A1–A3 into one commit: they have different risk
profiles and must be independently measurable and revertible.

### Trade-offs (§6.3)

| Dimension | Assessment |
| --------- | ---------- |
| Performance | Derived: removes the majority of P-01's ~11 allocations/request |
| Complexity | A2 is *more* explicit than `Promise.race` (settle-once becomes visible rather than implicit). A3 adds a genuine new component — a timer wheel — which is real added complexity that must be justified by measurement from A2's result first. |
| Maintainability | A2 improves it. A3 concentrates timeout logic in one reviewable place, but that place must be correct under concurrency. |
| API compatibility | **None affected.** `ServeOptions.timeout` semantics unchanged. |
| Cross-runtime parity | **Must be preserved** — this is the binding constraint. Bun/Deno/Edge use their own `Promise.race`; if A3 lands on Node only, the *observable* contract stays identical but the *implementations* diverge further. That is acceptable (adapters are allowed to differ internally) but must be documented, and the conformance suite is what proves it. |
| Memory | A3 adds a bounded server-scoped structure sized by in-flight request count |

### Risk (§6.5)

| Risk | Mitigation |
| ---- | ---------- |
| Late handler rejection becomes an unhandled rejection | Explicit test asserting no `unhandledRejection` when the handler rejects **after** the timeout fired. This is the most likely thing to be lost in a rewrite. |
| Timeout fires after the response was committed | Preserve the `!ctx.responded && !res.headersSent` guard; test it |
| A3 leaks entries when a request never settles | Deregistration must be in the same settle path as `clearTimeout` is today; test with an abandoned handler |
| Cross-adapter divergence | **Mandatory**: run `packages/adapters/conformance` (148 tests per the prior report) — non-negotiable for this change |

### Implementation strategy (§6.6)

Target `packages/adapters/node/src/adapter.ts` → `createHandler`. Order: A1 → test → A2 → test +
conformance → measure → A3 only if A2's measured gain justifies the added component. Rollback is `git
revert` per step; the `timeout <= 0` branch remains as a permanent built-in A/B control.

---

## S-02 — Eliminate per-request containers in the param path (P-02) · Critical

**Optimisation goal (§6.1):** remove up to 4 of 5 per-request container allocations on param routes
and 1 on **every** route, without weakening the null-prototype security guarantee.

### Alternatives (§6.2)

**B1 — Router-owned reusable bind stacks (recommended).** Hoist `bindNames`/`bindValues` to the router
instance; set `length = 0` on entry to `matchRoute`.

*Safety argument, which must be verified before implementing:* `matchRoute` is synchronous from
allocation to consumption — no `await`, no yield, no callback into user code between the arrays being
filled and the `params` object being materialised. Node is single-threaded, so no interleaving is
possible. **This invariant is load-bearing and invisible**: a future `await` inserted anywhere in
`matchRoute` or `matchNodeIndexed` would silently corrupt concurrent requests. It must be protected by
(a) an explicit comment stating the invariant, and (b) a test that runs many interleaved matches and
asserts params are never cross-contaminated. Without both, this is the kind of optimisation that
produces a rare, unreproducible production bug.

**B2 — Remove the `canonicalizePath` result object.** Return the canonical string; signal rejection
with a module-level frozen sentinel or `undefined`. *Removes 1 allocation on **all** requests
including static ones — so it improves the fixed floor, not just the param path.* Lowest risk of the
set; no reused mutable state.

**B3 — Remove the `RouteMatch` object literal.** Two sub-options:
- *B3a:* a router-owned scratch record, same synchronous-consumption argument as B1.
- *B3b:* have `matchRoute` write `ctx.params` directly and return only the executor. Cleaner (no
  reused mutable state at all) but changes `matchRoute`'s signature to take `ctx`, coupling the router's
  matcher to the Context type. Given `createRoutesMiddleware` already assigns `ctx.params` immediately,
  **B3b is preferred** — it removes an allocation *and* a redundant assignment, at the cost of a
  tighter coupling that already exists one frame up.

**B4 — Single-pass param materialisation.** Write into the `params` object during the walk instead of
into parallel arrays. **Not recommended now.** The parallel-stack design exists precisely because the
walk backtracks — deferred binding (HP-11) replaced an earlier eager-bind design that needed
`Reflect.deleteProperty` on backtrack, which was worse. Reverting toward eager binding risks
reintroducing that. Revisit only if profiling shows the copy loop is significant, which is unlikely
for typical param counts of 1–3.

### Recommended path

**B2 → B1 → B3b**, in that order: ascending risk, and B2 alone improves every request.

### Trade-offs (§6.3)

Reused mutable state buys allocation removal at the cost of a **non-obvious concurrency invariant**.
This is the central trade of S-02 and should be stated in the commit message, not just the code. The
null-prototype `params` object (`Object.create(null)`) is **not** negotiable — any pooling proposal
that reuses a plain `{}` is rejected on prototype-pollution grounds.

### Risk (§6.5)

| Risk | Mitigation |
| ---- | ---------- |
| A future `await` in the match path silently corrupts concurrent requests | Invariant comment + interleaved-match test + a lint rule or review checklist item forbidding `async` in `match-route.ts` |
| Prototype pollution via a reused params object | Never pool `params`; keep `Object.create(null)` per match |
| Behavioural change in the dot-segment rejection path | B2 must preserve the 400-with-chain-stop behaviour, not fall through to 404 |

### Implementation strategy (§6.6)

`packages/router/src/{match-route,dispatch}.ts`. One commit per sub-option, each with the router's
existing test suite plus `bench:alloc:router-match` and `bench:alloc:param-match` before and after.

---

## S-03 — Compile middleware chains at registration time (P-03) · High

**Optimisation goal (§6.1):** reduce per-layer cost from 2.09 µs toward Fastify's 0.87 µs by moving
chain construction from request time to registration time.

### Alternatives (§6.2)

**C1 — Backward compilation (recommended).** At `compileExecutor` time, build from the tail:

```ts
// registration time — once per route
let chain = (ctx, state) => Promise.resolve(handler(ctx, NOOP_NEXT));
for (let i = len - 1; i >= 0; i--) {
  const mw = middleware[i];
  const downstream = chain;                       // captured successor, not an index
  chain = (ctx, state) => {
    const next = () => { /* guard via state */ return downstream(ctx, state); };
    if (ctx.setNext) ctx.setNext(next);
    try { return Promise.resolve(mw(ctx, next)); }
    catch (err) { return Promise.reject(err instanceof Error ? err : new Error(String(err))); }
  };
}
```

Per request this becomes: one small `state` object (for the double-`next` guard) plus the `next`
closures that are still created per layer per request because they must close over `state`.

**Honest assessment:** C1 as sketched removes the `dispatch` closure and the per-request index
arithmetic, but **not** the per-layer `next` closures — those need per-request state. So the gain is
real but smaller than "compile the chain" implies. Achieving *zero* per-layer closures requires
holding the guard state on the Context (e.g. a per-request cursor) rather than in a closure, which
is a larger change and interacts with `ctx.setNext`. **Do not claim a 2.4× improvement for C1.** Claim:
removes one closure and the index arithmetic per request; measure the rest.

**C2 — Conditionally elide the `Promise.resolve` wrapper.**
```ts
const r = mw(ctx, next);
return r === undefined ? downstream(ctx, state)
     : (typeof r?.then === 'function' ? Promise.resolve(r) : /* sync value */ downstream(...));
```
Preserves thenable adoption (the documented reason the wrapper exists) while skipping promise creation
for synchronous middleware — the common case. *Possibly higher value than C1*, since it removes both an
allocation and a microtask hop per layer.

**C3 — Extend the `len === 1` fast path to `len === 2`.** Cheap, narrow, partially subsumed by C1.

**C4 — Unify `compose` and `compileExecutor` on one builder.** Primarily maintainability: two
near-identical recursive dispatchers currently live in two packages and must be kept semantically
identical by hand. Worth doing alongside C1 so future optimisations land in both.

**C5 — Generate the chain with `new Function`.** **Rejected.** Breaks CSP-restricted and edge runtimes,
defeats the framework's runtime-independence rule, and is unauditable. Not acceptable for a framework
that must run on Cloudflare Workers.

### Recommended path

**C2 first** (smallest, plausibly largest gain), measure, then **C1 + C4** together, then reconsider
whether zero-closure dispatch is worth its complexity.

### Trade-offs (§6.3)

A compiled chain is harder to read than an index loop, and the eight semantics in
`03-subsystem-analysis/middleware.md` §9 must each be covered by test — especially `setNext(NOOP_NEXT)`
termination, which the source documents as load-bearing (NF-4a) and which a rewrite would silently
break by allowing a handler's `ctx.next()` to leak into app-level middleware mounted after the router.
Registration cost rises marginally, paid once per route at boot: a trade the framework's own principles
explicitly endorse.

### Risk (§6.5)

Medium. Middleware semantics are the most intricate contract in the framework. Mitigation: implement
C2 and C1 separately; require the full core + router suites plus a dedicated semantics test matrix
before either merges.

---

## S-04 — Lazy `ctx.ip` (P-04) · Medium

**Goal:** remove one socket dereference and one retained string per request.

**Solution:** convert `ip` to a memoised getter over `_req`, exactly mirroring the already-shipped
`ctx.raw` pattern (which the team measured at 47.6 → 8.1 B/req).

**Alternatives:** (a) memoised getter — recommended; (b) compute only when `proxy !== false` — rejected,
it makes `ctx.ip` behaviour depend on configuration in a way that is surprising; (c) leave as-is —
defensible on its own, since the cost is likely sub-microsecond, but the pattern is already established
in this exact file for three other properties, so consistency is nearly free.

**Trade-offs:** `ip` becomes a getter, so a hidden-class transition on `NodeContext` must be checked —
the constructor's fixed property-assignment order is what keeps the shape monomorphic, and removing an
assignment changes the shape. This is a small but real risk of an accidental deopt and is precisely why
this needs measurement rather than assumption.

**Risk:** Low. Must preserve `resolveClientIp` policy routing when `proxy` is configured, so precedence
matches Bun/Deno/Edge.

---

## S-05 — Static-file metadata cache (P-05) · Medium, gated

**Goal:** eliminate the per-request filesystem `stat` for repeatedly-requested files.

**Precondition, not optional: a static-file benchmark scenario must exist first.** Implementing a cache
with a staleness window and a security surface on the strength of a structural argument alone would
violate the playbook's evidence rule (§1.6). The measurement is the first deliverable.

**Solution:** opt-in bounded LRU keyed on the **post-validation** absolute path, storing only
`{ size, mtimeMs, isFile, isDirectory, etag }` — **never the symlink-safety verdict**. Traversal screens
and `statSafe` containment validation continue to run per request, before the cache is consulted. Plus a
bounded short-TTL negative cache so repeated misses stop amplifying into syscall cascades.

**Alternatives:** (a) always-on cache — rejected, changes correctness defaults silently; (b) opt-in with
TTL — recommended; (c) boot-time manifest for immutable build output — highest performance, but files
added after boot become invisible, so it must be separately opt-in and clearly documented; (d) delegate
to a reverse proxy and document that as the recommended production topology — **a legitimate answer that
should be considered seriously before building anything**, since most production static serving belongs
in front of Node anyway.

**Trade-offs:** staleness window versus syscall elimination; bounded memory; a more intricate design than
plain memoisation because of the security constraint.

**Risk: High** — the highest of any solution here. A cache that memoises a safety verdict is a symlink
TOCTOU vulnerability. This is why the recommendation is narrow, opt-in, and metadata-only.

---

## S-06 — `send()` two-level dispatch (P-06) · Medium

**Goal:** stop `send(object)` traversing seven failed type tests.

**Solution:** branch on `typeof data` first — `'string'` → string branch; `'object'` → nested chain
testing binary and stream kinds *before* falling through to `json()`; `null`/`undefined` → `end()`;
else → `String(data)`. This preserves the mandatory ordering constraint (`Buffer` is a `Uint8Array` is
an `object`, so the object branch must remain after all binary/stream tests).

**Alternatives:** (a) two-level dispatch — recommended; (b) naive reorder putting the object test
earlier — **rejected, it would JSON-serialise Buffers**; (c) a `Map`-based dispatch table — rejected,
`instanceof` checks are not expressible as map keys; (d) split into per-kind helpers — recommended
*alongside* (a), bringing a 142-line/complexity-22 function within the project's shape guidance and
making each branch independently testable.

**Trade-offs:** slightly less linear to read; more functions. Both are net positives at current
complexity. **A `send(object)` benchmark scenario must be added, or this change cannot be validated at
all.**

**Risk:** Low, provided the `Buffer`-is-an-object constraint is covered by test.

---

## Optimisation summary (§6.7)

| ID | Root cause | Recommended path | Expected impact | Evidence class | Risk | Priority |
| -- | ---------- | ---------------- | --------------- | -------------- | ---- | -------- |
| S-00 | P-00 | Pin baseline + wire alloc & throughput gates | None directly; enables all others | Confirmed need | None | **1** |
| S-01 | P-01 | A1 + A2, then A3 if justified | Derived: ~6→9 of ~11 alloc/req removed; targets +5.55 µs floor | Strong | Medium | **2** |
| S-02 | P-02 | B2 → B1 → B3b | Derived: 4 of 5 containers removed; targets +5.23 µs param cost | Strong | Medium | **3** |
| S-03 | P-03 | C2, then C1 + C4 | Estimated: partial closure of +1.22 µs/layer — **not** a full 2.4× | Strong mechanism, estimated magnitude | Medium | **4** |
| S-04 | P-04 | Memoised getter | Estimated: sub-µs | Hypothesis | Low | **5** |
| S-05 | P-05 | Benchmark first, then opt-in metadata cache | Unmeasured | Hypothesis | **High** | **6** |
| S-06 | P-06 | Two-level dispatch + helper split | Unmeasured | Hypothesis | Low | **7** |

**No solution in this table may be declared successful without the corresponding validation in
`06-validation-regression.md`.** Sequencing is in `07-optimization-roadmap.md`.
