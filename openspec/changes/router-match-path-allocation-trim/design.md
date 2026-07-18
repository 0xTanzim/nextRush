## Context

The router match path (verified current on branch `opt/core`; no router commits since the audit):

- `match-route.ts` `matchRoute` — strips query, `normalizePathForMatch`, builds
  `` `${method} ${normalized}` `` and probes `staticRoutes: Map<string, HandlerEntry>`; on a param
  route allocates `params = {}` (a **plain** object — has `Object.prototype`), computes
  `originalPath` via a *second* `normalizePathForMatch` (case-insensitive default), walks via
  `matchNodeIndexed`, then runs an `Object.keys(params)` post-loop with a defensive
  `Reflect.deleteProperty`. Returns `{handler, params, executor}`; `resolveMatch` then builds a
  second `{handler, params, middleware, executor}` (`RouteMatch`).
- `matching.ts` `matchNodeIndexed` — **recursive** (depth = segment count); `extractSegment`
  returns a `[segment, nextPos]` tuple per segment; the param branch calls `extractSegment` again
  on `originalPath`; on backtrack it `Reflect.deleteProperty(params, paramName)`.

The engine is already good (O(k), index-based, static O(1) map, compiled executors). This change
removes the residual per-request garbage AND hardens several latent edge cases the audit and this
update surfaced. The `router-radix` RFC (015, D4) explicitly deferred the `matchNodeIndexed`
hot-path rewrite to a benchmark — this change is that benchmark-gated execution in the current
segment-trie router.

Two latent issues this update makes explicit (not just optimizations):
- **Prototype inconsistency**: `EMPTY_PARAMS` is null-prototype but the mutable `params` is `{}`
  (has `Object.prototype`). A route param named `__proto__` does not bind correctly on a plain
  object (the string value is ignored as a prototype), and inherited members (`params.toString`)
  are visible. The rewrite fixes this by materializing params on a null-prototype object.
