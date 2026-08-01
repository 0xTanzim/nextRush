# NextRush Request Pipeline — Forensic CPU Audit (Handler Entry → Kernel `writev`)

> **Type:** read-only forensic performance audit. No `packages/**` code changed.
> **Scope:** the request pipeline *after* route match — dispatch, response helpers, serialization,
> header generation, adapter transition, socket write. Routing and Context construction were
> cleared in prior audits (`report/router-engine-review.md`, `report/context-review.md`) and are
> only cross-checked here, not re-reviewed.
> **Workload profiled:** `GET /users/:id` (route-params), the framework's representative dynamic
> path, on this shared dev host.
> **Evidence basis:** two fresh CPU profiles captured for this audit — one bucketed by pipeline
> stage, one by raw per-function self-time — plus the shipped source read live, the prior
> allocation micro-bench, and the prior `--trace-deopt` run. Every percentage below was parsed from
> a `.cpuprofile` at execution time, not asserted.

---

## Executive Summary

**Why this investigation existed.** Two prior audits cleared the two largest framework-specific CPU
terms — the router matcher (~3-4%) and `NodeContext` construction (~0.8%) — yet a ~7% route-params
throughput gap vs Fastify remained. The hypothesis under test: the gap is the *sum of many small
framework-owned costs* in the response/dispatch path that no single prior audit owned.

**What was measured.** A fresh route-params CPU profile, attributed two ways. By pipeline stage:

| Stage | Self-time | Owner |
|---|---:|---|
| Socket write (`writev` + `writevGeneric` + `createWriteWrap`) | **~32.5%** | Platform / kernel |
| Idle (spare capacity — server is **not** CPU-bound) | **~28%** | — |
| Node internals (llhttp parse, http server, events, timers) | **~22%** | Platform |
| `(program)` (V8 runtime/builtins glue) | ~6.2% | Platform |
| **`json` (`ctx.json`, incl. inlined `JSON.stringify`)** | **3.95%** | **Framework → mostly platform serialization** |
| Router matcher (`matchRoute` + `matchNodeIndexed`) | ~2.46% | Framework *(cleared)* |
| Promise/microtask machinery (`nextTick`+`runMicrotasks`+`processTicksAndRejections`) | ~3.1% | Platform *(partly framework-driven)* |
| GC | ~1.2% | Platform *(framework-driven)* |
| Dispatch (`composedSingle`/`compose`, core `(anon)`) | ~0.51% | Framework |
| `NodeContext` ctor | ~0.74% | Framework *(cleared)* |
| Adapter epilogue | ~0.26% | Framework |

**Framework-owned self-time totals ~8-10%; of that, the only *non-cleared, non-serialization,
addressable* slice is ~1-1.5%** (dispatch closures + the thin JS of `json()` + the adapter epilogue).

**What surprised the investigation.** Two things. (1) The single largest framework-owned frame,
`json` at 3.95%, is **dominated by `JSON.stringify`** — a V8 builtin that V8 *inlined into the
caller frame* (which is why a separate "serialize" bucket measured ~0%). It is not NextRush wrapper
waste; it is the cost of turning an object into bytes, which every framework calling `JSON.stringify`
pays. (2) **The entire response is written synchronously** — the whole chain from the adapter's
request callback down to `res.end()`/`writev` executes in *one synchronous call stack*; the promise
`.then` epilogue runs *after* the socket write is already queued and finds `ctx.responded === true`,
so it is post-response bookkeeping, not critical-path latency.

