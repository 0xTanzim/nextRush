# NextRush Router — Deep Engineering Review (Routing as a Runtime System)

> **Type:** read-only engineering review. No `packages/**` code was changed.
> **Basis:** commit `563717a` (branch `opt/core`) + the measured artifacts from the
> `router-param-path-profile-gate` change (`report/route-params-profile.md`). Every finding cites
> a file/function and, where relevant, a profile number that was **independently re-derived** from
> the raw `.cpuprofile` / gross-allocation JSON — not taken from a self-report.
> **Scope:** router runtime only (registration, matching, dispatch, trie, executor, context
> integration). Business logic, plugins, CLI, docs, and tests are out of scope by request.

---

## Executive Summary

NextRush's router is architecturally sound and already applies the two highest-leverage routing
optimizations: **static routes are O(1) and bypass the tree entirely**, and **per-route executors
are compiled at registration**, so request-time dispatch is a single indirect call with no
per-request closure. The de-async work (NF-1) has flattened dispatch to one microtask hop.

The motivating question — *"route params underperform; where does raw Node win?"* — resolves as
follows, on pinned 5-run data:

- **Route Params is −7.4% vs Fastify and −7.0% vs raw Node**, with **Fastify ≈ raw Node**. The
  earlier −13.9% was single-run/unpinned noise; roughly half the headline gap was measurement
  error.
- **Raw Node "wins" because it does not route.** Its `/users/:id` handler is a `startsWith` + a
  `slice` (verified, `servers/raw-node.js`) — no trie, no params object, no normalization, no
  context write. It is the performance *floor*, not a comparable router.
- **There is no single routing bottleneck to fix.** The whole matcher is **~4% of CPU**
  (`matchNodeIndexed` 1.44% + `matchRoute` 1.87% + decode/normalize 0.66%), its transient
  allocation is **escape-analysis-eliminated under load**, GC is ~1%, and the request is dominated
  by the **shared** response write (`writev` ~33%) and JSON serialization (~4.8%) on a path that is
  **24% idle** (I/O-bound at this RPS).

**Consequence for optimization strategy:** neither a segment-trie allocation trim nor a radix
rewrite is justified *on route-params RPS grounds* — both target ≤1.5% of cost on an I/O-bound
path. This review confirms, at the routing-systems level, the same conclusion the profiling change
reached. The genuinely useful next step is **measurement** (a clean-host publishable A/B), and, if
a real residual remains, it lives in **per-request framework overhead** (`NodeContext`,
`composedSingle`) and the shared HTTP layer — not in routing.

Findings below are severity-tagged per the requested model. Note that most carry an **honest
"near-zero RPS impact"** verdict; flagging them without that caveat would be the exact
"optimize because it looks slow" anti-pattern the brief forbids.

---

## Router Architecture

Layered, dependency-ordered (`packages/router/src`):

| Concern | File | Key symbols |
|---|---|---|
| Public API / route registration entry | `router.ts` | `Router.addRoute` (84) |
| Registration engine (trie insert + executor compile) | `registration.ts` | `addRoute` (108–227) |
| Trie structure + executor compiler | `segment-trie.ts` | `TrieNode` (29), `HandlerEntry` (49), `StaticRouteMap` (63), `compileExecutor` (78), `parseSegments` (179) |
| Matching orchestration | `match-route.ts` | `matchRoute` (37–137) |
| Trie walk + helpers | `matching.ts` | `matchNodeIndexed` (151), `collapseAndStrip` (69), `isProvablyLowerAscii` (53), `segmentAt` (39), `decodeParam` (23) |
| Request dispatch middleware | `dispatch.ts` | `createRoutesMiddleware` (43–71) |

**Node layout (`TrieNode`, verified):**
```ts
interface TrieNode {
  segment: string;
  type: NodeType;
  children: Map<string, TrieNode>;        // static children, keyed by WHOLE segment
  paramName?: string;
  handlers: Map<HttpMethod, HandlerEntry>; // method → compiled entry
  wildcardChild?: TrieNode;
  paramChild?: TrieNode;
}
```
Two `Map`s per node plus optional param/wildcard pointers. `StaticRouteMap =
Map<HttpMethod, Map<string, HandlerEntry>>` is a **separate** O(1) index for fully-static routes.

## Route Registration Pipeline

