# Performance Investigation — Post-Audit Invariant Erosion on the Request Hot Path

| Field            | Value                                                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Report type**  | Performance                                                                                                                                                                                                                                 |
| **Scope**        | Delta investigation of the Node request hot path at HEAD, restricted to costs introduced by changes that landed **after** the existing investigation corpus was written                                                                      |
| **Date**         | 2026-07-31                                                                                                                                                                                                                                  |
| **Governed by**  | `docs/playbooks/PERF-001-performance-engineering-playbook.md` (authoritative)                                                                                                                                                                |
| **Commit / ref** | `feat/dev` @ `700549cbd89496c989e7ca342d353bc6907d3007`                                                                                                                                                                                      |
| **Status**       | Final — findings measured; remediation not implemented                                                                                                                                                                                      |
| **Related**      | `reports/investigations/performance-investigation-reconciliation.md` (the corpus tracker) · `report/core/context-review.md` (V-02, corrected here) · `report/core/core-hot-path-performance-review.md` (§7 mount note, superseded here) · RFC-029 · ADR-0010 |

**Evidence labels** (continuing the corpus convention, applied strictly):

| Label | Meaning |
| ----- | ------- |
| **[M] Measured** | Measured in this investigation, deterministic harness, numbers reproduced below |
| **[D] Derived** | Arithmetic on a measured figure |
| **[S] Structural** | Read in source at `700549c`; mechanism confirmed, cost not measured |
| **[R] Refuted** | Hypothesised, then **contradicted** by measurement in this investigation |

