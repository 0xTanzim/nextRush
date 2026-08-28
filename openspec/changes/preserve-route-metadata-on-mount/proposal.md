# Proposal: Preserve Route Metadata During Router Mount

## Why

`Router.mount()` re-registers sub-router routes by reconstructing them from the
trie's dispatch state (`HandlerEntry`), which does not carry route metadata. As a
result, every mounted route keeps its runtime behavior but silently loses the
`ROUTE_METADATA` contributions collected at registration (`validate()` schemas,
`endpoint()` docs). `getRoutes()` on the parent returns `metadata: undefined` for
mounted routes, so `@nextrush/openapi` generates operations with no request
bodies, parameters, or response documentation — mounted routes execute correctly
while documenting incorrectly. This breaks the Route Metadata System's core
promise (RFC-002: one registration, documented everywhere) for the most common
composition pattern in the framework.

## What Changes

- Store the merged `RouteMetadata` (already computed at registration) on the
  internal trie `HandlerEntry` — registration-time state only; the dispatch hot
  path never reads it.
- Extend `copyRoutes()` to re-emit that metadata as a pure metadata marker entry
  when re-registering a copied route in the parent router, making the mount copy
  lossless for ALL contributors (`validate()`, `endpoint()`, and any future
  `ROUTE_METADATA` contributor) regardless of whether the contributor is runtime
  middleware or a pure marker.
- Widen the internal `AddRouteFn` callback signature from `RouteHandler[]` to
  `RouteEntry[]` (internal-only; no public API change).
- Add regression coverage: mounted `validate()` metadata, mounted `endpoint()`
  metadata, combined contributors, metadata-free routes unchanged, and runtime
  dispatch unchanged.

Not in scope: making `mount()` live/dynamic (routes registered after mounting
are still not copied), and `Application.route()` live-delegation introspection
(separate concern, tracked as follow-up).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `router`: ADD requirements making mounted-route introspection lossless —
  a route copied by `mount()`/`use(prefix, router)` MUST carry the same merged
  `RouteMetadata` in the parent's `getRoutes()` as it had on the sub-router
  (apart from the expected path-prefix transformation), for every contributor
  type, with runtime dispatch and the hot path unchanged. The `router` spec
  currently specifies matching/dispatch/performance behavior only; these are
  new composition-introspection guarantees on the same durable capability.

## Impact

- **Code**: `packages/router/src/segment-trie.ts` (`HandlerEntry`),
  `packages/router/src/registration.ts` (`addRoute` — keep merged metadata on
  the trie entry), `packages/router/src/composition.ts` (`copyRoutes` — re-emit
  metadata marker; widen `AddRouteFn`), `packages/router/src/router.ts`
  (private `addRoute` wrapper signature only if the compiler requires it).
- **Public API**: none. `HandlerEntry` and `AddRouteFn` are internal. Observable
  behavior change is additive: mounted routes now appear with metadata in
  `getRoutes()` (previously `metadata: undefined`).
- **Consumers**: `@nextrush/openapi` benefits without code changes;
  `@nextrush/class` registrar unaffected (registers via route entries, no
  trie-copy path).
- **Performance**: one optional field on trie `HandlerEntry` (memory only, set
  at registration). No request-path reads; the HP-18 hot-path guard and
  benchmark gates must confirm zero dispatch impact.
- **Docs**: `packages/router/README.md` + `ARCHITECTURE.md` (mount semantics
  and the metadata copy path), `docs/issue/mounted-subrouter-drops-route-metadata.md`
  closed at implementation.
- **Governance**: the durable decision ("route copies must be reconstruction-
  lossless; metadata persists on dispatch state") is an amendment to RFC-002
  (route metadata) and MUST land in `docs/RFC/request-data/002-route-metadata.md`
  (or a short ADR referencing it) before this change is archived.
