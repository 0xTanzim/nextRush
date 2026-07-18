## Why

P2 of the hot-path review (`report/core-hot-path-performance-review.md`) — the router match path,
the framework's hottest code. On every matched request it allocates:

- **HP-9** — a `` `${method} ${path}` `` `staticKey` string, rebuilt per request to probe the static
  `Map` (`packages/router/src/match-route.ts`).
- **HP-10** — two near-identical result objects: `matchRoute` returns `{handler, params, executor}`
  and `resolveMatch` wraps it into `{handler, params, middleware, executor}`.
- **HP-11** — a 2-element tuple array per path segment (`extractSegment`), a *second* extraction on
  the original-case path for param routes, and a backtrack `Reflect.deleteProperty`
  (`packages/router/src/matching.ts` `matchNodeIndexed`).
- **HP-13** — an `Object.keys(params)` post-match loop the code itself documents as "buys nothing."
- **HP-12** — `path.toLowerCase()` per request plus a second full `normalizePathForMatch` pass to
  recover original-case params (default `caseSensitive: false`).

`matchNodeIndexed` is the single most-executed function in the framework, and Route Params is where
NextRush's gap to Fastify is widest (−13.0% vs −11.5% on Hello World). The router-radix RFC
(`docs/RFC/runtime-adapters/015-router-radix.md`, decision D4) deferred exactly these hot-path
rewrites "to be settled by a benchmark, not bundled into a cleanup" — **this change is that
dedicated, benchmark-gated pass.**

## What Changes

- **HP-9** — replace the static route store `Map<"METHOD path", entry>` with a method-nested
  `Map<method, Map<path, entry>>`, so lookup selects the inner map by method and probes by the raw
  path — no per-request string concatenation. Registration and `reset()` update accordingly; the
  method-miss semantics (unregistered method on a known path → miss, so `allowedMethods()` can 405)
  are preserved.
- **HP-10** — build the `RouteMatch` once per matched request instead of allocating a `matchRoute`
  result and then a separate `resolveMatch` wrapper. The `RouteMatch` shape is unchanged.
- **HP-11** — rewrite the param walk to avoid the per-segment tuple arrays and the second
  original-case extraction, **materialize params once on the successful terminal path** (removing
  the backtrack `Reflect.deleteProperty` deopt) onto a **null-prototype** params object, using an
  **iterative** walk that also closes a latent deep-path stack-overflow, and keeping decode
  strictly post-split so an encoded slash can never re-segment the path.
- **HP-13** — drop the `Object.keys` post-match loop by tracking bound-param count during the walk
  (naturally subsumed by HP-11's materialize-once), still returning the shared frozen
  `EMPTY_PARAMS` for param-less matches.
- **HP-12** — skip `toLowerCase()` only when the path is provably case-stable (unicode-correct —
  never wrongly skipping non-ASCII uppercase), and avoid the second `normalizePathForMatch` pass
  for case-insensitive param routes.
- **Hardening & critical-flow guarantees** (folded into the rewrite, pinned by the spec):
  null-prototype params (prototype-pollution safety; also fixes the latent `__proto__`-param
  mis-bind and the current `EMPTY_PARAMS`-vs-`{}` prototype inconsistency), encoded-slash/dot never
  re-segments the path (traversal safety), an iterative/depth-guarded walk (no stack-overflow DoS
  on pathological paths), concurrency-safe matching (no shared mutable state), and a clean-`null`
  miss preserving the 404/405 dispatch + compiled-executor flow.
- Each trim is a **separate, individually-benchmarked, independently-revertible commit** within the
  change, landed safest-first (HP-10 → HP-9 → HP-12 → HP-11+HP-13).
- **BREAKING**: None. The `Router` public API, the `RouteMatch`/`HandlerEntry` types, and all
  observable matching behavior (precedence, backtracking, param casing, decoding, wildcards,
  trailing-slash, method-miss) are preserved and pinned by the spec's scenarios as a regression
  contract. The only observable delta is negligible and documented: a populated `params` becomes
  null-prototype (matching what param-less matches already return via `EMPTY_PARAMS`), so inherited
  `Object.prototype` members are no longer visible on `ctx.params`. Changing the `caseSensitive`
  **default** is explicitly out of scope (that would be breaking).

## Capabilities

### New Capabilities

- `router-match-path-allocation-trim`: The requirement that the router's per-request match path
  eliminate the `staticKey` string, the duplicate match-result object, the per-segment tuple
  arrays, the backtrack `Reflect.deleteProperty`, the `Object.keys` post-match loop, and the
  redundant case-normalization work — while guaranteeing byte-for-byte-identical matching behavior
  (route resolution, precedence, backtracking correctness, param values incl. original casing and
  percent-decoding, wildcards, trailing-slash, method-miss, and the `EMPTY_PARAMS` sentinel) — and
  hardening the path against prototype pollution (null-prototype params), re-segmentation via
  encoded slashes (traversal safety), unbounded-recursion DoS (iterative/depth-guarded walk), and
  cross-request state leakage (concurrency isolation), with a clean-`null` miss preserving the
  404/405 dispatch flow.

### Modified Capabilities

- None. Router file-size/dedup is owned by the archived `router-structure-and-dedup`; this change
  is a distinct concern (match-path per-request allocation) whose scenarios pin the matching
  invariants as the executable regression contract. It also executes the hot-path optimization the
  `router-radix-rfc` capability deferred to a benchmark — referenced, not redefined.

## Impact

- **Affected code:** `packages/router/src/match-route.ts` (staticKey, result-object collapse,
  normalize, post-match loop), `packages/router/src/matching.ts` (`extractSegment` /
  `matchNodeIndexed` / `normalizePathForMatch`), `packages/router/src/registration.ts` +
  `packages/router/src/router.ts` (static-map storage type + `reset()`). `RouteMatch` /
  `HandlerEntry` in `@nextrush/types` keep their shape (built once, not restructured).
- **Affected tests:** `packages/router/src/__tests__/` — characterization pins for current matching
  behavior FIRST, then the per-trim edge-case matrix (precedence, backtracking, casing, decoding,
  wildcard, method-miss) and a differential/parity harness (old-vs-new results identical).
- **Performance harness:** `apps/benchmark` — a router match-path allocation micro-bench (static +
  param) and a `--profile full` A/B on Hello World (static) and Route Params (param). `bench:validate`
  parity must stay green.
- **Public API / types / dependencies:** none. Internal storage and matcher internals only.
