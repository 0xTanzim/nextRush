# RFC — `@nextrush/router-radix` (a second, opt-in radix router behind the shared `Router` contract)

> Status: **Proposed — deferred.** The design is specified; the package is **not** built by this
> change. Go/no-go is gated on a confirmed driver (§9) and the T017 router benchmark (§3, §7).
> Change: `fix-router-issues-and-author-radix-rfc` (Task group 4)
> Models: `docs/RFC/RFC-NEXTRUSH-ADAPTER-CONTRACT.md` + the `packages/adapters/conformance` precedent.

## 1. Summary & motivation

This RFC specifies a **future, optional** router package — `@nextrush/router-radix`, a
find-my-way-style compressed-radix-tree router — that would implement the same `Router` contract
as the shipped `@nextrush/router` (a segment trie). It is authored **before** any code, per this
repo's `tdd-workflow.md` "RFC before implementation" rule for new packages, so the work is born
into a specified contract and a conformance harness rather than a vacuum.

The RFC commits NextRush to **nothing at runtime.** It is a design artifact future work must
satisfy, not a build order. The segment-trie router remains the default (§8); a radix package, if
built, is strictly opt-in.

**The motivation is deliberately held open.** A deep audit (2026-07-17) established that the
current matching engine is genuinely well-built — O(k) segment trie, O(1) static fast path,
pre-compiled per-route executors, index-based scanning, no per-request complexity smells. So a
second router is **not** justified by "the current one is slow" — that premise is unproven and, on
the audit's evidence, likely false. Two candidate drivers are on the table, and **this RFC does
not pick one for the maintainer** (see §3 and the open question in §9):

- **(a) Fastify-migrant familiarity** — teams migrating from Fastify know `find-my-way`'s radix
  behavior and may want a drop-in mental model. This is an ecosystem/DX argument, not a
  performance one.
- **(b) A performance hypothesis** — that a compressed radix tree wins on some realistic route
  distribution. This is **unproven** and is gated on the T017 benchmark (§3); it must not be
  asserted as fact in docs, marketing, or this RFC.