`addRoute` (`registration.ts:108`) does all structural work **once, at registration**:

1. `parseSegments(normalized, caseSensitive)` — parse the pattern into typed segments.
2. Walk segments, creating `STATIC` (`children.set`), `PARAM` (`paramChild`), or `WILDCARD`
   (`wildcardChild`) nodes. Param-name conflicts and duplicate routes **throw at registration**
   (fail-fast, no runtime cost).
3. Partition entries into executable functions (inline middleware + final handler) and metadata
   contributions.
4. **`compileExecutor(finalHandler, combinedMiddleware)`** — pre-compile the dispatch closure now,
   stored on `HandlerEntry.executor`. This is the "move work to registration" win: request-time
   dispatch never composes middleware or allocates a closure.
5. Store the entry at `node.handlers.set(method, entry)`.
6. If the route is **fully static** (`!hasParams`), *also* index it into the method-nested
   `StaticRouteMap` for O(1) lookup. Static routes therefore live in **both** structures; the
   static map is the fast path, the trie is the general fallback.
7. Push an introspection row into a **side structure never touched by dispatch**.

`addRoute` returns `hasParams`; the router ORs these into a `hasParamRoutes` flag that lets
`matchRoute` **skip the trie walk entirely** when an app registered zero param/wildcard routes.

**Verdict:** registration is already doing the right things — parse once, compile once, fail-fast,
and keep introspection off the hot path. No request-time work is deferred that could move earlier.

## Request Matching Pipeline

Traced end-to-end for `GET /users/12345` (the Route-Params benchmark):

```
createRoutesMiddleware(ctx)                        dispatch.ts:46
  └─ match(ctx.method, ctx.path) → matchRoute      match-route.ts:37
       1. queryIdx = path.indexOf('?')             (strip; no-op here)
       2. isProvablyLowerAscii(path)               full-path charCode scan  → 0.29% CPU
       3. collapseAndStrip(folded, strict)         includes('//')+endsWith  → returns same string
       4. staticRoutes.get(GET).get('/users/12345')  ← GUARANTEED MISS (R-01)
       5. hasParamRoutes ? continue
       6. originalPath = caseStable ? undefined     (skip 2nd normalize — HP-12)
       7. bindNames=[], bindValues=[]              2 transient arrays
       8. matchNodeIndexed(root, norm, 1, …)       matching.ts:151  → 1.44% CPU
            • stack = [frame]                       array + frame object
            • per hop: indexOf('/') + path.slice    substring per segment
            • children.get(seg) / handlers.get(m)   Map hash + pointer chase
            • decodeParam(seg) → push bind stacks   (no-op unless '%')
       9. params = Object.create(null); assign      1 retained object
      10. return {handler,params,middleware,executor}  RouteMatch object
  └─ ctx.params = routeMatch.params                 1 property store
  └─ return routeMatch.executor(ctx)                flat promise forward (NF-1)
```

**Static path (Hello World) short-circuits at step 4** and returns `params = EMPTY_PARAMS` (shared
frozen). Everything from step 6 down is the param-specific delta — and it is exactly why Hello
World ties Fastify while Route Params does not.

## Lookup Cost Model

| Route class | Algorithm | Complexity | Per-request allocations |
|---|---|---|---|
| Static | method-nested `Map<method, Map<path, entry>>` (HP-9) | **O(1)**, 2 hash probes | 0 (shared `EMPTY_PARAMS`) |
| Param | static-map miss → iterative trie DFS (`matchNodeIndexed`) | O(k) segments, ~2·k `Map.get` | ~6 transient + 1 params obj + 1 `RouteMatch` |
| Wildcard | trie DFS; wildcard is terminal, captures remainder | O(k) | + 1 remainder slice |

Depth is the multiplier: gross allocation scales at **~10.5 B/op per added segment** (D1), and each
segment costs one `children.get` hash + one pointer chase.

## Existing Findings Verification (shipped, confirmed in code — not re-litigated)

