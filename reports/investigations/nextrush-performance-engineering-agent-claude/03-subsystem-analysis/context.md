# Subsystem — Context & Request Lifecycle

**Playbook phase:** Part 4 §4.11 (Request Lifecycle) + §4.14 (Context), analysed with the §4.1–4.10
methodology
**Packages:** `@nextrush/adapter-node` — `packages/adapters/node/src/{adapter,context}.ts`
**Owns findings:** **P-01 (Critical)** — unconditional per-request timeout race;
**P-04 (Medium)** — eager `ctx.ip` resolution

This subsystem owns the **fixed per-request floor**, the cost every request pays regardless of
route, body, or middleware. It is therefore the highest-leverage subsystem in the framework: a
microsecond removed here is removed from 100% of traffic.

---

## 1. Purpose (§4.1)

Convert a platform-specific request/response pair into the single runtime-neutral `Context` object
that the entire framework programs against, invoke the composed pipeline, and guarantee that a
response is always sent. It exists so that no core, router, or middleware code ever touches
`req`/`res` directly — the property that makes the same application run unchanged on Node, Bun, Deno
and edge runtimes.

## 2. Architecture (§4.2)

```
node:http 'request' event
  └─ handler = createHandler(app, options)      ← built ONCE at serve() time
       ├─ hoisted: app.callback(), proxy, logger, timeout, frozen contextOptions
       └─ per request:
            ├─ createNodeContext(req, res, contextOptions)  → new NodeContext
            ├─ finalizeSuccess / finalizeError closures
            ├─ handler(ctx)                     ← Application.callback() async arrow
            │     └─ compose(...)(ctx) → router middleware → executor → handler
            └─ TIMEOUT RACE  ← P-01
```

`createHandler` correctly hoists everything hoistable: the composed callback, the `proxy` flag, the
logger, the timeout value, and a **frozen** `contextOptions` object built once and reused (a shipped
trim, HP-4, with the freeze documented as preventing cross-request mutation leakage). The
constructor-level design is sound. The problem is what remains inside the per-request closure.

## 3. Request lifecycle participation (§4.3)

Everything in this subsystem runs **once per request, unconditionally, with no fast path**.

## 4. Performance characteristics (§4.4)

The fixed floor is measurable directly: the `empty-response` scenario returns `204` with no body, no
params, no middleware and no serialization, so its cost *is* the floor.

| | Raw Node.js | Fastify | NextRush v3 | Express | Koa |
| --- | --- | --- | --- | --- | --- |
| Empty Response @256 | 44,043 rps | 40,407 rps | **32,999 rps** | 31,274 rps | 29,280 rps |
| µs/req | 22.71 | 24.75 | **30.30** | 31.98 | 34.15 |
| Floor overhead vs raw Node | — | +2.04 µs | **+7.59 µs** | +9.27 µs | +11.44 µs |
| Floor overhead vs Fastify | — | — | **+5.55 µs** | +7.23 µs | +9.40 µs |

**NextRush's fixed floor is 3.7× Fastify's framework overhead** (+7.59 µs vs +2.04 µs above raw
Node) and only marginally better than Express's. This is the single largest contributor to the
benchmark gap, because it is present in every scenario: of the 15.8% Hello World deficit vs Fastify,
the floor accounts for 5.55 of the 5.46 µs total gap — i.e. essentially all of it.

Empty Response also shows a scaling ratio of ×1.22 (1 → 64 conn) against Fastify's ×1.36 and raw
Node's ×1.53.

## 5. Runtime behaviour (§4.5)

### 5.1 Context construction — mostly clean

```ts
constructor(req, res, options = {}) {
  this._req = req; this._res = res;
  this.runtime = getRuntime();                        // cached accessor — not a cost
  this.method = (req.method?.toUpperCase() ?? 'GET');  // prior review measured 0 B for uppercase input
  this.url = req.url ?? '/';
  const questionIndex = this.url.indexOf('?');
  if (questionIndex !== -1) { this.path = …slice…; this.query = parseQueryString(…); }
  else { this.path = this.url; this.query = EMPTY_QUERY; }   // shared frozen sentinel ✔
  this.headers = req.headers;
  this.ip = this.getClientIp(req, options.proxy ?? false);    // ← P-04: EAGER
}
```