**Final conclusion (confidence: HIGH).** There is **no dominant framework bottleneck** in the
response pipeline. The remaining gap is the aggregate of many small, individually-justified costs
(serialization, an async-dispatch allocation tax, and Node's own request lifecycle), sitting on a
path that is **28% idle and I/O-bound** — the same wall the concurrency re-test hit (the server
could not be driven CPU-bound at c64/c128/c256 on this hardware). The one architecturally-addressable
lever with real CPU behind it is **serialization strategy** (schema-compiled serialization vs
`JSON.stringify`), which is an API/DX tradeoff, RFC-gated, and unproven to convert to RPS on an
idle path. Everything else is recommended **left unchanged (P4)**.

---

## Request Pipeline Reconstruction

The complete execution path for `GET /users/12345`, framework stages marked **[FW]**, platform
**[PLT]**, and the critical synchronous/asynchronous boundary made explicit:

```mermaid
sequenceDiagram
    participant K as Kernel/libuv [PLT]
    participant H as http.Server + llhttp [PLT]
    participant A as adapter createHandler [FW]
    participant C as composedSingle (core) [FW]
    participant R as routes middleware [FW]
    participant E as compiled executor [FW]
    participant Hd as route handler [APP]
    participant J as ctx.json [FW]
    participant N as res.writeHead/end [PLT]

    K->>H: socket readable → parse request (parserOnIncoming)
    H->>A: 'request' (req,res)
    Note over A,N: ── SYNCHRONOUS call stack ──
    A->>A: createNodeContext(req,res,contextOptions)  ·1 obj
    A->>C: handler(ctx)
    C->>C: nextFn closure  ·1 closure; setNext
    C->>R: only(ctx,nextFn)
    R->>R: match(method,path); ctx.params = match.params
    R->>E: executor(ctx)   (NF-1 direct promise forward)
    E->>E: setNext(NOOP_NEXT)
    E->>Hd: handler(ctx)
    Hd->>Hd: userById(id)  ·1 obj +2 strings [APP/shared]
    Hd->>J: ctx.json(obj)
    J->>J: JSON.stringify(obj)  ·1 string  [V8 builtin — PLT]
    J->>N: writeHead(status,{CT,CL}); res.end(json)
    N->>K: writev()  ← BYTES QUEUED HERE
    Note over A,N: ── stack unwinds; response already flushed ──
    C-->>A: resolved Promise<void>
    A->>A: .then(onFulfilled) → ctx.responded===true → noop  [post-response]
    K->>H: resOnFinish / clearIncoming  [PLT cleanup]
```

The load-bearing insight: **`writev()` is reached synchronously, before any microtask runs.** The
promise layer (`composedSingle`'s `Promise.resolve`, the executor's `Promise.resolve(handler())`,
and the adapter's `.then`) all settle *after* the bytes are queued. This is a well-engineered hot
path — the async machinery adds allocation/CPU bookkeeping but **zero latency** to the response.

---

## Evidence Analysis

- **CPU profile (stage-bucketed):** framework-owned self-time ~10%, platform ~54%, idle ~28%.
  Socket write (~32.5%) is the dominant single consumer and is entirely platform/kernel.
- **CPU profile (top-function):** `writev` 29.70%, `(idle)` 29.14%, `(program)` 6.19%,
  **`json` 3.95%**, `writevGeneric` 1.86%, `matchRoute` 1.62%, `nextTick` 1.40%, GC 1.21%,
  `emit` 1.14%, `runMicrotasks` 1.04%, `createWriteWrap` 0.98%, `matchNodeIndexed` 0.84%,
  `_storeHeader` 0.77%, `NodeContext` 0.74%, core `(anon)` 0.51%. RPS during capture: ~22.7k.
- **Allocation (prior `bench:alloc:context`):** per-request framework work 8.05 B/op net-retained
  (85.6% below the pre-trim baseline).
- **V8 (prior `--trace-deopt`):** 13 total deopts under load, **zero** on `json`, `matchRoute`,
  `matchNodeIndexed`, `composedSingle`, `NodeContext`, `getClientIp` — the hot path stays
  TurboFan-optimized; hidden classes are stable.
- **Benchmark correlation:** the ~7% route-params gap is *not* traceable to any single framework
  frame ≥ ~1% that isn't either platform (writev, http internals) or already-cleared (matcher,
  context). It correlates with the aggregate of serialization + async plumbing.

---

## Hypothesis Validation

**H1 — "A specific response helper (`json`) wastes CPU in its own JS."**
Evidence: `json` self-time 3.95%, but the top-function dump shows no separate `stringify` frame —
V8 inlined `JSON.stringify` into `json`. The helper's own JS (a `_responded` check, `Buffer.byteLength`,
one header object literal, one `writeHead`, one `res.end`) is a thin wrapper around the builtin.
**Result: REJECTED.** The 3.95% is dominated by serialization (platform), not wrapper waste.

**H2 — "Dispatch depth adds measurable wrapper overhead."**
Evidence: the framework dispatch chain (`composedSingle` → routes-mw → executor → handler) shows a
combined ~0.51% (core `(anon)`) plus the NF-1 direct-forward means routes-mw and executor add *no*
extra async frames. **Result: PARTIALLY ACCEPTED but P4.** The depth is real but each layer is
sub-1% and justified (next-guard, mount semantics, per-route middleware support). Not worth flattening.

**H3 — "The async/promise machinery delays the response."**
Evidence: the pipeline reconstruction proves `res.end`/`writev` execute synchronously in the handler
call stack; `runMicrotasks`/`nextTick` run *after*. **Result: REJECTED.** Promises add CPU/alloc
bookkeeping, not latency.