| ID | Claim | Status in code |
|---|---|---|
| HP-9 | Method-nested static map, no `${method} ${path}` key alloc | ✅ `matchRoute:71` `staticRoutes.get(method).get(key)`; built in `addRoute:200` |
| HP-11 | Iterative explicit-stack DFS + deferred param binding (DoS/pollution-safe) | ✅ `matchNodeIndexed:161` stack machine; bind stacks materialized once in `matchRoute:120` |
| HP-12 | Decide case-stability once; skip `toLowerCase` + 2nd normalize when stable | ✅ `matchRoute:61` `caseStable`; `originalPath` only when a fold happened |
| HP-13 | Materialize params via bind-count on a null-proto object (no `Object.keys`, no `Reflect.deleteProperty`) | ✅ `matchRoute:122–130` `Object.create(null)` + count loop |
| NF-1 | De-async dispatch — forward the executor promise directly | ✅ `createRoutesMiddleware:64` returns `executor(ctx)`; `compileExecutor:85` len-0 fast path |

All prior router optimizations are present and correct. The findings below are **new** and do not
restate them.

## New Findings

### R-01 — Redundant static-map probe on every dynamic request — **P3**

- **File / Function / Layer / Phase:** `match-route.ts` / `matchRoute` / matching orchestration / static lookup.
- **Evidence:** For `/users/12345`, `staticRoutes.get(GET)` succeeds, then `methodMap.get('/users/12345')` (`:71`) hashes the full path and **always misses** (a concrete param value is never a static key), before the trie walk begins.
- **Root cause:** the static fast path is attempted unconditionally before the tree.
- **Algorithm / Allocation / Branch analysis:** +1 string hash + 1 failed bucket probe + 1 branch. No allocation.
- **Benchmark correlation:** subsumed in `matchRoute` self-time (1.87%); not separately resolvable — i.e. well under 0.1%.
- **Runtime impact:** negligible.
- **Proposed optimization:** none recommended. The wasted probe is the *price* of static routes being O(1); the alternative (find-my-way's single radix with no static map) makes the **static** case slower, which would regress the Hello-World tie. Removing it to save <0.1% on the param path would cost more on the far more common static path.
- **Expected benefit / Risk:** ~0 / regressing static routes. **Verdict: keep as a documented tradeoff.**
- **Validation:** `bench:alloc:param-match` + static Hello-World A/B would show the trade is net-negative if attempted.

### R-02 — Map-keyed per-node children cause pointer-chasing (cache locality) — **P2 (architectural, deferred)**

- **File / Function / Layer / Phase:** `segment-trie.ts` `TrieNode` + `matching.ts` `matchNodeIndexed` / trie traversal.
- **Evidence:** each hop is `node.children.get(segmentSubstring)` keyed by the **whole** segment string. A `Map.get` = hash the segment + bucket lookup in the Map's backing store + pointer deref to a non-contiguous heap `TrieNode`; that node's own `children`/`handlers` Maps are further separate heap objects.
- **Root cause:** node children stored as `Map<string,TrieNode>` rather than a prefix-compressed / first-char-branched compact structure.
- **Algorithm / Cache analysis:** worst-case walk is O(k) hops with poor spatial locality (each hop touches ≥3 disjoint heap regions). find-my-way (radix) compresses shared prefixes into fewer, larger nodes → fewer hops, better locality; uWebSockets.js packs a compile-time trie into contiguous memory.
- **Benchmark correlation:** `matchNodeIndexed` = **1.44%** CPU at depth-2 (D3). Cost grows with depth (D1: +10.5 B/op and an extra hash/hop per segment).
- **Runtime impact:** small at shallow depth; only material for large tables / deep shared prefixes.
- **Proposed optimization:** the radix track already framed in `docs/RFC/runtime-adapters/015-router-radix.md`.
- **Expected benefit / Risk:** eliminating the 1.44% walk closes **far less than the ~7% gap** on this workload; radix adds build complexity and edge-case surface.
- **Verdict:** **RFC-015-deferred.** Needs a large-table / deep-prefix driver + its own T017 evidence; not justified on current route-params RPS.
- **Validation:** RFC-015 T017 A/B on a large synthetic route table, plus a CPU profile confirming the walk share on deep routes.

### R-03 — Per-match walk allocation provisioned for the worst case — **P3**

- **File / Function / Layer / Phase:** `matching.ts` / `matchNodeIndexed` / trie traversal / allocation.
- **Evidence:** the walk allocates a heap `WalkFrame[]` stack + a `{node,pos,stage,seg,next,bound}` frame **per descent level** (`:161`, `:191`, `:213`) and a `path.slice()` substring per segment (`:176`), plus the two bind arrays in `matchRoute`. Gross bench (D1): depth-2 = **442 B/op**, ~102 B/op of it transient the net-retained bench never saw.
- **Root cause:** the stage-machine stack is dimensioned for backtracking (static→param→wildcard) even when the match is unambiguous and needs none.
- **Allocation analysis:** ~6 transient allocations/match at depth-2; **~98–99% escape-analysis-eligible** — D1 `discard` floor ~3 B/op, D2 real-server heap-prof shows `matchNodeIndexed`/frames/bind arrays at **0 sampled**, GC ~1% CPU (D3).
- **Runtime impact:** **negligible under load** — the transient does not survive to the collector.
- **Proposed optimization:** a "fast-lane" scalar loop for the common no-sibling case, falling back to the stack machine only when a param/wildcard sibling exists at a node — architecturally cleaner and would cut the transient.
- **Expected benefit / Risk:** **~0 RPS** (escape-elided already, path is I/O-bound); risk of complicating the DoS-safe walk that HP-11 deliberately introduced.
- **Verdict:** the heap stack is **load-bearing for correctness** (native-recursion stack-overflow DoS guard + deferred binding) and must stay; the fast-lane is a documented-but-deferred idea, not a recommended change.
- **Validation:** `bench:alloc:param-match` before/after + a route-params A/B; revert if RPS does not move beyond noise (it will not, per D2/D3).

### R-04 — `isProvablyLowerAscii` scans the whole path on every case-insensitive request — **P3**

- **File / Function / Layer / Phase:** `matching.ts` / `isProvablyLowerAscii` / normalization.
- **Evidence:** `matchRoute:61` calls it for every request unless `caseSensitive` (which short-circuits via `||`). It is a `charCodeAt` loop over the full path (`:54`). D3: **0.29%** CPU.
- **Root cause:** the default router is case-insensitive, so the scan runs to decide whether a `toLowerCase()` allocation is needed.
- **Algorithm / Branch analysis:** O(len) scan, early-exit on the first uppercase/non-ASCII byte; trades a scan for a *conditional* allocation.
- **Runtime impact:** ~0.29%; a deliberate, usually-winning trade (avoids the `toLowerCase` string alloc on the common already-lowercase path — including the benchmark path).
- **Proposed optimization:** none on perf grounds. A case-sensitive-by-default policy would skip it, but that is an **API-semantics** decision, not a performance one, and out of scope.
- **Verdict:** keep.
- **Validation:** n/a (no change recommended).

### R-05 — The route-params gap is not matcher-bound (meta-finding) — **P2 (architectural)**

- **File / Layer / Phase:** whole request path / dispatch + response / cross-cutting.
- **Evidence (D3, 104,252 samples, independently re-parsed):** response write `writev` 28.45% + `writevGeneric` 2.18% + `createWriteWrap`/`_storeHeader` ~2% = **~33%**; `(idle)` **23.95%**; JSON serialize **4.82%**; **whole matcher 4.03%**; GC ~1.0%; `NodeContext` 0.79% + `composedSingle` 0.50% = ~1.3% framework overhead. **Pinned RPS (D4):** −7.4% vs Fastify, −7.0% vs raw Node, Fastify ≈ raw Node.
- **Root cause:** the route-params request is I/O- and serialize-bound (shared with all frameworks); NextRush's *specific* excess is spread thinly across the matcher (~4%) and per-request context/dispatch (~1.3%), none dominant, and the server is not CPU-saturated (24% idle) so shaving matcher CPU does not convert 1:1 to RPS.
- **Runtime impact:** the ~7% gap is an aggregate of many small general-purpose costs, not one hot path.
- **Proposed optimization:** (1) get a **publishable clean-host A/B** first — the −7% may be near the noise floor on idle hardware; (2) if a real residual remains, target `NodeContext` creation and `composedSingle` dispatch (the only NextRush-specific CPU outside shared work), not routing.
- **Expected benefit / Risk:** unknown until the clean-host number exists — which is precisely why measurement precedes any further code change.
- **Verdict:** **do not optimize routing further for route-params RPS.** Measure, then (maybe) target context/dispatch.
- **Validation:** 5-run CPU-pinned `--profile full` on a clean host (the deferred global gate).

## Algorithm Review

- **Static:** O(1) hash, provably constant-time (two `Map.get`s, no traversal). Correct and optimal.
- **Param:** O(k) in path segments, iterative DFS with deferred binding — no recursion, no
  backtracking allocation beyond the reusable bind stacks. Backtracking order (static → param →
  wildcard) is correct and matches convention (most-specific-first).
- **Wildcard:** terminal, captures the remainder in one slice; does not affect static or shallow
  param performance (guarded behind `wildcardChild` presence).
- **No linear scans over route sets, no per-request sorting, no duplicate traversal.** The one
  redundancy (R-01) is a deliberate fast-path trade. The algorithmic class is already correct; the
  only structural lever is the constant factor (radix, R-02), which the evidence defers.

## Memory & Allocation Review

- **Static hit:** 0 per-request allocations (shared frozen `EMPTY_PARAMS`).
- **Param hit (D1, gross):** ~442 B/op at depth-2, of which ~102 B/op is transient (stack, frames,
  slices, bind arrays) and the remainder is the retained `params` object + `RouteMatch`.
- **Under real load (D2):** matcher allocation is **0.34%** of heap traffic; the transient set
  samples at **zero** — V8 scalar-replaces it. GC is ~1% CPU (D3). The dominant heap traffic is
  one-time startup + unavoidable HTTP-layer allocation (`internal/encoding`, HTTP parser, writable
  stream), shared by all frameworks.
- **Conclusion:** allocation is **not** a route-params bottleneck in production. The gross bench is
  the standing instrument (`bench:alloc:param-match`) for any future matcher allocation claim, but
  D2 (real server) is the authority where the two differ.

## V8 Analysis

- **Escape analysis:** the walk's transient objects are elided under load (D1 discard floor + D2
  zero samples) — the JIT proves they don't escape the matcher, so they never hit the heap. This
  is why R-03's "fast-lane" would not move RPS.