- **Unbounded recursion**: `matchNodeIndexed` recurses per segment, so a pathological
  many-segment path can overflow the stack (a latent DoS, adjacent to `project-rules` §3 "no
  ReDoS-vulnerable patterns in routing"). An iterative walk removes the risk.

## Goals / Non-Goals

**Goals:**

- Remove the `staticKey` string (HP-9), the duplicate `RouteMatch` allocation (HP-10), the
  per-segment tuple arrays + backtrack `Reflect.deleteProperty` (HP-11), the `Object.keys`
  post-loop (HP-13), and the redundant case-normalization (HP-12) — on the per-request match path.
- Byte-for-byte-identical matching behavior across the full edge-case matrix (spec), pinned by a
  characterization + differential (old-vs-new) harness.
- Close the latent prototype-pollution and unbounded-recursion issues as part of the rewrite.
- Land as ordered, individually-benchmarked, independently-revertible commits.

**Non-Goals:**

- **Not** changing the `caseSensitive` default (`false` → `true` is breaking — separate, RFC-gated).
- **Not** the `Router` public API, `routes()`/`match()` contract, or the introspection registry
  (`routeDefinitions` stays separate from the hot path).
- **Not** building the radix router (RFC 015 is future); this improves the current one.
- **Not** other findings (HP-16 body-read is independent; HP-2/14/15 separate).

## Decisions

**D1 — HP-10: build the `RouteMatch` once (land first, lowest risk).** Produce the final
`RouteMatch` in a single allocation (matchRoute accepts `routerMiddleware` and returns the full
shape, or resolveMatch mutates matchRoute's object). Shape unchanged; `middleware` attached once. A
reused per-router scratch object is **rejected** (D9-adjacent: re-entrant across `await`) — one
allocation per request is the floor.

**D2 — HP-9: method-nested static map.** Replace `Map<string, HandlerEntry>` (keyed `"METHOD path"`)
with `Map<HttpMethod, Map<string, HandlerEntry>>`. Lookup selects the inner map by `method`, probes
by the trailing-slash-normalized path — no concatenation. Registration (`registration.ts`),
`reset()`, `all()`, and the copied-route path used by `mount`/`use`/`group`/`prefix` all update to
the nested shape. **Method-miss preserved** (unregistered method → no inner entry → miss →
`allowedMethods()` 405). **Static-over-trie precedence preserved** (static map probed before the
walk). Verify via public-surface snapshot + full router suite. Land second.

**D3 — HP-12: normalize fast-paths, unicode-correct.** Skip `path.toLowerCase()` only when the
result is provably unchanged. A naive "no ASCII A–Z" scan is **wrong** — it would skip folding for
non-ASCII uppercase and break unicode case-insensitive matching. The skip therefore triggers only
when the path is provably case-stable (e.g. contains no character `toLowerCase()` would alter);
any non-ASCII / uncertain byte falls back to the full `toLowerCase()`. Result is byte-identical to
always calling `toLowerCase()`. Also eliminate the second `normalizePathForMatch` pass by deriving
original-case segments during the walk. Land third.

**D4 — HP-11 + HP-13: rewrite the param walk (land LAST, riskiest).** Scan segments without the
`[segment, nextPos]` tuple, **prefer an iterative walk** over recursion (closing the latent
stack-overflow DoS on pathological segment counts), and **materialize params once on the accepted
terminal path** — record `:param`/`*` bindings for the *successful* branch and commit at the
terminal, instead of eager-bind + backtrack `Reflect.deleteProperty`. A bound-param counter
replaces the `Object.keys` post-loop (HP-13); zero params → the shared frozen `EMPTY_PARAMS`. This
removes the tuple arrays, the second extraction, the backtrack delete (V8 hidden-class deopt), and
the post-loop in one coherent rewrite. Every invariant below is preserved and tested; if an
iterative rewrite proves materially harder than the depth risk warrants, a bounded-recursion
fallback (explicit segment cap) is the minimum acceptable, never unbounded recursion left as-is.

**Matching invariants the rewrite MUST preserve (each a spec scenario):**
1. **Precedence** at each node: static child > param child > wildcard child.
2. **Backtracking**: a branch that matches partially then fails deeper falls through with **no
   stale param bindings**.
3. **Param casing**: `caseSensitive: false` → param *values* keep original case; lookup lowercased.
4. **Percent-decoding**: `decodeParam` when `decode` is on; malformed (`%zz`/`%`/`%2`) → raw.
5. **Wildcard** captures the original-case remainder (including the empty-capture case, unchanged).
6. **Trailing slash**: non-strict strips one (static and param routes); strict keeps.
7. **Double-slash** collapse (the `//` fast-path) and **root `/`** / empty-segment handling.
8. **Static-map trailing-slash**: static key strips a single trailing slash for `len > 1`.
9. **`EMPTY_PARAMS`** shared frozen sentinel for every param-less match.
10. **`hasParamRoutes` gate**: the walk is skipped when only static routes exist.
11. **Method-miss** and **`all()`** semantics on the nested map (D2).
12. **Null-prototype params** (D8): a `__proto__`/`constructor`/`prototype` param name binds as an
    own key with no prototype mutation.
13. **No re-segmentation on decode** (D9): `%2F`/`%2E` decode into the value only.
14. **Param + wildcard** and **empty param** cases identical to today.
15. **Miss → `null`** cleanly; matched route's compiled `executor` invoked (not re-composed).

**D5 — Characterize before changing (TDD on hot legacy code).** Before any trim, pin current
matching behavior with tests — including a **differential harness** over a broad corpus (static,
nested params, backtracking, wildcard incl. empty, param+wildcard, cased incl. non-ASCII, encoded
incl. `%2F`/malformed, empty/root/repeated-slash, trailing-slash, method-miss, mounted/grouped/
prefixed). The rewrite must reproduce all of it identically. Required floor per `tdd-workflow.md`.

**D6 — Measurement gate, per trim, HP-11 park-able.** Each trim ships an allocation micro-bench
delta + a `--profile full` A/B on its target scenario (HP-9/HP-10 → Hello World; HP-11/HP-13/HP-12
→ Route Params). HP-11 has its own gate: **if the CPU-pinned A/B does not move Route Params beyond
stddev, HP-11 is parked/reverted** while the safer trims stay — the "benchmark decides" discipline
RFC 015 D4 mandated. (The pollution/DoS hardening in HP-11 is worth keeping on correctness grounds
even if the RPS gain is marginal — call that out when recording the result.)

**D7 — File-size discipline.** `match-route.ts` / `matching.ts` are near the 300-line cap after the
earlier split; extract a helper if the rewrite would exceed it (`code-structure.md`).

**D8 — Null-prototype params (pollution safety + consistency).** The materialized params object is
`Object.create(null)`, consistent with `EMPTY_PARAMS`. This fixes the latent inconsistency and the
`__proto__`-param mis-bind, and neutralizes prototype pollution via a param name. Honest note: this
is a *tiny* observable change — inherited members (`params.toString`) become `undefined` on a
populated params, matching what param-less matches already return via `EMPTY_PARAMS`; no realistic
consumer reads `Object.prototype` members off `ctx.params`. Documented and covered by a scenario.

**D9 — Traversal-safe decode (no re-segmentation).** `decodeParam` runs AFTER segment extraction on
the already-split value, so an encoded slash/dot in a value decodes into the value only and never
creates new path segments or changes which route matched. The rewrite must keep decode strictly
post-split; a scenario pins `%2F`/`%2E` behavior.

**D10 — Concurrency isolation.** No per-router mutable scratch/params object is reused across
matches; each match materializes its own params (or shares only the frozen `EMPTY_PARAMS`). Pinned
by a concurrent-match scenario.

## Risks / Trade-offs

- **[Risk] HP-11's materialize-once/iterative rewrite changes backtracking correctness** (stale or
  missing params). → **Mitigation:** D5 characterization + precedence/backtracking scenarios + the
  differential harness; HP-11 lands last and is independently revertible.
- **[Risk] Param-value casing or decoding regression.** → **Mitigation:** case-insensitive
  (incl. non-ASCII) and percent-encoded (incl. `%2F`/malformed) scenarios.
- **[Risk] The unicode fast-path (D3) wrongly skips folding**, breaking case-insensitive unicode. →
  **Mitigation:** D3 skips only when provably case-stable, falling back to `toLowerCase()` on any
  non-ASCII/uncertain byte; a non-ASCII-uppercase scenario asserts byte-identity.
- **[Risk] Null-proto params (D8) breaks a consumer reading inherited members off `ctx.params`.** →
  **Mitigation:** matches the existing `EMPTY_PARAMS` behavior; the observable delta is negligible
  and documented; the differential harness compares key ownership/prototype.
- **[Risk] Method-nested map breaks method-miss / `all()` / `reset()` / mount / prefix / group.** →
  **Mitigation:** invariant-11 + registration-flow scenarios + full router suite + snapshot.
- **[Risk] Huge blast radius — the hottest function in the framework.** → **Mitigation:** staged
  safest-first commits, characterize-first, differential harness over a broad corpus, per-trim
  revert, and no merge without its A/B.
- **[Risk] Iterative rewrite adds complexity vs. recursion.** → **Mitigation:** the iterative walk
  is bounded by segment count with a simple explicit stack for backtracking; if it exceeds the
  file-size/complexity budget, extract a helper (D7); the minimum acceptable fallback is
  bounded-recursion, never unbounded.
- **[Risk / honest] HP-11's RPS gain may be marginal despite its risk.** → **Mitigation:** D6 parks
  the *performance-only* part on a no-movement A/B, but the pollution/DoS hardening is retained on
  correctness grounds; the allocation micro-bench documents the garbage removed for RFC 015.

## Migration Plan

No runtime migration and no consumer-facing behavior change (the null-proto delta is negligible and
documented). Ship as ordered commits (HP-10 → HP-9 → HP-12 → HP-11+HP-13), each with tests + A/B,
each independently revertible. `RouteMatch`/`HandlerEntry`/`Router` public surface unchanged
(snapshot-verified).

## Open Questions

- Should HP-11's iterative materialize-once approach (null-proto, traversal-safe, depth-bounded)
  become the reference the future radix package adopts from the start? Feed the result to RFC 015.
- If the iterative rewrite is deferred, is an explicit segment-count cap (e.g. a documented max) an
  acceptable interim DoS guard, or does it need its own decision? Resolve during implementation.
