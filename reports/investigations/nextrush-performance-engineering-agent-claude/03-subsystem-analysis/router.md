# Subsystem — Router

**Playbook phase:** Part 4 §4.12, analysed with the §4.1–4.10 methodology
**Package:** `@nextrush/router` — `packages/router/src/{match-route,segment-trie,dispatch}.ts`
**Owns finding:** **P-02 (Critical)** — per-request allocation in the parameter-match path

---

## 1. Purpose (§4.1)

Map an incoming `(method, path)` pair to a handler, a middleware chain, and extracted path
parameters, in time independent of the number of registered routes. It exists so that route lookup
does not degrade as an application grows, which is the failure mode of linear regex-scanning routers
(Express's mechanism, and visible in this benchmark: Express is last on every routing scenario).

## 2. Architecture (§4.2)

A **segment trie** — not a radix tree. Registration splits a path on `/` and inserts one node per
segment, with distinct child kinds for static segments, `:param` segments, and `*` wildcards. Two
lookup structures are maintained:

- `staticRoutes`: a **method-nested** `Map<HttpMethod, Map<path, entry>>`, giving O(1) exact-match
  lookup with no trie traversal and, importantly, no per-request `` `${method} ${path}` `` key-string
  allocation (a prior trim, HP-9).
- `root`: the trie, walked only when `hasParamRoutes` is true.

Each terminal node carries a **pre-compiled executor** built at registration time by
`compileExecutor`, so handler invocation does not re-derive the middleware chain on lookup. (The
degree to which that compilation is real is the subject of `middleware.md`.)

## 3. Request lifecycle participation (§4.3)

Executed **once per request, unconditionally**, as the single middleware in the benchmark's
application shape:

```
createRoutesMiddleware(ctx)          ← every request
  ├─ canonicalizePath(ctx.path, …)   ← every request
  ├─ matchRoute(method, path, …)     ← every request
  │    ├─ static map probe           ← every request  (O(1))
  │    └─ matchNodeIndexed(...)      ← only if static probe missed AND param routes exist
  └─ routeMatch.executor(ctx)        ← every matched request
```

## 4. Performance characteristics (§4.4)

From `01-benchmark-analysis.md` §4.2, marginal cost above each framework's own `hello-world`:

| | NextRush | Fastify | Raw Node | Hono |
| --- | --- | --- | --- | --- |
| 1 param, 2 segments (`/users/:id`) | **7.30 µs** | 2.07 µs | 1.44 µs | 3.12 µs |
| 3 params, 8 segments (`/api/v1/orgs/:o/teams/:t/members/:m`) | **4.01 µs** | 2.45 µs | 1.61 µs | 2.84 µs |
| Static route (implicit in `hello-world`) | ~0 (O(1) map probe) | ~0 | ~0 | ~0 |

**Static routing is competitive.** The whole deficit is in the param path, and it is **3.5×
Fastify's** on the shallow route. Route Parameters is consequently the framework's widest
like-for-like benchmark gap: **−25.5% vs Fastify, −28.9% vs raw Node at 256 connections.**

**Depth is not the problem.** The 8-segment/3-param route is *cheaper* than the 2-segment/1-param
route for NextRush (4.01 vs 7.30 µs marginal; 25,913 vs 23,878 rps). The trie's asymptotic claim
holds. The cost is a fixed per-param-match overhead, incurred once per matched param route
regardless of depth. The inversion's direction is itself anomalous — NextRush is the only framework
where the deeper route is faster — and is logged in `appendix/open-questions.md` as OQ-1.

## 5. Runtime behaviour — what actually happens (§4.5)

Read from `matchRoute` at HEAD. Work performed on a **param-route** request:

1. `path.indexOf('?')` and, if found, `path.slice(0, queryIdx)` → **string allocation**.
2. `isProvablyLowerAscii(path)` — a scan, then `folded = path` (no allocation when case-stable).
   This is a shipped trim (HP-12): the `toLowerCase()` allocation and a second normalize pass are
   correctly skipped for the common case.
3. `collapseAndStrip(folded, strict)` → potential **string allocation**.
4. `staticRoutes.get(method)` then `methodMap.get(staticKey)` — two O(1) probes. For a param route
   **both probes miss**: this is unavoidable work spent proving the route is not static.
   `staticKey` may itself be a `slice()` → **string allocation**.
5. `const bindNames: string[] = []` → **array allocation**.
6. `const bindValues: string[] = []` → **array allocation**.
7. `matchNodeIndexed(...)` walks the trie, pushing/popping the two stacks on descent/backtrack.
8. `params = Object.create(null)` → **object allocation** (null-prototype, correctly so — see §9).
9. A `for` loop copying `bindNames[i] → params[name]`.
10. `return { handler, params, middleware, executor }` → **object literal allocation**.

Plus, one frame up in `createRoutesMiddleware`:

11. `canonicalizePath(originalPath, caseSensitive, strict)` → returns `{rejected, path}`, an
    **object allocation on every request**, static routes included.
12. Two property writes cast through `as` to bypass readonly: `ctx.path`, `ctx.originalPath`.

**Per param-route request: 2 arrays + 3 objects + 1–3 strings.** Per static-route request: 1 object
(`canonicalizePath` result) + 1 object (`RouteMatch`) + strings.

## 6. Bottleneck analysis (§4.6)

| Observation | Category | Note |
| ----------- | -------- | ---- |
| `bindNames` / `bindValues` allocated before it is known whether any route matches | Excessive allocation | Two arrays per request, discarded immediately after the copy loop |
| The copy loop from parallel arrays into `params` traverses the same data twice | Duplicate work | Deferred binding (HP-11) correctly removed a worse pattern (eager bind + `Reflect.deleteProperty` on backtrack) but left a two-pass materialisation |
| `RouteMatch` object literal allocated per request | Excessive allocation | The object is consumed synchronously by the immediate caller and never escapes |
| `canonicalizePath` returns a result object per request | Excessive allocation | Affects **all** requests including static ones — contributes to the fixed floor, not just the param path |
| Both static map probes must miss before the trie walk starts | Unnecessary work (structural) | Unavoidable in the current design; a param-route request always pays the static-lookup cost first |

**What is explicitly *not* a bottleneck**, verified rather than assumed:
- Algorithmic complexity. Lookup is O(k) in segment count with route-count independence, and the
  depth measurements confirm it empirically.
- The static path. O(1) method-nested map probe with a shared frozen `EMPTY_PARAMS` sentinel and no
  key-string allocation. This is well-built.
- `Object.create(null)` — this is a **security control**, not waste. It makes a param literally named
  `__proto__`/`constructor`/`prototype` bind as an own key with no prototype mutation. It must be
  preserved by any optimisation. Any proposal that replaces it with `{}` or a pooled plain object is
  rejected on those grounds.

## 7. Root cause candidates (§4.7)

**Primary — Memory allocation / data structure.** The parameter path allocates five short-lived
container objects per request to transport data across two function boundaries
(`matchNodeIndexed` → `matchRoute` → `createRoutesMiddleware`). Each boundary is paid for with a
fresh container. Fastify's `find-my-way` writes matched params into a single reused structure and
returns a cached handler record, which is why its marginal param cost is 2.07 µs.

**Secondary — request-time work that could be registration-time.** Path canonicalisation
(`collapseAndStrip`, case-fold decision, trailing-slash policy) is applied to the *incoming* path
every request. The *policy* (`caseSensitive`, `strict`) is fixed for the router's lifetime, so the
branch structure is re-decided per request even though its inputs are constant. A router-level
specialisation chosen once at construction would remove the branching, though not the string work.

**Confidence: Confirmed** for the allocation inventory (read in source). **Strong evidence** for it
being the cause of the 5.23 µs gap — the measurement, the source, and the depth-independence all
agree, and no competing mechanism was found. **Not Confirmed** for magnitude attribution per
allocation: that needs the allocation profile in `02-runtime-profiling.md` §5 item 3.

**Unresolved contradiction that must not be papered over:** the previous investigation recorded that
the team's own micro-benchmark showed param-match allocation *increasing* from 169.4 to 339.87 B/op
after the router allocation trim shipped, and that this was written off as unmeasurable transient
garbage. That regression has never been explained. It is consistent with the five-container
inventory above and is a strong reason to prioritise evidence item 3.

## 8. Optimisation opportunities (§4.8)

Detailed designs, alternatives and trade-offs are in `05-solution-engineering.md` S-02. Summary:

1. **Reuse the bind stacks per router instance.** `matchRoute` is synchronous end-to-end — no
   `await` between allocation and consumption — so two arrays owned by the router and truncated
   (`length = 0`) on entry are safe against interleaving. Removes 2 allocations/request.
2. **Eliminate the `RouteMatch` container.** Either write `handler`/`params`/`executor` onto a
   router-owned scratch record consumed before any yield, or have `matchRoute` write params directly
   to `ctx.params` and return the executor. Removes 1 allocation/request.
3. **Eliminate the `canonicalizePath` result object.** Return the canonical string and signal
   rejection with a sentinel (e.g. `undefined`, or a module-level frozen `REJECTED` marker).
   Removes 1 allocation on **every** request, static included.
4. **Single-pass param materialisation.** Have the walk write into the `params` object directly once
   the terminal is accepted, rather than into parallel arrays copied afterwards. Interacts with
   backtracking, so it is the highest-risk of the four.

Items 1–3 are mechanical, local, and preserve every observable behaviour including the
null-prototype guarantee. Item 4 changes the walk's contract.

## 9. Edge cases reviewed (§4.9)

| Case | Behaviour | Optimisation must preserve |
| ---- | --------- | -------------------------- |
| Param named `__proto__` / `constructor` / `prototype` | Binds as own key on a null-prototype object; no prototype mutation | **Yes — non-negotiable security property** |
| Dot segments (`/a/../b`) | `canonicalizePath` rejects → `400`, chain stops rather than falling through to 404 (deliberate: a 404 fall-through leaks the un-normalised target via `ctx.path`) | **Yes** |
| Trailing slash | Stripped for the static probe; `strict` governs trie behaviour | Yes |
| Mixed case with `caseSensitive: false` | Folded path used for lookup; original-case path used for param value extraction via a second normalize pass | Yes — this is why `originalPath` exists |
| No route matched | `ctx.status = 404`, forwards to next middleware for `allowedMethods()` | Yes |
| Percent-encoded params (`decode: true`) | Decoded during the walk | Yes |
| Deep nesting | Confirmed cheaper than shallow — see §4 | — |

## 10. Investigation summary (§4.10)

| | |
| --- | --- |
| **Finding** | P-02 — the parameter-match path allocates five short-lived containers per request; parameter extraction costs 3.5× Fastify's, making Route Parameters the widest like-for-like benchmark gap |
| **Evidence** | Route Parameters −25.5% vs Fastify / −28.9% vs raw Node @256 conn; marginal param cost 7.30 µs vs 2.07 µs (Fastify); allocation inventory read in `matchRoute` at HEAD; prior unexplained 169.4 → 339.87 B/op regression |
| **Root cause** | Memory allocation — per-boundary container objects (`bindNames`, `bindValues`, `params`, `RouteMatch`, `canonicalizePath` result) |
| **Runtime impact** | +5.23 µs/request on param routes vs Fastify; +1 allocation/request on *all* routes from `canonicalizePath` |
| **Performance impact** | Route Parameters projected 23,878 → ~32,000 rps at parity (+34%), assuming the floor fix (P-01) also lands |
| **Recommendation** | Reuse bind stacks; remove the `RouteMatch` and `canonicalizePath` containers; consider single-pass materialisation |
| **Trade-offs** | Reused mutable state is only safe because the path is synchronous — an invariant that must be asserted by test, since a future `await` inserted into `matchRoute` would silently corrupt concurrent requests |
| **Priority** | **Critical** (widest measured gap) |
| **Confidence** | Confirmed (mechanism) / Strong evidence (attribution) / Hypothesis (per-item magnitude) |
| **Validation** | `06-validation-regression.md` V-02 |

**Assessment of prior work:** the router has already had a serious optimisation pass, and it shows
— HP-9, HP-11, HP-12, HP-13 and NF-1 are all present and verified at HEAD. The remaining cost is
not carelessness; it is the residual container-per-boundary pattern that the earlier passes did not
target.

**Cross-references:** `middleware.md` (the executor invoked by this subsystem),
`context.md` (the fixed floor this subsystem's `canonicalizePath` contributes to),
`04-root-cause-analysis.md` §3, `05-solution-engineering.md` S-02.