- **Hidden-class stability:** `ctx.params` is assigned either the shared frozen `EMPTY_PARAMS` or a
  fresh null-proto object; each handler's own access site (`ctx.params.id`) sees one consistent
  shape → **monomorphic**. The null-proto object is also the prototype-pollution guard (HP-13) — a
  `__proto__` param binds as an own key with no prototype mutation.
- **`Map.get` dispatch:** `children.get`/`handlers.get` are runtime Map operations (not
  IC-optimizable property loads), but V8's Map fast paths keep them cheap; no megamorphism is
  introduced because keys are ordinary strings.
- **Executor call:** `routeMatch.executor(ctx)` is a monomorphic indirect call to a
  registration-compiled closure; NF-1 removed the extra async state machine.

## CPU & Cache Analysis

- **CPU (D3):** matcher ~4% total; the largest matcher term is the per-segment `Map.get` walk
  (1.44%). The request is dominated by the shared `writev` (~33%) and JSON (~4.8%). 24% idle → the
  server is **not CPU-bound** at this RPS, so matcher-CPU reductions do not convert linearly to RPS.
- **Cache:** the Map-per-node layout (R-02) is the only real locality concern — pointer-chasing
  across disjoint heap nodes/Maps. It is a shallow-depth non-issue (1–2 hops) and a deep-route
  concern only; radix would improve it but is deferred on the RPS evidence.