Until one of these (or both) is confirmed, the package stays at "Proposed — deferred." That is the
honest state: the *design* is ready; the *decision to build* is not, and building on an
unconfirmed driver would violate `AGENTS.md` §11 ("measure before optimizing") and §16 ("every
abstraction must justify its existence").

## 2. Current state — the segment-trie router

`@nextrush/router` matches with a **segment trie**: a tree keyed by whole path segments (`users`,
`:id`), *not* by individual characters — so it is explicitly **not** a compressed radix tree. The
distinction matters for this RFC because the future package's whole reason to exist is that it
picks the *other* data structure.

The matching path is a three-layer engine, fronted by a thin public shell and surrounded by
registration, composition, and dispatch modules (all post-split, each under the 300-line ceiling):

```
Router (router.ts) ── public shell; delegates to pure functions below
  │
  ├─ registration.ts     addRoute, path normalization, any-method expansion
  ├─ group-router.ts      group() composition
  ├─ composition.ts       mount() / use(path, subRouter)
  ├─ dispatch.ts          routes() / allowedMethods() middleware generation
  └─ matching engine (the hot path):
        match-route.ts    orchestration  (matchRoute)
        matching.ts       lookup primitives  (matchNodeIndexed, findAllowedMethods, decodeParam)
        segment-trie.ts   TrieNode structure + compileExecutor
```

Three properties of the current engine are the behavioral baseline a radix router must reproduce,
and are worth stating precisely so the conformance suite (§5) can pin them:

- **O(1) static fast path.** `matchRoute` (`match-route.ts`) strips the query string, normalizes,
  then does a single `Map` lookup for fully-static routes before ever walking the tree. Static
  matches return the shared frozen `EMPTY_PARAMS` sentinel — zero per-request allocation.
- **O(k) tree walk for param/wildcard routes.** `matchNodeIndexed` (`matching.ts`) recurses
  segment-by-segment: static child first (most specific), then the param child (capturing the
  original-case segment as the param value), then a wildcard child (capturing the remainder). `k`
  is the number of path segments, independent of route count.
- **Executors compiled once at registration.** `compileExecutor` (`segment-trie.ts`) bakes a
  route's middleware chain into a single closure at registration time (mirroring core `compose()`),
  with a no-middleware fast path. The request path calls one pre-built function, not a per-request
  chain build.

A radix router would keep the O(1) static fast path and the compiled-executor model unchanged
(both are structure-agnostic) and replace only the O(k) segment walk with a radix walk.

## 3. Segment trie vs. radix — the tradeoff (honest, numbers deferred to T017)

Both structures give route-count-independent lookup; the difference is constant factors and shape,
not asymptotic class. An honest comparison, **with hard numbers explicitly deferred to the T017
benchmark** (running both routers on identical route sets and payloads):

| Dimension | Segment trie (current) | Compressed radix (proposed) |
| --- | --- | --- |
| Key unit | Whole path segment | Longest common prefix (character-level) |
| Lookup cost | O(k), k = segment count | O(m), m = path characters, with fewer nodes on shared prefixes |
| Node count | One per distinct segment | Fewer nodes; edges collapse shared prefixes |
| Static routes | Already O(1) via `Map` — radix adds nothing here | Same O(1) fast path applies |
| Param/wildcard | `matchNodeIndexed` recursion (§2) | Radix edge-scan with backtracking |
| Ecosystem familiarity | NextRush-specific | Matches Fastify/`find-my-way` mental model |
| Maturity in this repo | Shipped, battle-tested, characterized by tests | Greenfield, unproven |

The genuinely open questions the benchmark must answer before the package is justified on
performance grounds:

1. Does radix measurably beat the segment trie on a **realistic** route distribution (deep static
   trees, many params, long shared prefixes), or only on synthetic micro-cases?
2. Is any win large enough to justify the cost in §8 (a second engine to maintain against one
   maintainer)?

If the answer to (1) or (2) is "no," the *performance* driver evaporates and only the *familiarity*
driver (§1a) remains — which may still be a legitimate reason to ship an opt-in package, but a much
weaker one that this RFC does not pre-approve. **The benchmark is the evidence gate for the "why,"
not a formality.**

## 4. The shared `Router` contract (and the composition-surface gap)

For a radix package to be a *conformant NextRush router*, it must implement the structural `Router`
interface exported from `@nextrush/types` — the same contract `@nextrush/router` implements. That
interface is deliberately **registration + `routes()` + `getRoutes()` + `match()`** focused:

```ts
interface Router {
  // registration
  get/post/put/delete/patch/head/options(path, ...entries): this;
  all(path, ...entries): this;
  route(method, path, ...entries): this;
  redirect(from, to, status?): this;
  use(middleware: Middleware): this;          // middleware only — see the gap below

  // dispatch + introspection
  routes(): Middleware;                        // mount on the app
  getRoutes(): readonly RouteDefinition[];     // doc-time projection (openapi/SDK gen)
  match(method, path): RouteMatch | null;      // the hot path
}
```

### The composition-surface gap — the crux for a radix package

The shared interface **deliberately excludes the composition surface**. This is not an oversight;
it is documented on the interface itself (`packages/types/src/router.ts`): sub-router mounting
(`router.use(path, subRouter)`), `router.mount()`, and `router.group()` are **concrete
`@nextrush/router` capabilities, not part of the structural contract**, because mounting needs
internal tree access that a structural interface cannot express. Cross-package router composition
instead goes through `Application.route()` — the `Routable` interface, which needs only `routes()`.

That leaves a radix package two honest options, and this RFC's recommendation is explicit:

- **Contract floor (required, conformance-enforced):** implement registration + `routes()` +
  `getRoutes()` + `match()` exactly. This is the parity the conformance suite (§5) checks. A radix
  router that satisfies only this is already fully usable via `app.route('/prefix', radixRouter)`,
  because `Application.route()` consumes `routes()` alone.
- **Composition DX (optional, NOT contract-guaranteed):** `group()` / `mount()` / the
  `use(path, subRouter)` overload. A radix router *may* reimplement these as concrete class methods
  for DX parity, but because they are not in the shared interface, the conformance suite cannot and
  will not enforce them structurally. They would be characterized as **capability flags** on the
  conformance driver (§5), the same way the adapter suite encodes legitimate cross-adapter
  differences rather than skipping them.

Whether the composition surface should be *promoted into* the shared contract (so both routers are
forced to match on `group`/`mount`) is a real design decision — it is called out as an open
question in §9 and, if pursued, is part of the "contract hardening" step that must land *first*
(§6). This RFC does not silently assume it.

## 5. Conformance & parity — `@nextrush/router-conformance`

The strongest structural argument for a second router is that **this repo already runs exactly this
pattern for adapters**: many implementations of one contract, parity-enforced by a shared,
capability-flagged conformance suite (`packages/adapters/conformance`). The radix package earns its
place only if it can be held to the same bar.

### Modeled directly on `packages/adapters/conformance`

The adapter suite's design is the template:

- It exports `defineConformanceSuite(driver)` plus a `ConformanceDriver` contract; each adapter
  implements a driver that drives its *real* handler and normalizes the result.
- Legitimate differences are encoded as **capability flags** on the driver
  (`handlerTimeout504`, `teardownOnShutdown`, `transportAbortFiresSignal`) — asserted, never
  skipped.
- A certification matrix is **derived** from the same capability data the suite asserts, so a
  regression flips both a test and the matrix. "That coupling is what makes the matrix a real
  certification, not a claim."

The router analog, a new (unpublished) `packages/router/conformance` — `@nextrush/router-conformance`:

```ts
// The driver an implementation provides (implement once per router)
export interface RouterConformanceDriver {
  readonly name: string;                         // 'segment-trie' | 'radix'
  createRouter(options?: RouterOptions): Router;  // factory for the router under test
  // capability flags for legitimate, characterized differences (never skips):
  readonly supportsGroupMount: boolean;          // the §4 composition-surface gap
  readonly duplicateRouteThrows: boolean;        // registration-time conflict semantics
  // ...extended as real differences surface, exactly like the adapter flags
}

// The reusable suite (run against every driver)
export function defineRouterConformanceSuite(driver: RouterConformanceDriver): void;
```

The suite exercises the **shared contract's observable behavior**, not implementation details
(per `tdd-workflow.md`): static / param / wildcard matching, method resolution and 404/405,
`redirect()` status semantics, param percent-decoding (incl. malformed-encoding fallback),
case-sensitivity, trailing-slash / strict mode, duplicate-route conflict behavior, and the
`getRoutes()` projection. Composition (`group`/`mount`) is gated behind `supportsGroupMount`.

### Run against BOTH routers

`defineRouterConformanceSuite` runs against the segment-trie driver **and** the radix driver — the
same `describe.each(drivers)` shape the adapter suite uses. This is what makes "the radix router
behaves identically" *proven* rather than asserted. Critically (see §6), the **segment-trie router
is characterized by this suite first**, so the suite becomes the behavioral spec the radix router
must match, not a spec written after the fact to fit whatever radix happens to do.

## 6. Sequencing — contract & conformance first, radix second

Build order is non-negotiable and mirrors `tdd-workflow.md`'s "build the foundation first":

1. **Harden the contract (if needed).** Settle the §4 open question: does the composition surface
   stay concrete-only (capability-flagged) or get promoted into the shared `Router` interface? Any
   change to the *shipped* interface is a public-API change subject to its own RFC-approval step —
   it is **not** in this change's scope; this RFC only specifies what the hardened contract should
   be.
2. **Build the conformance harness and characterize the segment trie.** Author
   `@nextrush/router-conformance`, implement the segment-trie driver, and get the full suite green
   against the *existing* router. Now there is an executable behavioral spec.
3. **Then, and only if a driver is confirmed (§9), build `@nextrush/router-radix`** against that
   green suite — implement its driver, make the same suite pass, and only then wire it as an opt-in
   choice.

Steps 1–2 have standalone value even if the radix package is never built: characterizing the
segment-trie router with a reusable, capability-flagged suite hardens the router we already ship.
That is a deliberate hedge — the foundation work is not wasted if the go/no-go lands on "no."

## 7. Deferred, measurement-gated optimizations

One hot-path micro-optimization is captured here **as a design consideration, not a committed
change**, and is explicitly **measurement-gated on T017**:

**The `Reflect.deleteProperty` param-backtrack.** During the tree walk, `matchNodeIndexed`
(`matching.ts`) assigns `params[paramName] = ...` when it descends into a param child and, when
that subtree fails to match, calls `Reflect.deleteProperty(params, paramName)` to backtrack.
Assign-then-delete on the same object can push V8 out of a stable hidden class (toward
dictionary/slow mode) — a deopt on the single most-executed function in the framework.

- **Candidate alternative:** accumulate `[name, value]` pairs in an array during the walk and
  **materialize the params object once, only on a successful match** ("pair-array-then-materialize").
  No per-node property delete, so no hidden-class churn.
- **Why it is NOT done now:** it is a speculative rewrite of the framework's hottest function.
  `AGENTS.md` §11 and `engineering-standards.md` require "measure before optimizing," and bundling
  an expert-risk hot-path rewrite into unrelated work violates change hygiene (one concern per
  change). The related `hasParams` post-loop in `matchRoute` was already reviewed and **retained
  with a documented reason** for exactly this discipline.
- **What T017 decides:** (a) whether the deopt is real and material on realistic workloads at all,
  (b) whether it is worth retrofitting into the shipped segment-trie router, and (c) whether the
  greenfield radix package should **adopt pair-array-then-materialize from day one** — which it can
  do at zero retrofit risk, since it has no existing backtrack-delete behavior to preserve.

So T017 is the shared evidence gate for **both** the package's performance "why" (§3) and this
specific optimization. Neither is committed by this RFC.

## 8. Costs & risks

- **Maintenance & bus-factor (the dominant cost).** T059 flags this as a **single-maintainer**
  project. A second router doubles the surface that one person must keep correct: two matching
  engines, two sets of edge cases, the conformance harness itself, and the docs that explain the
  choice. This is the single strongest argument *against* building the package, and it must be
  weighed honestly against whatever driver (§3) is confirmed. A benchmarked-but-marginal win does
  not clear this bar; a large, reproducible win — or a strong, sustained familiarity demand — might.
- **Documentation split.** Two routers force a "which do I pick?" page. NextRush's convention-over-
  configuration ethos (`AGENTS.md` §8) says the framework should not push a decision onto users it
  can make for them. Mitigation: the docs must present the segment trie as the default and radix as
  a narrow, clearly-labeled opt-in with a stated reason — never a coin-flip.
- **Positioning — segment trie stays the default, radix is opt-in.** The segment-trie router
  **remains the default** and the one `createRouter()` returns. A radix router is an explicit,
  opt-in choice (e.g. a separate factory / package import) selected **for a stated reason**
  (confirmed Fastify-migrant demand and/or a benchmarked win), **never a forced or defaulted
  choice** and never a silent swap. Users who never opt in are unaffected.
- **Contract-drift risk.** Two implementations of one interface can diverge. Mitigation: this is
  precisely what the §5 conformance suite exists to prevent — the same lever the adapter suite pulls
  for four adapters.
- **Over-commitment risk.** An RFC could be read as a promise to build. Mitigation: the status is
  "Proposed — deferred," gated on a confirmed driver + T017; it can remain accepted-as-design and
  never-built with no inconsistency.

## 9. Non-goals & open questions

**Non-goals:**

- **Not building `@nextrush/router-radix` in this change.** This is an RFC only; the package is not
  created, and no `createRouter`-level default changes.
- **Not hardening the shipped `Router` interface now.** The RFC *specifies* what a hardened contract
  should cover (§4); changing the exported interface is future, separately-RFC-gated public-API work.
- **Not committing the `Reflect.deleteProperty` rewrite** (§7) — measurement-gated on T017.
- **Not changing the default router.** The segment trie stays default regardless of this RFC's fate.
- **Not replacing the segment-trie router.** If radix ships, both coexist behind one contract; radix
  is additive.

**Open questions:**

- **The concrete driver (the blocker).** Is the justification (a) Fastify-migrant familiarity, (b) a
  benchmarked performance win, both, or neither? **This RFC does not invent one.** It stays
  "Proposed — deferred" until the maintainer confirms a driver, and the performance leg is gated on
  the **T017 benchmark** — which is also the gate for the §7 optimization. No driver → no package.
- **Composition surface (§4):** do `group` / `mount` / `use(path, subRouter)` get promoted into the
  shared `Router` contract (forcing both routers to match), or stay concrete-only and
  capability-flagged in the conformance suite? Settled in the §6 step-1 contract-hardening.
- **Package name & entry point:** `@nextrush/router-radix` and how it is selected (separate factory
  vs. an option) — deferred to build time.
- **Radix flavor:** compressed radix à la `find-my-way`, or a simpler variant — deferred to build
  time and informed by T017.

## Acceptance / verification

This RFC is satisfied when: the file exists at `docs/RFC/RFC-NEXTRUSH-ROUTER-RADIX.md` following the
existing RFC convention (§ all); it defines the shared `Router` contract a conformant router must
implement (§4) and a conformance-parity harness modeled on `packages/adapters/conformance`, run
against both routers (§5); its costs section addresses the single-maintainer bus-factor and states
the segment-trie-default / radix-opt-in positioning (§8); and it records the
`Reflect.deleteProperty` / param-materialization item as measurement-gated on T017, not committed
(§7). No code ships with this RFC.
