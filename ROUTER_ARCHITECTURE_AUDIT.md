# ROUTER_ARCHITECTURE_AUDIT.md

**Package:** `@nextrush/router` @ `3.1.0`
**Source reviewed:** `router.ts` (1,125 lines), `radix-tree.ts` (184), `index.ts`, tests.
**Verification limit:** Read from source; not re-executed for this report. The `reset()` and double-seal claims are reasoned from the cited code paths.

---

## Executive Summary

The router is the strongest-engineered package of the three. It uses a **segment trie** with a genuinely good hot-path design: O(1) static-route hash map, index-based path scanning (no `split('/')` allocation per request), **executors pre-compiled at registration** (not per request), a frozen shared `EMPTY_PARAMS`, and a clean separation of the introspection registry (`routeDefinitions`) from the dispatch structures so metadata never touches the hot path. Route-conflict detection, `endpoint()` metadata markers, groups, sub-router mounting, and `allowedMethods()` are all present.

The problems are: a **naming lie** (everything calls it a "radix tree" while the code's own comment says it is *not* one), a **`reset()` correctness bug** (it forgets `routeDefinitions`), a **1,125-line god file** that blows past both the 300-line ceiling and the package's own 1,000-LOC budget, and **two divergent `redirect()` implementations** (the main router precompiles safely; `GroupRouter` uses a naive `replaceAll(':key', …)` that can mis-substitute overlapping param names).

---

## Architecture Score

**79 / 100 (C+)** — excellent hot-path and introspection separation; dragged down by the god file, the `GroupRouter` duplication, and the radix/trie misnomer baked into filenames and types.

## API Design Score

**76 / 100 (C+)** — rich and ergonomic (`get/post/…`, `group`, `mount`, `redirect`, `all`, `endpoint`), but `use()` has an overloaded string/Router/Middleware signature that throws at runtime for an unsupported combination (a type-level split would be safer), and `GroupRouter` is a parallel API surface that drifts from `Router` (different redirect semantics, no `mount`/`reset`).

## Maintainability Score

**68 / 100 (D+)** — `router.ts` at **1,125 lines exceeds the 300-line hard ceiling by ~3.7×** and exceeds the router package's **1,000-LOC budget** in `v3-architecture.instructions.md`. `Router` + `GroupRouter` + `redirect` compilation + tree walking all live in one file.

## Production Readiness Score

**76 / 100** — fast and mostly correct; the `reset()` bug and silent param-name conflict are the blemishes.

---

## Findings

| ID | Severity | Finding | Evidence |
|----|----------|---------|----------|
| **RT-1** | High | **`reset()` does not clear `routeDefinitions`.** It clears `root`, `staticRoutes`, `routerMiddleware`, `hasParamRoutes` — but not the introspection registry. After `reset()`, `getRoutes()` returns stale/ghost routes, so `@nextrush/openapi` (its documented consumer) would emit specs for routes that no longer exist. Test-isolation/hot-reload — the stated reasons `reset()` exists — are exactly when this bites. | `router.ts` — `reset()` (no `this.routeDefinitions.length = 0`) vs `getRoutes()` |
| **RT-2** | High | **"Radix tree" is a misnomer throughout the public surface.** `router.ts` line ~7 states it is "a segment-based trie, not a compressed radix tree," yet the package description, README ("uses a **radix tree** (compressed prefix tree)"), `index.ts` docblock, the `radix-tree.ts` filename, and the exported `RadixNode`/`createNode` names all say radix tree. `getting-started/overview.mdx` already (correctly) calls it a "Segment trie" — so the docs contradict themselves. Misleading for anyone reasoning about complexity/behavior. | `router.ts` L7; `router/README.md` L3/L11/L75; `radix-tree.ts`; `overview.mdx` L497 |
| **RT-3** | High | **1,125-line god file.** `router.ts` violates the 300-line hard ceiling and the 1,000-LOC package budget. `GroupRouter`, the redirect template compiler, and tree-walk helpers should be separate modules. | `router.ts` (1,125 lines); `v3-architecture.instructions.md` router budget = 1,000 |
| **RT-4** | Medium | **Two divergent `redirect()` implementations.** `Router.redirect()` precompiles a parts array and guards against non-route colons (`https://`). `GroupRouter.redirect()` instead does `targetPath.replaceAll(':' + key, value)` after sorting params by length — which can still mis-substitute overlapping names and re-processes the string per request. Same public verb, two behaviors. | `router.ts` — `Router.redirect` vs `GroupRouter.redirect` |
| **RT-5** | Medium | **Silent param-name conflict.** Registering `/:id` then `/:userId` at the same position only `console.warn`s (dev only) and silently keeps the first name, so `ctx.params.userId` is `undefined` at runtime with no error. Should throw at registration. | `router.ts` — `addRoute` param branch |
| **RT-6** | Medium | **`GroupRouter` is a second, drifting router API.** It re-implements the verb methods against `_addGroupRoute`, lacks `mount`/`reset`/`use`, and is cast via `as unknown as Router` when passed to the group callback — so the callback's typed `Router` argument is a lie (calling `r.mount()` inside a group would throw). | `router.ts` — `group()` (`cb(groupRouter as unknown as Router)`), `GroupRouter` |
| **RT-7** | Low | **`sealRouterMiddleware()` can double-seal.** It mutates every executor in place to prepend `routerMiddleware`. If `routes()` is invoked more than once on a router that has router-level middleware (e.g. mounted, then also `app.route()`d), middleware is prepended twice. No guard against repeat sealing. | `router.ts` — `routes()` / `sealRouterMiddleware()` |
| **RT-8** | Low | **`use('/prefix')` with no Router throws at runtime, not compile time.** The overloaded signature accepts `string` but rejects it unless a Router follows. A discriminated overload or separate `mountAt()` method would move this to the type system. | `router.ts` — `use()` |
| **RT-9** | Info | **No per-route middleware error boundary / no route-level validation flow beyond `endpoint()` metadata.** Validation is expressed as metadata + a middleware function (`validate()`), which is fine, but the router itself has no notion of parameter type coercion — all params are strings. Documented behavior, noted for the "parameter binding / validation flow" scope item. | `router.ts` — params are `Record<string,string>` |

---

## Risks

- **RT-1** silently corrupts generated OpenAPI/SDK output after any `reset()` — and `reset()` is advertised for tests/hot-reload, so it *will* be hit.
- **RT-2** is a documentation/trust risk at scale: contributors and users will reason about the wrong data structure, and the self-contradicting docs undermine confidence.
- **RT-4/RT-6** mean "the same thing" behaves differently inside vs. outside a group — a classic source of subtle production bugs.

---

## Missing Capabilities

- `reset()` completeness (registry) — RT-1.
- A single redirect implementation shared by `Router` and `GroupRouter` — RT-4.
- Registration-time hard error on param-name conflict — RT-5.
- Type-safe `use()` overloads / a dedicated mount method — RT-8.
- Optional parameter typing/coercion (all params are strings today) — RT-9.

---

## Technical Debt

- 1,125-line file (RT-3); `GroupRouter` parallel API (RT-6); dual redirect logic (RT-4); "radix" naming embedded in filenames/types that a rename would ripple through (RT-2).

---

## Refactoring Roadmap

1. **Fix `reset()`** to clear `routeDefinitions` (one line) + regression test. *(RT-1.)*
2. **Resolve the naming:** either rename to "segment trie" consistently (files/types/docs — breaking for `RadixNode`/`createNode` exports, so do before freeze) or, at minimum, correct every doc/description to match the code and stop calling it a compressed radix tree. *(RT-2.)*
3. **Split `router.ts`** into `router.ts` / `group-router.ts` / `redirect.ts` / tree-walk helpers to satisfy the ceiling. *(RT-3.)*
4. **Unify redirect** — have `GroupRouter.redirect` delegate to the precompiled implementation. *(RT-4.)*
5. **Throw on param-name conflict** at registration. *(RT-5.)*
6. Type-safe `use()` overloads; guard `sealRouterMiddleware` against repeat sealing. *(RT-7, RT-8.)*

---

## Final Approval

**NO — not yet approvable for a frozen v1.0.** The engine is fast and largely correct, but RT-1 is a real correctness bug in a supported path, RT-2 is a pervasive public-surface misnomer that a 1.0 shouldn't freeze, and RT-3 breaches the project's own file/package size rules. Approvable after roadmap steps 1–4.