> **Measurement scale disclosure (mandatory, per the corpus's own rule).** Every number below comes
> from a dev-scale, **unpinned** run on a shared machine. Under the corpus's rule these are
> `publishable: false` — cite them as "a quick check measured X", never as a benchmark-table entry.
> Two properties make them load-bearing anyway: the allocation and shape tests are **deterministic**
> (cv 0.0%), and the one timing claim rests on a **4.0× within-process, interleaved** effect that
> exceeds the ±25–58% between-batch drift the corpus documents by more than an order of magnitude.
> Harness: single throwaway script, `node --expose-gc --allow-natives-syntax`, 5 interleaved rounds,
> N = 200,000 (allocation) / 40,000 (dispatch) / 1,000,000 (decode), `NODE_ENV=production`. It was
> deleted after use; §8.1 recommends promoting two of its tests into permanent harnesses.

---

## 1. Executive Summary

**Target subsystem:** the per-request path spanning `@nextrush/adapter-node` → `@nextrush/core`
(mount) → `@nextrush/router` (dispatch) → `@nextrush/runtime` (query).

**Primary issue.** NextRush already has three completed performance investigations and a
reconciliation pass tracking 12 recommendations at ~83% closed. Re-running the full playbook would
re-derive settled findings, so this investigation asked a narrower question instead:

> Which changes landed *after* the audits, and did any of them cross an invariant an earlier audit
> had already established and proven?

**Four did, and they share one root cause** (§7): each was individually correct, individually
reviewed, and *never re-checked against a hot-path invariant a prior audit had already proven*. The
repository has excellent per-subsystem optimization discipline and excellent audit discipline, and
no mechanism connecting the two across time.

**Highest-priority finding — F-1 (Critical).** Per-request dispatch cost grows **linearly with the
number of mounted routers**. Measured: 1,608 ns (root mount) → 2,263 ns (1 prefix mount, **+41%**)
→ 4,088 ns (5 mounts) → 6,425 ns (10 mounts, **4.0×**), ≈ **+475 ns per mounted router** [M]. The
cause is that RFC-029's mount-boundary security fix routes every mount test through
`canonicalizePath`, **twice per mount per request**, one of those on a value that is constant for
the process lifetime. The shape that pays this is `app.route('/users', users)` — the form the README
teaches — while `apps/benchmark` exercises only `app.route('/', router)`, which
`Application.route()` short-circuits. **The regression is real, it scales with application size, and
the benchmark suite is structurally incapable of seeing it.**

**Two claims I raised and then refuted by measurement**, reported prominently because PERF-001 §2.11
and §4.11 require it:

- The `ctx.originalPath` property addition was hypothesised to cost an extra heap allocation per
  request. **Measured: 1064.15 vs 1064.13 B/req, cv 0.0% — no allocation difference. [R]** What
  survives is a hidden-class transition (§6, F-3), whose cost is bounded and small.
- The same property addition was hypothesised to fragment inline caches broadly. **Measured:
  contexts that have both been mutated share one map — the transition is shared, so IC breadth is
  bounded at 2, not unbounded. [R]**

**Expected impact.** F-1 is worth ~40% of dispatch cost for a single-prefix app and ~75% for a
ten-mount app, on a path no benchmark covers. F-2 is a deterministic 171 B/req. F-4 is ~113 ns per
query key *and* per value. F-3 is not a throughput item and should be justified as invariant
restoration, not as a win.

**Recommended order:** F-1 → F-4 → F-2 → F-5 → F-3, then the preventive gate in §8.1 that addresses
the shared root cause. Full rationale in §11.

---

## 2. Problem Statement

**What was investigated.** Whether the Node request hot path at `700549c` carries costs that the
existing corpus does not describe, with the corpus treated as prior art rather than as truth.

**Why it matters.** PERF-001 §5.5 requires re-profiling critical execution paths after
architectural changes. Three architectural changes landed after the corpus was written — RFC-029
(canonical request path), the F-05 graceful-drain wrapper, and Recommendation 10's walk pooling —
and no re-profiling pass followed any of them. §5.5 was, in effect, unexecuted.

**Which workload exposed it.** None — and that is itself the finding. F-1 lives on an execution
shape (`app.route('/prefix', router)`) that **no benchmark scenario constructs**. It was found by
execution-flow reconstruction (PERF-001 §2.5), not by benchmark analysis (§2.3), because §2.3 could
not have found it. The gap is recorded as F-6.

**Expected outcome.** A measured, prioritized set of findings, plus a correction to two documents in
the corpus that current source contradicts.

---

## 3. Benchmark Analysis

Per PERF-001 §2.3, benchmark evidence was reviewed first. The conclusion is negative and is the
most important input to this report.

`apps/benchmark/servers/nextrush-v3.js:157` ends with:

```js
app.route('/', router);
```

`packages/core/src/application.ts:389-393`:

```ts
route(path: string, router: Routable): this {
  this.assertConfigurable('route');
  // Root mount optimization: skip all prefix processing
  if (path === '/' || path === '') {
    this.middlewareStack.push(router.routes());
    return this;
  }
  // ... createPrefixMount(...) for every other prefix
```

So all 13 scenarios measure the **root-mount fast path**. `createPrefixMount` is never executed by
any benchmark. Correlating across scenarios (§2.3's requirement) therefore yields nothing for F-1:
every scenario is equally blind to it.

Second-order consequence worth stating plainly: the benchmark's own source comments show deep,
correct measurement awareness — the static-file registration comment documents a measured 2.1×
throughput loss from an `app.use()` layer and a +725 B/req cost from dropping off `compose()`'s
`len === 1` fast path. That care is exactly why the blind spot matters: the suite was tuned to keep
the middleware stack at one entry, which is *also* the configuration that makes the mount path
unreachable. Optimising the harness for fairness inadvertently optimised it away from the shape real
applications use.

| Scenario | Exercises `createPrefixMount`? | Exercises F-2 (drain wrapper)? | Exercises F-4 (query decode)? |
| -------- | ------------------------------ | ------------------------------ | ----------------------------- |
| hello-world, json, large-json, send-object, empty | No | **Yes** | No |
| route-params, deep-route | No | **Yes** | No |
| search | No | **Yes** | **Yes** |
| post-json, large-post | No | **Yes** | No |
| middleware, error, static-file | No | **Yes** | No |

`serve()` installs the F-2 wrapper unconditionally, so every scenario pays it — and
`report/benchmark/benchmark-fastify-measurement-validity-review.md:189` confirms it was deliberately
left enabled for fairness, which was the right call.

---

## 4. Architecture Overview

Package hierarchy is unchanged from `architecture.instructions.md` and was re-confirmed via the
code graph. Relevant ownership for this investigation:

| Concern | Owner at `700549c` | Note |
| ------- | ------------------ | ---- |
| Socket → handler, drain | `adapters/node/src/adapter.ts` | F-2 lives here |
| Mount boundary | `core/src/route-mount.ts` + `core/src/application.ts` | F-1, F-5 |
| Canonicalization (single owner, RFC-029) | `router/src/canonicalize.ts` | called from 3 places per request |
| Dispatch, `ctx.originalPath` | `router/src/dispatch.ts` | F-3 |
| Tree walk | `router/src/matching.ts` **and** `router/src/walk-pool.ts` | F-7: two copies |
| Query parse | `runtime/src/query.ts` | F-4 |

RFC-029 made `canonicalizePath` "the single normalization owner," which is architecturally correct —
one definition of "the same path" is a genuine security property (SEC-02/09/15). The defect is not
the ownership; it is that **ownership was centralised without memoisation**, so correctness was
achieved by calling the owner more often rather than by calling it once and sharing the result.

---

## 5. Execution Flow

Reconstructed per PERF-001 §2.5. `▲` marks work introduced after the corpus was written.

```text
             ROOT MOUNT (all 13 benchmarks)          PREFIX MOUNT (README golden path)
             ════════════════════════════════        ════════════════════════════════════

  node:http  ─ wrappedHandler ▲ F-2                  ─ wrappedHandler ▲ F-2
                 res.writeHead.bind(res)                  (identical)
                 res.writeHead = (...args)=>{}
                 +171 B/req [M]
                      │                                        │
             ─ createHandler                          ─ createHandler
                 setTimeout(30_000)  ← known P-01          (identical)
                      │                                        │
             ─ new NodeContext                        ─ new NodeContext
                 1064 B/req [M]                            (identical)
                 indexOf('?')  ← path scan #1              path scan #1
                      │                                        │
             ─ compose() len===1 fast path            ─ compose() len===N mounts
                      │                                        │
                      │                               ─ createPrefixMount        ▲ F-1
                      │                                   matchesMountPrefix
                      │                                     canonicalizePath(path)   #2
                      │                                     canonicalizePath(PREFIX) #3 ← constant!
                      │                                   ctx.state materialised  ▲ F-5 [M]
                      │                                   2 symbol writes + 2 resets
                      │                                   async frame + next closure
                      │                                   ×  EVERY MOUNT until one matches
                      │                                        │
             ─ createRoutesMiddleware                 ─ createRoutesMiddleware
                 canonicalizePath(path)  #2               canonicalizePath(path)  #4
                 ctx.originalPath = …  ▲ F-3              (identical)
                 map transition [M]
                      │                                        │
             ─ matchRoute(preNormalized=true)         ─ matchRoute(preNormalized=true)
                 → matchNodeIndexedPooled ▲ F-7            (identical)
                      │                                        │
             ─ executor → handler → ctx.json         ─ executor → handler → ctx.json
                      │                                        │
             1,608 ns/req [M]                        2,263 ns (1 mount) … 6,425 ns (10) [M]
```

Each `canonicalizePath` call performs `indexOf('?')` + `hasDotSegment` (full linear scan) +
`isProvablyLowerAscii` (full linear scan) + `collapseAndStrip` (`includes('//')` + `endsWith`) — so
"one call" is **four passes over the path string** [S].

---

## 6. Findings

### F-1 — Prefix-mount dispatch is O(number of mounted routers) · **Critical**

**Description.** `Application.route('/prefix', r)` installs `createPrefixMount`, whose boundary test
delegates to `Router.matchesMountPrefix` (`router/src/router.ts:238-252`):

```ts
const canonical = canonicalizePath(path, this.opts.caseSensitive, this.opts.strict);
if (canonical.rejected) return undefined;
const canonicalPrefix = canonicalizePath(prefix, this.opts.caseSensitive, this.opts.strict).path;
```

Two full canonicalizations per mount per request. The second operates on `prefix`, which is fixed
at registration time. A **non-matching** mount pays both before falling through to the next, so a
request that matches the tenth of ten mounts pays twenty canonicalizations plus the one in
`createRoutesMiddleware`.

**Evidence [M]** — 5 interleaved rounds, 40,000 dispatches per round, request `/api/v1/users/42`
matching the last mount; every variant sanity-gated to `status: 200, responded: true` first:

| Mount configuration | ns/req (mean) | cv | vs root | Δ per added mount |
| ------------------- | ------------- | -- | ------- | ----------------- |
| `app.route('/', r)` (benchmark shape) | **1,607.9** | 8.1% | — | — |
| 1 prefix mount | **2,262.9** | 7.9% | **+40.7%** | +655 ns |
| 5 prefix mounts | **4,088.1** | 1.6% | **+154%** | +456 ns/mount |
| 10 prefix mounts | **6,424.8** | 14.3% | **+300%** | +473 ns/mount |

Growth is linear at ≈ **+475 ns per mounted router** [D]. Allocation was also sampled but is
reported as **inconclusive** — cv reached 33.2% and the series was non-monotonic (prefix10 measured
*below* root), which is a methodology failure of the heap-delta approach under retained context
arrays, not a result. Timing is the decisive metric here.

**Performance impact.** A 10-feature-module application — an entirely ordinary shape, and the one
`registerModule`/`@Module` actively encourages — spends ~75% of its framework dispatch time deciding
which mount to enter.

**Affected subsystem.** `@nextrush/core` (mount) + `@nextrush/router` (canonicalization). Neither
package alone is at fault; the cost is in their interaction.

**Benchmarks affected.** **None** — see F-6.

**Severity: Critical** per PERF-001 §4.10 (major architectural bottleneck, high-frequency execution
path). Note this is severity on the *production* path; on the benchmarked path it is zero.

> ### ✅ FIXED (2026-07-31) — slope cut ~68%, and the finding is now benchmarked
>
> **The measurement gap closed first.** `apps/benchmark/scripts/alloc/mount-scaling.js`
> (`pnpm bench:mount-scaling`) measures ns/req against mount count with interleaved rounds. It
> reproduced this finding independently before any fix — **557.0 ns per added mount** against the
> report's original ~475 — which makes it a real gate rather than a one-off harness. Unlike the RPS
> factorial in the sibling report, a pinned interleaved *timing* microbench reproduces cleanly on a
> noisy host.
>
> **The cost decomposition was checked before fixing, and it vindicated this section.** I initially
> doubted that two canonicalizations could account for 557 ns, since `collapseAndStrip` is
> allocation-free on canonical input. Measured **[M]**: `canonicalizePath(path)` = **210.5 ns**,
> `canonicalizePath(prefix)` = **150.2 ns**, versus **~71 ns** for an async pass-through frame. The
> cost is real and it is dominated by canonicalization — largely because each call allocates its own
> `{ rejected, path }` result object. **360.7 of the 557 ns per mount was the two canonicalizations.**
>
> **What shipped — design B plus a bounded form of design A, no Context contract change:**
> 1. **B** — `matchesMountPrefix` memoizes the canonical form of `prefix`, which is fixed at
>    registration time (two fields on `Router`, so a miss stores without allocating). Memoized rather
>    than precomputed at `route()` time so the `Routable.matchesMountPrefix` contract still accepts any
>    prefix string from any caller.
> 2. **A′** — `canonicalizePath` memoizes its most recent result, keyed on **all three** inputs. This
>    is what removes the O(mounts) term: N mounts asking for the same path now canonicalize once.
>    B was a prerequisite — without it the single entry thrashes as calls alternate path/prefix.
>
> Design A as written (declare `canonicalPath` on the Context contract) was **not** taken: it is
> RFC-gated public API, and the obvious alternatives were worse — `ctx.state` would materialize the
> lazy state this report's own F-5 flags, and an undeclared `ctx` property would reintroduce the F-3
> shape transition just fixed.
>
> **Measured [M]**, `pnpm bench:mount-scaling`, pinned, interleaved:
>
> | | slope per added mount | 10 mounts vs root |
> | --- | --- | --- |
> | before | **557.0 ns** | +187% |
> | after | **~130–210 ns** (three runs: 128.6 / 190.5 / 210.4) | +77% → +90% |
>
> ≈**68% of the slope removed**, and the residual matches the prediction: 557 − 361 = 196 ns, against
> ~177 ns measured mean. That residual is **one `async` mount frame per mount**, not canonicalization.
> Driving it to zero needs design C (one dispatcher over all mount prefixes), which trades mount-order
> transparency for asymptotics and is not justified yet — so the gate threshold (320 ns/mount) is set
> to catch a **return to per-mount canonicalization**, not to demand an O(1) the architecture does not
> offer.
>
> **The hazard this section flags was handled explicitly, with tests.** A memo is only sound if it can
> never differ from recomputing, and the risk is options: `caseSensitive`/`strict` change the answer
> for the same string, and routers with different options can be mounted in one app. 11 tests in
> `packages/router/src/__tests__/canonicalize-memo.test.ts` pin exactly that, including interleaved
> calls from two routers with opposite `caseSensitive`. Sharing the result object is sound because
> `CanonicalPathResult` declares both fields `readonly` and all three call sites were verified
> read-only.
>
> Verified: router 368, core 189, adapters/node 251, conformance 290, class 316, csrf 170 — the CSRF
> suite matters because its exclude-path match is the third `canonicalizePath` consumer.


---

### F-2 — `serve()` rewrites `res.writeHead` on every request for a once-per-process condition · **High**
**Description.** `adapters/node/src/adapter.ts:478-494` installs a per-request interceptor so a
response completing *during* a drain advertises `Connection: close`:

```ts
const originalWriteHead = res.writeHead.bind(res);
res.writeHead = ((...args) => {
  if (drainState.draining && !res.headersSent) res.setHeader('Connection', 'close');
  return originalWriteHead(...args);
}) as ServerResponse['writeHead'];
```

Per request: one bound function, one arrow closure, one rest-args array per `writeHead` call, and
one property store. `drainState.draining` is `false` for the entire life of the process except
during shutdown. This is PERF-001 §3.8's question — "is normal execution paying for exceptional
paths?" — answered in the affirmative, on 100% of requests.

**Evidence [M]** — 5 rounds, N = 200,000, deterministic:

| Variant | B/op | cv |
| ------- | ---- | -- |
| Response object + `writeHead(200, {...})`, no wrapper | **608.01** | 0.0% |
| Same + the shipped wrapper | **778.99** | 0.0% |
| **Delta** | **+170.98 B/req** | 0.0% |

**Hidden-class effect: not established.** My harness's `%HaveSameMap` sub-test returned "no
transition", but the test is **invalid by construction** — the harness's fake `res` carries
`writeHead` as an *own* property, so assigning it is a value transition, whereas on a real
`ServerResponse` `writeHead` lives on the prototype and assigning it is an own-property *addition*.
The allocation figure is unaffected by this (bind + closure + rest array are receiver-independent).
The shape question is left open and is listed in §10 as required further evidence.

**Severity: High** — unconditional, deterministic, on every response, removable with no behaviour
change.

> ### ✅ FIXED (2026-07-31)
>
> The wrapper is retained — it has to be, because a request already in flight when a drain begins must
> still pick up `Connection: close` on its own response, and `res.writeHead` is the only interception
> point that covers every response path (`ctx.json`, `send`, streaming, and Node's `_implicitHeader`
> for a bare `res.end()`). What was removed is its three per-request **allocations**: one
> `drainAwareWriteHead` is now defined once per `serve()` instead of per request, the original is
> stashed under a module-level symbol as a plain reference rather than a `bind`, and the arity is
> explicit rather than rest-args.
>
> **Measured [M]**, 5 rounds, `taskset -c 2-5`: wrapper cost **192.23 → 40.00 B/req**, i.e.
> **−152.23 B/req (79.2%)**, cv ≤0.08%. The residual 40 B is the symbol property store, kept
> deliberately — reading the original off the prototype instead would remove it but would stop
> chaining to any earlier instance-level patch, which the `bind` form did.
>
> **The open shape question from this section is now answered.** The concern was that assigning
> `writeHead` to a real `ServerResponse` is an own-property *addition*. It still is — the new form
> makes two such additions (the symbol and `writeHead`) rather than one. That is deliberate: the
> transition is **uniform across every response**, so it is shared, and by the same reasoning this
> report applies to F-3's `originalPath`, sites reading a response stay monomorphic within themselves.
> Allocation, not shape, was the removable cost, and it is the one that was removed.
>
> Verified by 251 passing `adapters/node` tests including the graceful-shutdown and
> `idle-keepalive-drain` suites, plus 290 conformance tests.

---

### F-3 — `ctx.originalPath` transitions the context's hidden class on every request · **Low** (and two sub-claims refuted)

**Description.** `router/src/dispatch.ts:73` performs `(ctx as { originalPath: string }).originalPath
= originalPath`. `originalPath` is declared on the `Context` **interface**
(`types/src/context.ts:109`, optional) but is **not** a field of `NodeContext` or `WebContextBase`,
so it is added as a new own property to a freshly constructed context on every request, in every
adapter.

This contradicts `report/core/context-review.md` V-02, titled *"Object shape is stable; hidden
classes are preserved (runtime-confirmed)"*, which enumerated the compiled class body and concluded
"**every slot is defined at construction** … a value transition on an existing slot, not a property
addition." `originalPath` is absent from that enumeration because V-02 audited the context package
while the property is added by the router package — the exact failure mode PERF-001 §3.14 and the
prompt's own "never investigate a subsystem in isolation" rule exist to prevent.

V-02's runtime evidence also could not have detected it: `--trace-deopt` reports deoptimizations,
and a *uniform* property addition need not deoptimize anything. The tool could not observe the
property being claimed.

**Evidence [M]** — `%HaveSameMap` under `--allow-natives-syntax`:

| Probe | Result | Reading |
| ----- | ------ | ------- |
| two fresh contexts | `true` | baseline: one shared map ✓ |
| after `ctx.originalPath = …` | **`false`** | **property addition transitions the map — V-02's premise is false** |
| after `ctx.path = …` (declared field) | `true` | control: declared writes do not transition ✓ |
| two contexts that both got `originalPath` | `true` | **the transition is shared** |

**Sub-claim REFUTED [R] #1 — no allocation cost.** N = 200,000, 5 interleaved rounds:

| Variant | B/req | cv |
| ------- | ----- | -- |
| context + declared `path` write | 1064.15 | 0.0% |
| context + declared `path` + **`originalPath` addition** | **1064.13** | 0.0% |
| context + two declared writes (control) | 1062.82 | 0.2% |

The hypothesised extra `PropertyArray` allocation **does not occur** — V8 has in-object slack for
it. A 0.02 B/req difference at cv 0.0% is zero.

**Sub-claim REFUTED [R] #2 — IC fragmentation is bounded, not broad.** Because the transition is
shared (row 4 above), the steady state is: sites reading `ctx` *before* dispatch see map A, sites
reading it *after* see map B, and both are monomorphic within themselves. Worst case is 2-way
polymorphism at sites straddling dispatch — not the shape explosion a naive reading suggests.

**Severity: Low.** The residual cost is one map transition per request, unmeasured and probably
single-digit nanoseconds. **The honest justification for fixing it is not throughput — it is that a
documented, tested, cited architectural invariant is currently false, and the fix is one declared
field per adapter.** PERF-001 §1.3 excludes documentation from scope; it does not exclude a
*false* invariant that future optimization work will be built on top of.

> ### ✅ FIXED (2026-07-31)
>
> `readonly originalPath: string` is now declared on both `NodeContext`
> (`adapters/node/src/context.ts`) and `WebContextBase` (`runtime/src/web-context-base.ts`) and
> initialized to `path` in each constructor — the documented value when no router has canonicalized
> the target. Dispatch's write is now a value write to an existing slot.
>
> **Verified [M]** with `%HaveSameMap` under `--allow-natives-syntax`, against real `NodeContext`
> instances:
>
> | Probe | Before | After |
> | ----- | ------ | ----- |
> | two fresh contexts | `true` | `true` |
> | after `ctx.originalPath = …` | **`false`** | **`true`** ✓ |
> | `originalPath` defaults to `path` | n/a (absent) | `true` |
>
> V-02's invariant — "every slot is defined at construction" — is true again. No throughput claim is
> made, consistent with the severity assessment above.

---

### F-4 — The query parser lacks the `%`-fast-path its sibling module already has · **High**

**Description.** `runtime/src/query.ts:33-40` decodes unconditionally:

```ts
function safeDecodeURIComponent(str: string): string {
  try { return decodeURIComponent(str.replaceAll('+', ' ')); } catch { return str; }
}
```

`router/src/matching.ts:29` fast-paths the identical concern:

```ts
export function decodeParam(value: string, decode: boolean): string {
  if (!decode || !value.includes('%')) return value;
  ...
}
```

One module learned the lesson; the other did not. Called once per key **and** once per value.

**Evidence [M]** — the *pattern* measured on a no-`%`, no-`+` input (`'hello'`), 1,000,000
iterations × 5 interleaved rounds, two independent process runs:

| Variant | Run A ns/call | Run B ns/call |
| ------- | ------------- | ------------- |
| Current shape (unconditional decode) | 221.7 (cv 24.8%) | 141.7 |
| With router-style `%`/`+` guard | **47.9** (cv 33.0%) | **28.8** |
| Ratio | **4.6×** | **4.9×** |

Absolute values are noisy on an unpinned host; the **ratio is stable at 4.6–4.9× across independent
runs**, and the delta (~113 ns/call, Run B) is large relative to the 1,608 ns full root-mount
dispatch. For `/search?q=hello&limit=10` — 2 keys + 2 values = 4 calls — that is ≈ **450 ns/request,
~28% of measured dispatch cost** [D], on the one benchmark scenario that carries a query string.

**Caveat:** this measured a faithful re-implementation of `safeDecodeURIComponent`, not the module
itself. Confirming against the real module is a one-line change to the harness and is listed in
§10.

**Severity: High** — measurable, isolated, one guard clause, precedent already in the codebase, and
it maps to a real benchmark scenario.

> ### ✅ FIXED (2026-07-31)
>
> `safeDecodeURIComponent` now opens with
> `if (!str.includes('%') && !str.includes('+')) return str;` — guarding on **both** characters, as
> §8 specified. The §10 caveat is also discharged: the guard was added to the real module, not a
> re-implementation, and behaviour is pinned byte-identical by 6 new tests in
> `packages/runtime/src/__tests__/query-container.test.ts` (`+`→space, `%20`→space, UTF-8
> `%E2%9C%93`→`✓`, mixed `+`/`%`, malformed-encoding fallback, plain value untouched), plus a live
> `/search` check.
>
> Note the severity was **overstated**. The sibling report
> (`2026-07-31-measured-floor-params-compliance/03` §6) corrects it to **P3**: NextRush already beats
> Fastify on the `query-string` scenario by 3.37 µs @1 and 0.63 µs @256, so this was a free win on a
> path that was not a deficit — not a High-priority gap.

---

### F-5 — The prefix mount defeats the shipped lazy-`ctx.state` optimization · **Medium**

**Description.** `core/src/route-mount.ts:81-83` writes two symbol keys onto `ctx.state`. `state` is
a lazy getter (`_state ??= {}` — the NF-2 optimization, shipped and measured by
`report/core/context-review.md`), so the write **materializes** it. Every prefix-mounted request
allocates the object NF-2 exists to avoid.

**Evidence [M]** — binary probe of the private `_state` backing field after one dispatch:

| App shape | `_state` materialized? | symbol keys |
| --------- | ---------------------- | ----------- |
| `app.route('/', r)` | **false** | 0 |
| `app.route('/api', r)` | **true** | 2 |

`report/core/context-review.md` V-03 noticed the mechanism ("Prefix-mount symbol-key writes go
through the getter (materialize then write)") but framed it as *no shape divergence* — correct, and
it missed that NF-2's saving is nullified for the class of apps that mount at a prefix.

**Severity: Medium** — one object per request, only on prefix-mounted apps, and the state is used
solely to restore `ctx.path`, which two local variables already hold.

---

### F-6 — The mount path has no benchmark coverage · **High** (missing measurement, PERF-001 §5.5)

Every scenario uses the root-mount short-circuit (§3). F-1 and F-5 are therefore invisible to
`bench:validate`, `bench:compare`, and `check-regression.js`. A future change could make mount
dispatch arbitrarily worse with no signal. This is the `<missing_analysis>` category "missing
benchmarks", and it is the reason F-1 survived three prior investigations.

---

### F-7 — Two maintained copies of the tree walk; the original is unreachable · **Low** (maintainability)

`walk-pool.ts:matchNodeIndexedPooled` (120 lines) and `matching.ts:matchNodeIndexed` (102 lines) are
the same stage machine. Reachability at `700549c` [S]:

- `trace_path` inbound on `matchNodeIndexed` → sole caller is `matchRoute`.
- `matchRoute` reaches the walk only when `hasParamRoutes === true`.
- `Router.addRoute` (`router.ts:113-119`) builds `state.walkPool` whenever `maxDepth` grows, which
  happens on the first registered route; `resolveMatch` always forwards `state.walkPool`.

⇒ the unpooled branch is **unreachable from any dispatch path**. Two hand-synchronised copies of the
framework's most safety-critical loop (explicitly non-recursive for DoS resistance) remain, one of
them never exercised by production traffic.

PERF-001 §1.3 arguably scopes this out (it is not a runtime cost). It is recorded under §5.5
("document known performance-sensitive areas") because a silent divergence between the two copies
would be a correctness bug on the hot path.

---

## 7. Root Cause Analysis

Per PERF-001 §4.6, each finding traces to an underlying cause — and four of them trace to the
*same* one.

```text
  SYMPTOM      dispatch cost grows with mount count; a drain wrapper taxes every
               response; a proven shape invariant is false; a dead matcher copy persists
                                   │
                                   ▼
  EVIDENCE     §6 measurements: 4.0× at 10 mounts · +171 B/req · map transition
               confirmed · reachability trace
                                   │
                                   ▼
  TECHNICAL    RFC-029 centralised canonicalization without memoising its result
  CAUSE        F-05 chose per-request interception over a shared flag read
               dispatch.ts assigns an undeclared property
               Rec-10 added a pooled walk beside the original instead of replacing it
                                   │
                                   ▼
  ARCHITECTURAL   Every one of these changes was correct in isolation, reviewed in
  CAUSE           isolation, and shipped without re-validating a hot-path invariant a
                  PRIOR audit had already established and proven. The corpus records
                  invariants (V-02 "stable hidden class", NF-2 "lazy state", the mount
                  note's "allocation-light") as CONCLUSIONS IN PROSE. Prose cannot fail
                  a build. Nothing re-checks them when a later, unrelated change crosses
                  the same path — and PERF-001 §5.5's "re-profile critical execution
                  paths after architectural changes" has no executable form.
                                   │
                                   ▼
  LONG-TERM    The audit corpus decays silently. Each investigation is more expensive
  IMPACT       than the last because it must first re-establish which prior conclusions
               still hold. Two documents are already wrong at HEAD. The next
               optimization built on V-02's "stable shape" premise will be built on sand.
```

**Architectural vs implementation-specific.** F-2, F-3, F-5 and F-7 are implementation-specific and
individually small. **F-1 is architectural**: it is a consequence of where canonicalization
ownership was placed relative to where its result is consumed, and no amount of micro-optimizing
`hasDotSegment` fixes it. The shared cause in the diagram above is architectural at the *process*
level, which is why §8.1 proposes a gate rather than only patches.

---

## 8. Optimization Proposals

### F-1 — three designs

| | **A. Memoize on Context** *(recommended)* | **B. Precompute prefix only** | **C. Registration-time mount trie** |
| --- | --- | --- | --- |
| Change | Declare `canonicalPath` on the Context contract; canonicalize **once** (adapter or first consumer); mount test and dispatch read the field | Canonicalize `prefix` at `route()` time, keep the per-request path canonicalization | Build one trie over all mount prefixes; a single lookup selects the mount |
| Removes | 2 of 3–21 canonicalizations; makes cost **O(1) in mount count** | ~50% of mount cost; **still O(N)** | O(N) → O(k); also removes the per-mount async frame |
| Complexity | Low — one field + guard | Very low — 2 lines | High — new structure, ordering/overlap semantics |
| Maintainability | **Improves** — makes "canonicalize once" structural, not a convention | Neutral | Reduces mount-order transparency |
| Compatibility | Additive field; RFC-029's `{rejected, path}` contract untouched | None | `app.use()`/mount ordering interactions need care |
| Risk | Low; staleness risk if a consumer rewrites `ctx.path` (see below) | Very low | Medium-high |
| Scalability | 100 mounts free | 100 mounts still linear | Best asymptotically |

**Why A.** It removes work rather than accelerating it (PERF-001 §5.1, first question in the
decision sequence) and moves the remaining work to the earliest point it can be done once. C is
asymptotically better but violates §5.1's later gates — significant complexity for a case (100+
mounts) nobody has yet. **A and B compose**: do both; B is two lines and is strictly implied by A's
"canonicalize once" principle applied to the prefix.

**The one real hazard.** `createPrefixMount` deliberately rewrites `ctx.path` around the mount
boundary, so a memoized canonical path must be invalidated or scoped there — otherwise the mounted
router matches against a stale canonical value. This is precisely the bug class RFC-029 exists to
prevent, so it must be handled explicitly, with a test, not assumed away. Concretely: memoize
keyed to the path value it was derived from, and recompute when `ctx.path` differs.

### F-2 — two designs

**A (recommended):** pass the mutable `drainState` reference through the already-hoisted, frozen
`contextOptions` and read the boolean inside `NodeContext`'s own header-write path. Removes the bind,
the closure, the rest array, and the patched core object. Same-package change; `Connection: close`
semantics identical; **expected −171 B/req [D]**.
**B:** track in-flight responses in a `Set` and patch only those live at drain start. Removes the
steady-state cost but adds a `Set` add/delete per request — trades one per-request cost for another.
A is strictly better.

### F-3 — one design, trivial

Declare `originalPath` on `NodeContext` and `WebContextBase` and initialize it in the constructor
(to `path`, matching the documented "absent, or equal to `path`, when no router has run" contract).
Restores a single map. **No throughput claim is made** (§6, F-3).

### F-4 — one design, with the precedent already in-tree

Add the `decodeParam`-style guard to `safeDecodeURIComponent`. Must guard on **both** `%` and `+`
(form-encoding), unlike `decodeParam` which only needs `%`. **Expected ~113 ns saved per key/value
on non-encoded input [M]**; zero effect on encoded input; behaviour byte-identical.

### F-5 — one design

Drop the two `ctx.state` symbol writes. `createPrefixMount` already holds `currentPath` and
`adjustedPath` in local variables and restores from them in its `finally`; the symbols are written
and cleared but never read anywhere in `packages/` [S — worth a consumer check before removal, since
`Symbol.for` makes them cross-realm reachable by third-party code, which is an undocumented but
real API surface].

### F-7 — one design

Delete `matching.ts:matchNodeIndexed`'s inline stage machine; make it a thin delegator to the pooled
implementation (constructing a one-shot pool when none is supplied, preserving the documented
"omitted → behaves exactly as before" contract for any external caller).

### 8.1 Preventive — the fix for the shared root cause *(the highest-value item in this report)*

Every finding above is an instance of "a prose invariant nobody re-checks." Make the invariants
executable, in `packages/adapters/conformance` where cross-adapter behaviour is already pinned:

1. **Shape-stability assertion** — after a full dispatch, assert the context's map equals a
   freshly-constructed context's map (`%HaveSameMap`, or a property-name-set comparison for a
   natives-free version). F-3 would have failed this the day RFC-029 landed.
2. **Lazy-field assertion** — assert `_state` / `_raw` / `_bodySource` are unmaterialized after a
   dispatch that does not touch them, **for both root and prefix mounts**. F-5 would have failed.
3. **Mount-scaling benchmark arm** — add a prefix-mounted server to `apps/benchmark/servers/` and a
   scenario that dispatches through it. Closes F-6 and would have caught F-1.
4. **Promote two harness tests** from this investigation into `apps/benchmark/scripts/alloc/`:
   mount-scaling (ns/req vs mount count) and drain-wrapper allocation. Both are deterministic.

This converts PERF-001 §5.5 from a recommendation into a gate — which is what §5.5 needs to
survive contact with a 35-package monorepo.

---

## 9. Risk Assessment

| Item | API compat | Runtime behaviour | Complexity | HTTP compliance | Security | Regression risk |
| ---- | ---------- | ----------------- | ---------- | --------------- | -------- | --------------- |
| F-1 A | Additive field on `Context` | Identical **iff** the mount's `ctx.path` rewrite invalidates the memo | Low | None | **Elevated — this is RFC-029's exact bug class.** A stale canonical path is a path-desync vulnerability, not just a wrong route. Requires the RFC-029 security tests plus a new stale-memo test | Medium |
| F-1 B | None | Identical | Very low | None | None | Very low |
| F-2 A | None (internal) | Identical; `Connection: close` still decided at response time | Low | Preserved | None | Low |
| F-3 | Field already on the interface | Identical | Trivial | None | None | Very low |
| F-4 | None | Identical (guard is a provable no-op on guarded input) | Trivial | None | **Verify**: guard must not skip decoding of an encoded `+`; the security review's fail-open note on `safeDecodeURIComponent` still applies | Low |
| F-5 | **`Symbol.for('nextrush.originalPath')` is cross-realm reachable** — undocumented but removable-by-third-party-observation | Identical internally | Trivial | None | None | Low, pending consumer check |
| F-7 | None (internal) | Identical | **Reduces** | None | Preserves the non-recursive DoS property | Low |
| 8.1 | None | None (test-only) | Adds test surface | None | None | None |

**Cross-cutting risk (PERF-001 §5.3, "prohibited: increasing complexity without measurable
benefit").** F-3 has no measurable benefit and must therefore be justified *only* as invariant
restoration — bundling it into a change that claims throughput would violate §4.11. It is listed
last in §11 for that reason.

---

## 10. Validation Results

**What this investigation validated [M]:** F-1 (4.0× at 10 mounts, linear), F-2 (+171 B/req, cv
0.0%), F-3's map transition + its two refutations, F-4 (4.6–4.9× decode ratio), F-5 (binary probe).

**What it did NOT validate, and what would resolve each:**

| Open question | Required evidence |
| ------------- | ----------------- |
| Does F-2's wrapper transition a real `ServerResponse`'s map? | Re-run the `%HaveSameMap` probe against a genuine `http.ServerResponse`, not a literal (my probe was invalid by construction) |
| Does F-1 convert to RPS? | The mount-scaling benchmark arm from §8.1.3 — the corpus's ~24%-idle finding means CPU saved may not become throughput |
| F-1's allocation profile | A proper `--expose-gc` child-process harness; my heap-delta sampling failed (cv 33.2%, non-monotonic) |
| F-4 against the real module | One-line harness change to import `parseQueryString` and drive it with `?q=hello&limit=10` |
| F-5's symbols: any external consumer? | Grep the wider ecosystem / declare them internal-and-removable in a release note |
| Any per-request cost at the pinned, multi-run scale | The corpus's still-open Rec 3/4 session (~6 h `standard`) — **not** an inline agent run |

**Validation plan for the remediation** (PERF-001 §4.9), per change, in order:
functional — full package suites + `packages/adapters/conformance` + the RFC-029 security tests for
F-1; performance — the §8.1.3 mount arm before/after for F-1, `bench:alloc:handler` before/after for
F-2, `bench:alloc:context` unchanged-gate for F-3/F-5, a new query-decode arm for F-4;
acceptance — §4.11 applies literally: **if a change shows no measurable improvement on its own
declared metric, reject or revert it** (F-3 is exempt only because it declares no performance metric
at all).

---

## 11. Final Recommendation

**Verdict.** The hot path is in genuinely good condition — the corpus's optimization work is real,
well-measured, and mostly holds at HEAD. What has decayed is not the code but the **link between the
code and the audits' conclusions about it.** Four costs and two false documented invariants entered
through that gap.

**Implementation order** (PERF-001 §5.2 priority classes):

| Phase | Items | Class | Justification |
| ----- | ----- | ----- | ------------- |
| **1** — high impact, low risk | **F-1 B** (precompute prefix), **F-4** (decode guard), **F-2 A** (drain flag) | P0 arch / P1 exec / P2 resource | All measured; all remove work; none changes observable behaviour; F-1 B is 2 lines |
| **2** — the architectural fix | **F-1 A** (memoize canonical path) + the stale-memo security test | P0 architectural | Highest value, highest care: this is RFC-029's bug class. RFC-gated per AGENTS.md §21 — it touches a ratified security contract |
| **3** — invariant restoration + cleanup | **F-3** (declare field), **F-5** (drop symbol writes), **F-7** (collapse duplicate walk) | P3 / maintainability | No throughput claims. Ship as a separate, clearly-labelled change so §4.11 is not violated by association |
| **4** — prevention | **§8.1** all four items | Regression prevention (§5.5) | Addresses the shared root cause. Arguably should lead, not trail: it is what stops finding #5 |

**Confidence assessment:**

| Item | Confidence | Why |
| ---- | ---------- | --- |
| F-1 mechanism + linear growth | **HIGH** | Read in source; measured at 4 mount counts; effect 4.0× vs ≤14% variance; sanity-gated for correct dispatch |
| F-1 → RPS conversion | **LOW** | Unmeasured at load; the corpus's ~24%-idle finding is a real counterweight |
| F-2 allocation delta | **HIGH** | Deterministic, cv 0.0%, mechanism read in source |
| F-2 shape effect | **LOW** | My probe was invalid by construction; stated, not claimed |
| F-3 map transition | **HIGH** | Direct `%HaveSameMap` with a validated control |
| F-3 allocation / IC breadth | **REFUTED** | Measured to zero / measured as bounded |
| F-4 pattern ratio | **HIGH** | 4.6× and 4.9× across independent runs; precedent in-tree |
| F-4 real-module magnitude | **MEDIUM** | Measured a faithful re-implementation, not the module |
| F-5 | **HIGH** | Binary probe, unambiguous |
| F-6 | **HIGH** | Read in source; `application.ts:390` short-circuit is explicit |
| F-7 unreachability | **HIGH** | Graph-verified caller set + registration-time pool wiring read in source |

**One process recommendation, stated plainly.** Two documents in `report/core/` are wrong at HEAD.
Per AGENTS.md §13 ("outdated documentation is a bug") they should be corrected in the same change
that fixes what they mis-describe — V-02 in `context-review.md` and the mount note in
`core-hot-path-performance-review.md` — and this report's findings added as rows to
`reports/investigations/performance-investigation-reconciliation.md`, which is the corpus's tracker.
Leaving a superseded conclusion in place is how the next investigation inherits the same debt.