This is a well-optimised constructor. `EMPTY_QUERY` is a shared frozen sentinel so query-less
requests allocate nothing; `ctx.raw` and `ctx.state` are **lazy getters** (both verified at HEAD —
these were prior findings HP-5 and NF-2, and both are genuinely shipped); no `AbortController` is
created eagerly. The property set is assigned in a fixed order, which keeps the hidden class stable.

The one residual: **`this.ip` is computed eagerly.** With the default `proxy: false` the shipped HP-1
trim short-circuits to `req.socket.remoteAddress ?? ''`, avoiding the header-lookup closure and the
`resolveClientIp` policy call — good. But it still dereferences `req.socket` (a getter) and retains a
string on every request for a property that the benchmark, and most handlers, never read. It is the
same waste that `ctx.raw` and `ctx.state` were converted away from. **P-04.**

### 5.2 The per-request timeout race — P-01

This is the finding. `createHandler`'s per-request closure, at HEAD:

```ts
if (timeout <= 0) {                       // ← not the default path
  handler(ctx).then(finalizeSuccess, finalizeError);
  return;
}

const TIMEOUT_SENTINEL = Symbol('timeout');          // ← ALLOCATION, per request
let timerId;
const handlerPromise = handler(ctx);
Promise.race([                                        // ← ARRAY + RACE PROMISE
  handlerPromise.then(() => {}),                      // ← DERIVED PROMISE + CLOSURE
  new Promise((resolve) => {                          // ← PROMISE + EXECUTOR CLOSURE
    timerId = setTimeout(() => resolve(TIMEOUT_SENTINEL), timeout);  // ← TIMEOUT OBJECT + CLOSURE + timer-list insert
  }),
])
  .then((result) => { clearTimeout(timerId); … })      // ← DERIVED PROMISE + CLOSURE + timer-list remove
  .catch((error) => { clearTimeout(timerId); … });     // ← DERIVED PROMISE + CLOSURE
```

`DEFAULT_TIMEOUT_MS = 30_000` (`packages/runtime/src/constants.ts`), and `serve()` defaults
`timeout = DEFAULT_TIMEOUT_MS`. The benchmark server calls `listen(app, PORT)` with no options.
**The race is the default path, on every request, for every NextRush application that does not
explicitly set `timeout: 0`.**

Per request this costs, counted from source:

| Item | Count |
| ---- | ----- |
| `Symbol` allocation | 1 |
| Promise allocations (`.then` ×2, `new Promise`, `Promise.race`, `.catch`) | ~5 |
| Closure allocations | 4 |
| Array literal | 1 |
| Node `Timeout` object + timer-list insertion | 1 |
| Timer-list removal (`clearTimeout`) | 1 |
| Additional microtask boundaries | ~3 |

**Approximately 11 heap allocations and 3 extra microtask hops per request, plus two timer-list
operations, to implement a 30-second timeout that fires on essentially zero requests.**

The `Symbol('timeout')` is the clearest single defect: symbols are never interned, it carries a
description string, and it is trivially hoistable to module scope. It is created fresh per request
purely as a private sentinel value — the one thing a module constant does perfectly.

### 5.3 Attribution

| | |
| --- | --- |
| Introduced by | `d97734e3` — *"feat(adapters): harden cross-runtime observable parity (F-01..F-09)"*, **2026-07-22** |
| Confirmed via | `git log -S 'TIMEOUT_SENTINEL' -- packages/adapters/node/src/adapter.ts` returns exactly this commit |
| Present in the benchmark? | **Yes** — the run is 2026-07-27, five days later |
| Why it was added | Prior audit finding F-04 (`report/adapters/runtime-platform-review.md`) observed that Bun/Deno/Edge/Serverless adapters all implement a handler-level `Promise.race` → `504` with `ctx.triggerTimeout()`, while Node relied only on socket-level `server.timeout`. The recommendation was to add the handler race to Node **and keep `server.timeout`**, documenting them as complementary. |
| Was the cost measured? | No evidence of any performance validation accompanying it. |
| Did the prior performance review see it? | **No** — its baseline was `1878042` with a 2026-07-18 benchmark, both predating `d97734e3`. |