**H4 — "The remaining gap is one hidden bottleneck."**
Evidence: no framework frame ≥ ~1% is both addressable and non-cleared; the largest addressable
term is serialization strategy. **Result: REJECTED.** The gap is many small costs, not one.

**H5 — "Trimming framework CPU will raise RPS."**
Evidence: 28% idle; the prior concurrency re-test could not drive the server CPU-bound at any tested
concurrency. **Result: REJECTED for this workload.** The server is I/O-bound; freeing CPU does not
convert to throughput here.

---

## Framework-Owned Costs

- **`ctx.json` — 3.95% (P4, leave unchanged).** *File:* `packages/adapters/node/src/context.ts` /
  `json`. *Stage:* serialization + header write. *Root cause:* `JSON.stringify` (V8 builtin,
  inlined). *Necessary?* Yes — the response must be serialized. *Reducible?* Only via schema-compiled
  serialization (Finding PP-06), an architectural change. The wrapper JS itself (byteLength, one
  `writeHead` per HP-14, one `res.end`) is already minimal. **Verdict: keep.**
- **Dispatch closures — ~0.51% (P4, leave unchanged).** *File:* `packages/core/src/middleware.ts` /
  `composedSingle`. *Root cause:* one per-request `nextFn` closure carrying the multiple-`next()`
  guard. *Necessary?* Yes — correctness guarantee. *Reducible?* Only by dropping the guard.
  **Verdict: keep** (also concluded in `context-review.md` C-01).
- **Adapter epilogue — ~0.26% + a share of microtask cost (P4, leave unchanged).** *File:*
  `packages/adapters/node/src/adapter.ts` / `createHandler`. *Root cause:* per-request
  `.then(onFulfilled, onRejected)` — two closures + one chained promise — implementing the
  "ensure a response was sent" safety net and centralized error handling. *Necessary?* Yes — a
  handler that forgets to respond must not hang the socket, and rejections must reach the error
  handler. *Reducible?* Not cheaply: the closures capture per-request `ctx`/`res`; hoisting them
  needs `bind` (allocates a bound fn — no better) or a different resolution-passing contract.
  **Verdict: keep** — a real cost, but each alternative weakens correctness or costs the same.
- **`NodeContext` ctor — 0.74% (cleared, P4).** One allocation, stable hidden class, cached
  `getRuntime`, shared empties. Fully covered by `context-review.md`. **Keep.**
- **Router matcher — ~2.46% (cleared, out of scope, P4).** `matchRoute`+`matchNodeIndexed`. Covered
  by `router-engine-review.md`. **Keep.**

---

## Platform-Owned Costs (NextRush cannot realistically remove these)

- **`writev` + `writevGeneric` + `createWriteWrap` — ~32.5%.** The kernel/libuv work of writing bytes
  to the socket. The dominant cost of the entire request, and identical work for every framework.
- **Node http internals — ~22%.** `parserOnIncoming`/`parserOnHeadersComplete` (llhttp request
  parsing), `_storeHeader` (0.77% — Node serializing the header block; already minimized by HP-14's
  single `writeHead`), `resOnFinish`/`clearIncoming` (response teardown), `emit` (1.14% — lifecycle
  events).
- **Promise/microtask machinery — ~3.1%** (`nextTick` 1.40% + `runMicrotasks` 1.04% +
  `processTicksAndRejections` 0.68%). *Partly* framework-driven (the more promises created per
  request, the more this costs), but *mostly* Node's own http-server tick usage. The framework's
  synchronous-response design already keeps this off the critical path.
- **GC — ~1.2%.** Driven by the small per-request allocation set (context object, ~3 closures, ~2
  promises, the JSON string). All young-generation, cheaply collected. GC is not a hotspot.
- **`(program)` — ~6.2%.** V8 runtime/builtin glue (partly inlined builtin time).

---

## Optimization Opportunities

### Immediate (P0–P1): **none.**
No framework-owned frame is both large and addressable. The evidence does not support any immediate
change to the response pipeline.

### Future (P3, RFC-gated) — PP-06: schema-compiled serialization
- *Finding:* `ctx.json` → `JSON.stringify` is the largest framework-invoked CPU term (~3.95%, mostly
  the builtin). Fastify can compile a serializer from a response schema (`fast-json-stringify`),
  which is materially faster than `JSON.stringify` for known object shapes.
- *Why NextRush doesn't do this today:* it would require developers to declare response schemas — a
  DX cost that contradicts NextRush's "convention over configuration / the framework owns complexity"
  charter (`AGENTS.md` §8). It is a public-API/architecture change, therefore **RFC-gated**
  (`tdd-workflow.md`).