## Runtime Comparison

| Router | Lookup algorithm | Memory layout | Dispatch | Allocation | Adopt / Reject |
|---|---|---|---|---|---|
| **Raw Node** | hardcoded `startsWith`/`slice` (`servers/raw-node.js`) | none | inline | ~1 slice | The floor; not general — nothing to adopt |
| **find-my-way (Fastify)** | radix (compressed prefix) tree, first-char branch | fewer, larger nodes | per-route, highly tuned | params object | **The bar.** Adopt prefix compression *iff* a driver appears (R-02). Reject its no-static-map design — NextRush's O(1) static map is a real edge |
| **Hono RegExpRouter** | all routes compiled into a few big regexes at registration; `RegExp.exec` (native) | precompiled tables | precompiled | minimal | Adopt the *idea* of compiling the **matcher** (NextRush already compiles the executor). Reject full-regex if it complicates wildcard/edge semantics — RFC-gate |
| **uWebSockets.js** | C++ compile-time trie | contiguous C++ memory | C++ | ~none (native) | Different substrate (not `node:http`); adopt the philosophy (registration-time work), not the mechanism |

**Reading:** NextRush already matches the two biggest techniques (O(1) static bypass + compiled
executors). Its param path is a runtime JS trie walk where find-my-way (radix) and Hono (compiled
regex) each do less runtime work — but both are **constant-factor** wins that the profile shows do
not gate RPS on this I/O-bound workload. NextRush is ~7% behind a bar (Fastify) that is itself at
the raw-Node floor, so the remaining distance is small and mostly shared-cost, not algorithmic.