**This is the key insight of the investigation.** The team ran a rigorous allocation-trim program
(HP-1…HP-18, then NF-1…NF-4) and shipped essentially all of it — including NF-1, which removed *one*
async frame and *one* microtask hop from the router→executor boundary. Four days later, a
correctness-motivated parity fix added roughly eleven allocations and three microtask hops to the
frame directly *above* it, with no benchmark gate to catch it. The parity requirement is legitimate
and must be preserved; the implementation chosen to satisfy it was never costed.

## 6. Bottleneck analysis (§4.6)

| Observation | Category | Severity |
| ----------- | -------- | -------- |
| Per-request `Promise.race` scaffolding for a timeout that almost never fires | Async overhead + allocation | **Critical** |
| `Symbol('timeout')` allocated per request | Allocation | Critical (trivial to fix) |
| `setTimeout`/`clearTimeout` pair per request | Allocation + timer subsystem work | Critical |
| `finalizeSuccess`/`finalizeError` closures allocated per request | Allocation | Low — they capture per-request state and are hard to hoist |
| `Application.callback()`'s `async` arrow adds a frame + `try/catch` above `compose` | Async overhead | Medium — the same de-async technique used for NF-1 applies here and has not been |
| Eager `ctx.ip` | Unnecessary work | Medium (**P-04**) |

**Explicitly not bottlenecks** (verified, not assumed):
- Context construction generally. Lazy `raw`, lazy `state`, shared `EMPTY_QUERY`, hoisted frozen
  options, stable property order. This is good work and should not be touched.
- `req.method.toUpperCase()`. The prior review measured 0 B/iter for already-uppercase input and I
  found no reason to overturn that; V8 fast-paths it. **Rejected as a finding.**
- `getRuntime()`. A cached 4-line accessor, not a detection routine.

## 7. Root cause candidates (§4.7)

**Primary — async overhead and allocation from a per-request timeout mechanism.** The chosen
mechanism scales its cost with request *count* when the requirement (bound a pathological handler)
only needs cost proportional to *pathological* requests. A timeout is by nature an exception path
being paid for on the happy path.

**Secondary — a process gap, not a code gap.** No performance gate stood between a parity fix and
the hot path. This is the durable root cause: without a pinned baseline and a regression check in
CI, the next parity or reliability fix can do the same thing. `07-optimization-roadmap.md` treats
this as a Phase 1 deliverable equal in priority to the code fixes.

**Confidence:** *Confirmed* — the mechanism, its default-on status, its allocation inventory, and its
commit attribution are all read directly from source and git. *Strong evidence* for it being a
material share of the +5.55 µs floor: it is by far the largest un-trimmed structure on a path where
everything else has been optimised, and the measured floor penalty and flat p99/p50 ratio are both
consistent with uniform extra per-request work. *Not Confirmed* for magnitude — no CPU or allocation
profile exists, so the claim "P-01 accounts for N of the 5.55 µs" cannot be made. Establishing N is
evidence item 2 in `02-runtime-profiling.md` §5.

## 8. Optimisation opportunities (§4.8)

Designs and alternatives in `05-solution-engineering.md` S-01 and S-04. Summary, in ascending
effort:

1. **Hoist `TIMEOUT_SENTINEL` to module scope.** One line. Zero behaviour change. Removes one
   allocation per request.
2. **Replace the `Promise.race` with a flag-and-callback pattern.** A single `settled` boolean, one
   `.then(onSettled, onError)` on the handler promise, and one timer whose callback checks the flag.
   Removes the array, the race promise, the inner `new Promise`, one derived promise and one closure
   — while producing byte-identical observable behaviour (504 body, `ctx.triggerTimeout()`, late
   rejection swallowed, no clobbering of a committed response).
3. **Replace the per-request timer with one shared coarse timer.** A single interval or timer wheel
   sweeps in-flight requests, giving O(1) amortised per-request cost, no per-request `Timeout`
   object, and no timer-list churn. Timeout precision degrades to the sweep granularity — which for
   a 30-second default is irrelevant.
4. **Make the timeout opt-in rather than opt-out.** Highest performance win, but it removes a
   cross-runtime parity guarantee that was deliberately added, so it is **not recommended** —
   documented in S-01 as a rejected alternative with reasons.
5. **De-async `Application.callback()`'s wrapper**, applying the NF-1 technique one frame up.
6. **Make `ctx.ip` a lazy getter** (P-04), mirroring the shipped `raw`/`state` pattern.

## 9. Edge cases reviewed (§4.9)