- *Expected improvement:* real CPU reduction in serialization; **but LOW confidence it converts to
  RPS on this workload** (28% idle, I/O-bound). Likely only matters under a genuinely CPU-bound
  regime, which this hardware could not produce.
- *Validation strategy (mandatory before adopting):* clean-host, CPU-pinned `--profile full` A/B,
  `JSON.stringify` vs a schema-compiled serializer on the JSON scenarios, reporting mean±stddev and
  CV; reject if RPS does not move beyond stddev. *Confidence it helps this workload: LOW.*

### Rejected — PP-07: de-promisify dispatch to cut microtask cost
- *Idea:* reduce the ~3.1% promise/microtask machinery by removing framework promises/closures.
- *Why rejected:* most of that 3.1% is Node's own http-server tick usage, not framework promises;
  the response is already written synchronously so the microtasks don't gate latency; and removing
  the `nextFn`/epilogue closures means dropping the multiple-`next()` guard, the response safety net,
  or centralized error handling. Complexity up, correctness down, RPS unchanged. **Prefer removing
  work over accelerating it — but only when the work is unnecessary; here it is not.**

### Rejected — PP-08: context/response object pooling
- Already rejected with reasoning in `context-review.md` C-04 (async-retention hazard, cheap
  young-gen GC, escape-analysis moot). Restated here for completeness. **Do not implement.**

---

## Engineering Trade-offs

- **Why the async-dispatch tax stays.** The three closures + two promises per request buy three
  correctness properties — multiple-`next()` detection, a response safety net, and centralized error
  handling. Each is a documented contract. Trading them for ~1% CPU on an idle path is a bad trade
  (`optimization_rules`: never weaken correctness for a microbenchmark).
- **Why `JSON.stringify` stays (for now).** Schema-compiled serialization is faster but shifts
  complexity onto the application developer (declare schemas), violating the framework's core
  philosophy. It is defensible *only* if a clean-host measurement proves both a real gap and a
  CPU-bound regime — neither of which current evidence supports.
- **Why the synchronous response write is worth preserving.** It is the single best structural
  property of this pipeline: the bytes hit `writev` before any microtask, so promise overhead never
  becomes latency. Any refactor of dispatch must preserve this.

---

## Final Conclusion

**Where is the remaining performance gap?** Distributed across many small costs, not one:
serialization (`JSON.stringify`, ~4%, platform builtin), the async-dispatch allocation tax
(~1-1.5% framework + a share of ~3% platform microtask plumbing), Node's own http lifecycle (~22%),
and the unavoidable socket write (~32.5%) — all on a path that is **28% idle**.

**Is there one dominant bottleneck?** No (confidence: HIGH). The largest framework-invoked frame
(`json` 3.95%) is dominated by a platform builtin; the largest cost overall (`writev`) is the kernel.

**Can NextRush realistically become faster?**
- **Theoretically:** yes — schema-compiled serialization would cut the ~4% serialization term.
- **Measurably (real HTTP RPS) on this workload:** **unproven and unlikely** — the server is
  I/O-bound at every tested concurrency, so freeing CPU does not raise throughput. This must be
  settled by the deferred clean-host, CPU-pinned `--profile full` A/B before any serialization work
  is justified.
- **Via microbenchmark:** a serializer swap would win an isolated stringify microbench — which, per
  the audit's own rules, is *not* sufficient grounds to ship it.

**Distinguishing the four kinds of improvement, explicitly:**
| Kind | Verdict |
|---|---|
| Theoretical | Schema serialization cuts ~4% CPU |
| Measurable (RPS, this hardware) | None demonstrated — server is I/O-bound / 28% idle |
| Microbenchmark | Serializer swap would win in isolation (insufficient basis to ship) |
| Real HTTP throughput | Gated on the clean-host CPU-pinned A/B; current evidence: no proven lever |

**Bottom line.** The response pipeline is well-engineered: a synchronous critical-path write,
stable hidden classes, deopt-free hot code, minimal per-request allocation, and every framework-owned
residual cost individually justified by a correctness guarantee. The remaining ~7% route-params gap
is best characterized as **the aggregate price of NextRush's DX-first, correctness-first design on an
I/O-bound path** — not a defect, and not a single fixable hotspot. The only honest next step is
**measurement, not optimization**: the clean-host `--profile full` A/B, to establish whether the gap
is even real off a shared dev box and whether any regime makes it CPU-bound. Absent that,
**recommend leaving the request pipeline unchanged.**

*Every conclusion here is independently verifiable: re-run a route-params CPU profile with
`--cpu-prof`, bucket self-time by the function URLs above, and confirm `writev` ~30%, idle ~28%,
`json` ~4%, matcher ~2.5%, dispatch/context <1% each.*