## Architectural Opportunities

1. **Radix / prefix compression (RFC-015)** — the principled fix for R-02's pointer-chasing.
   Deferred: targets 1.44%, needs a large-table/deep-prefix driver.
2. **Compile-the-matcher (Hono-style)** — a future RFC-worthy idea: precompute a per-method matcher
   at registration instead of walking a JS trie. High-leverage only if param throughput ever
   becomes the priority; real tradeoffs (registration cost, pattern coverage, wildcard semantics).
3. **Walk fast-lane (R-03)** — a scalar loop for unambiguous matches. Clean, but ~0 RPS on evidence.
4. **None of these is warranted now.** The architecture is not the constraint; the workload is
   I/O-bound and the gap is largely shared cost.

## Prioritized Optimization Roadmap

| Priority | Action | Rationale | Gated on |
|---|---|---|---|
| **P0** | Clean-host 5-run CPU-pinned `--profile full` A/B | The −7% is directional; may sit at noise floor on idle hardware → route-params closed by measurement alone | clean host |
| **P1** | *If* a real residual: profile & trim per-request framework overhead (`NodeContext`, `composedSingle`) | The only NextRush-specific CPU outside shared work (D3) | P0 shows a real gap |
| **P2 (deferred)** | Radix track (RFC-015) | Constant-factor locality win for large/deep tables | large-table/deep-prefix driver + T017 |
| **P3 (deferred)** | Walk fast-lane (R-03) | Cleaner walk, cuts transient | only if a workload makes the transient matter (escape analysis says it won't) |
| **Keep** | R-01 static probe, R-04 case scan, HP-9/11/12/13 | Deliberate, correct tradeoffs | — |

**Do NOT:** commit a segment-trie allocation trim or a radix rewrite as a route-params RPS lever —
both are rejected by the evidence (`report/route-params-profile.md`).

## Validation Plan

Any future router change must clear, per `performance-gate`:

- `bench:alloc:param-match` (gross allocation, real matcher, depth-2 + depth-8) before/after.
- Route-params A/B (pinned multi-run) before/after; **revert if RPS does not move beyond noise.**
- `--cpu-prof` + `--heap-prof` of the real server confirming the targeted term actually shifted.
- The matcher differential golden (`match-differential`, `find-node-differential`) stays green.
- The publishable 5-run CPU-pinned `--profile full` on a clean host remains the final gate for any
  published number.

## Post-Review Update (2026-07-19): Concurrency Re-Test Closed the Open Question

This review's P0 recommendation ("clean-host 5-run `--profile full` A/B") was not run (still
deferred, still the eventual gate). Instead, per user direction, a cheaper dev-agent alternative was
tried and fully executed across two OpenSpec changes
(`router-highload-matcher-optimize` → superseded; `router-highload-harness-fixes` → applied): raise
`wrk` concurrency (c64→c128→c256) with `taskset` core-pinning and a fixed `listen()` backlog, to see
if the server could be driven CPU-bound cheaply, which would make R-02/R-03's matcher costs
RPS-relevant and testable.

**Result: the server was never driven CPU-bound at any tested concurrency** (idle stayed ~24% at
c64, c128, and c256-after-fixes). A genuine throughput collapse was found at c256, but two direct
measurements — a live `ss -lt` queue snapshot and before/after core-pinning — **refuted** the
accept-queue theory and only **partially confirmed** the core-contention theory (fixed the idle
anomaly, not the RPS collapse). The collapse's true cause remains open and would need a genuinely
separate load-generation host to isolate — out of scope for dev-agent iteration.

