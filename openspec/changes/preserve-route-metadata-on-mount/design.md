# Design: Preserve Route Metadata During Router Mount

## Context

The Route Metadata System (RFC-002, `docs/RFC/request-data/002-route-metadata.md`)
collects `ROUTE_METADATA` contributions at registration and merges them into a
side registry (`RegistrationState.routeDefinitions`) consumed by `getRoutes()`.
The trie's `HandlerEntry` (`packages/router/src/segment-trie.ts`) intentionally
stores only dispatch state — `{ handler, middleware, executor, autoHead }` —
keeping the hot path free of introspection data.

`copyRoutes()` (`packages/router/src/composition.ts`) reconstructs routes from
the trie alone: `addRoute(method, path, [entry.handler], combined)`. The merged
metadata computed at the sub-router's registration is unreachable from the trie,
so every mounted route registers with `metadata: undefined`. See
`docs/issue/mounted-subrouter-drops-route-metadata.md` and proposal.md for the
repro.

Constraints that shape this design:

- The request hot path is a guarded invariant (HP-18 patterns, allocation and
  parity gates, interleaved A/B benchmarks). Metadata retention must not touch
  dispatch.
- The `router` package sits low in the package hierarchy; no new dependencies.
- `HandlerEntry` and `AddRouteFn` are internal — widening them is not a public
  API change (locked surfaces are guarded by public-surface tests that this
  change must not trip).

## Goals / Non-Goals

**Goals:**

- Make the mount copy reconstruction-lossless: the parent re-derives a route's
  full registration semantics, including metadata.
- Preserve the "metadata comes from route entries" invariant in `addRoute()` —
  one collection path, no second discovery mechanism.
- Keep dispatch behavior and hot-path performance bit-for-bit unchanged.

**Non-Goals:**

- Live/synchronized mounts (routes registered on the sub-router after `mount()`
  remain uncopied — pre-existing semantics, documented separately).
- `Application.route()` live-delegation introspection (separate follow-up).
- New contributor APIs or changes to `ROUTE_METADATA`/`mergeContributions`
  semantics.

## Decisions

### D1: Carry merged metadata on the trie entry (Option B), re-emitted as a marker at copy time

`addRoute()` already computes `mergeContributions(contributions)` for the
introspection row. That merged result is additionally stored on the trie's
`HandlerEntry`:

```ts
interface HandlerEntry {
  handler: RouteHandler;
  middleware: Middleware[];
  executor: RouteExecutor;
  autoHead: boolean;
  metadata?: RouteMetadata;   // registration-time only; dispatch never reads it
}
```

`copyRoutes()` then re-registers each copied route with the metadata re-emitted
as a pure metadata entry:

```ts
addRoute(method, path, [entry.handler, metadataMarker(entry.metadata)], combined)
```

where `metadataMarker(meta)` is an internal `{ [ROUTE_METADATA]: meta }` object
(the existing `RouteMetaMarker` shape — no new protocol concept).

**Why:** it fixes the representation boundary. The bug exists because the trie
holds *less than a route is*; making it hold the one missing fact means every
present and future contributor (`validate()`, `endpoint()`, anything carrying
`ROUTE_METADATA`) survives the copy without `copyRoutes()` knowing contributor
shapes.

**Alternatives rejected:**

- **Option A — scan the middleware array in `addRoute()`:** rescues
  function-middleware contributors only; `endpoint()` markers never reach the
  trie's middleware list. Correctness would depend on where a contributor lands
  in the reconstruction — an accident of representation. Rejected.
- **Option C — A + B together:** double-merges `validate()`'s contribution
  (once from the middleware scan, once from the re-emitted marker). Correctness
  must not rely on merge idempotence. Rejected.

### D2: Metadata flows from `mergeContributions`, not re-derivation

`HandlerEntry.metadata` stores the same merged object pushed to
`routeDefinitions` (computed once per registration). No re-scanning of entries
at copy time; `copyRoutes()` reads the finished fact.

Corollary: for `Router.all()` routes, `addRoute()` runs with
`recordIntrospection = false` per method — the merge currently happens only
under that flag. The implementation MUST compute and store metadata on the
`HandlerEntry` regardless of `recordIntrospection`, so any-method routes also

### D3: `AddRouteFn` widens from `RouteHandler[]` to `RouteEntry[]`

`copyRoutes`' injected callback and `Router`'s private `addRoute` wrapper accept
`RouteEntry[]` so a pure marker can be passed alongside the handler. Both are
internal; the public `router.post(...)`-style entry list already accepts
markers. Registering a metadata-bearing copy therefore reuses the *same*
collection path as direct registration — no special case in `addRoute()`.

### D4: `autoHead` semantics unchanged

`copyRoutes()` continues to skip derived HEAD entries; the parent re-derives
HEAD from the copied GET registration and derives no metadata row for it
(unchanged behavior — HEAD is not introspected separately today). The GET
route's metadata is preserved and travels with the GET copy.

## Risks / Trade-offs

- **[Memory] Every trie `HandlerEntry` may now hold a metadata reference** →
  Optional field; `undefined` for the (majority) metadata-free routes. One
  object reference per metadata-bearing route, set once at registration — not
  per request. Allocation/parity benchmarks confirm.
- **[Hot path] Regression risk if dispatch ever reads `metadata`** → The field
  is write-only at registration; dispatch code does not reference it. The HP-18
  guard suite and the existing benchmark gates are the enforcement point;
  the A/B dispatch benchmark stays in CI.
- **[Duplicate merging] A future change adding another copy-time contribution
  path could double-merge** → This change establishes the single rule: copies
  re-emit metadata exactly once, as one marker entry. The regression tests
  assert no-duplicate-merge explicitly.
- **[Shared reference mutation] `routeDefinitions` row and `HandlerEntry`
  share one merged object** → `RouteMetadata` fields are `readonly`; treat the
  merged value as frozen-by-convention. If a contributor later returns mutable
  structures, freeze at merge time (`Object.freeze` on the merged result) —
  noted as an implementation guard in tasks.
- **[Public surface] Widening internal signatures could leak into public
  types** → `AddRouteFn`/`HandlerEntry` are not exported through the package
  public surface; `public-surface-lock` tests must stay green.

## Migration Plan

No migration. Additive internal change; behavior for existing applications is
unchanged except that mounted routes now document correctly. Rollback is a
plain revert.

## Open Questions

- Whether the merged `RouteMetadata` should be `Object.freeze`d eagerly (cheap,
  registration-time) or left by convention — implementation detail; tasks
  default to freezing the merged result.
- Whether `Application.route()` live-delegation introspection should eventually
  aggregate sub-router `getRoutes()` — explicitly out of scope here; follow-up
  change.

copy losslessly (the consolidated row keeps its own recording behavior).