Each is a behaviour that any change to §5.2 must preserve. They are the reason the recommended fix
is "restructure the mechanism" and not "remove the timeout".

| Case | Current behaviour | Preserve? |
| ---- | ----------------- | --------- |
| Handler resolves without responding, status 404 | `finalizeSuccess` sends `{"error":"Not Found"}` with JSON content-type | Yes |
| Handler resolves without responding, other status | Sends bare status with `text/plain; charset=utf-8` — deliberately, so no response ever lacks a Content-Type (project rule §3) | Yes |
| Handler rejects | Logged, then `500` JSON if headers not yet sent | Yes |
| **Timeout wins the race** | `ctx.triggerTimeout()` cancels cooperatively via `ctx.signal`; `504` sent only if `!ctx.responded && !res.headersSent` | **Yes — the whole point of F-04** |
| **Handler rejects *after* the timeout responded** | `handlerPromise.catch(() => undefined)` swallows it so it cannot crash the process as an unhandled rejection | **Yes — easy to lose in a rewrite** |
| `timeout <= 0` | Race skipped entirely; behaviour identical to pre-F-04 | Yes — and this is the fast path that proves the race is separable |
| Client disconnects mid-request | Socket-level `server.timeout` and `res` events handle it; the race is unaware | Yes |
| Concurrent requests | All per-request state (`timerId`, `handlerPromise`, sentinel comparison) is inside the closure | **Yes — a shared timer wheel must key state per request, not per handler** |
| `proxy` configured | `getClientIp` routes through the shared `resolveClientIp` policy so precedence matches Bun/Deno/Edge | Yes — a lazy `ip` getter must still do this |

## 10. Investigation summary (§4.10)

| | |
| --- | --- |
| **Finding** | **P-01** — every request unconditionally allocates ~11 objects (a `Symbol`, ~5 promises, 4 closures, an array), creates and cancels a `setTimeout`, and traverses ~3 extra microtask boundaries to implement a 30-second timeout that fires on virtually no requests. **P-04** — `ctx.ip` is resolved eagerly for a property most handlers never read. |
| **Evidence** | Fixed floor 30.30 µs/req vs Fastify 24.75 and raw Node 22.71 (**+7.59 µs**, 3.7× Fastify's framework overhead); allocation inventory read in `createHandler` at HEAD; `DEFAULT_TIMEOUT_MS = 30_000` confirms default-on; `git log -S TIMEOUT_SENTINEL` attributes it to `d97734e3` (2026-07-22), five days before the run; p99/p50 ratio not elevated → uniform per-request cost, not pauses |
| **Root cause** | Async overhead + allocation: an exception-path mechanism paid on the happy path. Compounded by a process gap — no performance gate between a parity fix and the hot path. |
| **Runtime impact** | Present on **100% of requests** in every scenario. Largest single contributor to the fixed floor, which itself accounts for essentially the entire Hello World gap vs Fastify. |
| **Performance impact** | Hello World projected 28,917 → ~34,400 rps (+19%) if the floor reaches Fastify parity; every other scenario improves by the same absolute µs. |
| **Recommendation** | Hoist the sentinel; replace the race with a flag-and-callback; move to one shared coarse timer; de-async the `callback()` wrapper; make `ctx.ip` lazy. **Do not remove or default-disable the timeout** — the parity guarantee it provides was added deliberately. |
| **Trade-offs** | A shared timer wheel adds a bounded per-server data structure and reduces timeout precision to the sweep interval (immaterial at a 30 s default). Flag-and-callback is slightly less declarative than `Promise.race` and needs explicit tests for the nine §9 semantics — particularly late-rejection swallowing. |
| **Priority** | **Critical** — highest leverage in the framework (100% of requests) and the only un-trimmed structure left on an otherwise heavily optimised path |
| **Confidence** | Confirmed (mechanism, default-on status, attribution) / Strong evidence (share of the floor) / **not** Confirmed for magnitude — requires evidence item 2 |
| **Validation** | `06-validation-regression.md` V-01 — including a mandatory cross-adapter conformance run, because this code exists to satisfy a cross-adapter contract |

**Cross-references:** `request.md` (property access on the constructed Context),
`response.md` (the write path this lifecycle finalises), `04-root-cause-analysis.md` §2,
`05-solution-engineering.md` S-01/S-04.