**What this settles:** across roughly eight independent benchmark configurations (pinned/unpinned,
backlog-fixed/not, three concurrency levels, two separate investigations), the router matcher's CPU
share held constant at ~3-4% every single time. R-02 (radix) and R-03 (walk fast-lane) remain
correctly deferred — no configuration tested, including this one, produced evidence that either
would move RPS. The matcher fast-lane idea from `router-highload-matcher-optimize` is **closed**,
not parked: revisiting it would need evidence this program could not produce with agent-available
tooling, not a "try again later."

**RFC-015 note:** this concurrency re-test is orthogonal to RFC-015's T017 gate, which is a
route-table-*shape* question (large tables, deep shared prefixes), not a concurrency question. Both
investigations used the same small, shallow benchmark route table throughout — nothing here moves
T017 forward or backward. See `docs/RFC/runtime-adapters/015-router-radix.md` §7.

<details>
<summary>Concurrency re-test — evidence tables (folded from the now-deleted standalone saturation-findings report)</summary>

**Original sweep** (`router-highload-matcher-optimize`, before any fix):

| Concurrency | Requests/sec | Server idle time | Notes |
|---|---|---|---|
| c64 (baseline) | 23,670 | 23.95% | Spare capacity |
| c128 | 21,390 | 24.21% | Idle barely changed — no more pressure reached the server |
| c128, 8 wrk threads | 20,461 | 24.78% | Same story |
| c256 | 8,420 (−64%) | 31.20% (↑) | Collapse; latency 41ms avg, 1.44s worst-case |

Root cause identified for the missing `listen()` backlog: `packages/adapters/node/src/adapter.ts:329`
called `server.listen(port, host, cb)` with no `backlog` arg → Node's default of 511, well below
`somaxconn` (4096) on this host.

**Re-test** (`router-highload-harness-fixes`, after `DEFAULT_LISTEN_BACKLOG = 1024` shipped +
`taskset` core-pinning both sides, with a live `ss -lt` poll during the c256 run):

| Concurrency | RPS (original) | Idle (original) | RPS (fixed+pinned) | Idle (fixed+pinned) |
|---|---|---|---|---|
| c64 | 23,670 | 23.95% | 24,298 | ~24% |
| c128 | 21,390 | 24.21% | 24,045 | ~24% |
| **c256** | **8,420** (collapsed) | **31.20%** (↑) | **20,460** (still collapsed) | **24.14%** (back to baseline) |

- **Accept-queue exhaustion — REFUTED.** `ss -lt`'s `Recv-Q` spiked to 218 in the first 1-2s of the
  c256 run, then drained to 0 for the remaining ~8s (`Send-Q` confirmed 1024 was live). A queue that
  empties mid-run cannot explain a throughput drop sustained for the rest of the run.
- **Client/server core contention — PARTIALLY CONFIRMED.** Pinning fixed the idle anomaly exactly
  (31.20%→24.14%) but did not restore RPS (still 20,460 vs c128's 24,045 at the same ~24% idle) —
  contention explains the idle rise, not the collapse itself.
- **True cause of the c256 collapse: still open.** Remaining candidates (`wrk`'s own per-connection
  overhead scaling with concurrency; per-connection kernel/socket cost) are indistinguishable without
  a genuinely separate load-generation host — explicitly out of scope for dev-agent iteration.
- **The one number that held across all ~8 configurations, pinned/unpinned, fixed/not, c64/c128/c256:
  the matcher's CPU share stayed ~3-4%.** This is the single most repeatedly-confirmed finding of the
  whole program.

</details>

## Final Engineering Recommendations

1. **Treat the route-params matcher as done.** It is correct, safe (HP-11), allocation-light in
   production (escape-elided), and ~4% of an I/O-bound request. There is no routing bottleneck to
   remove; the levers that exist target ≤1.5% and won't move RPS here.
2. **Raw Node is not a fair peer** — it doesn't route. The meaningful bar is Fastify, and NextRush
   is ~7% behind it on a path where Fastify already sits at the raw-Node floor.
3. **Measure before touching code.** Run the clean-host publishable A/B; it likely narrows or
   closes the residual by itself.
4. **If a real gap survives, look outside routing** — at context creation and dispatch, and the
   shared response path — not at the trie.
5. **Keep the standing instruments** (`bench:alloc:param-match`, the profiles) so the next
   allocation/CPU claim is measured, never asserted. That discipline — not another micro-rewrite —
   is what earned this conclusion.
