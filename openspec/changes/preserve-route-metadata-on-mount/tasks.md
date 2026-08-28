## 1. Failing regression tests (RED)

- [x] 1.1 Add a failing test in `packages/router/src/__tests__/route-metadata.test.ts`: a sub-router route registered with a validating middleware (carrying `ROUTE_METADATA`) keeps its request-schema metadata in the parent's `getRoutes()` after `mount()` — verify with `pnpm vitest run route-metadata` (new test fails)
- [x] 1.2 Add a failing test: a sub-router route registered with an `endpoint()` marker keeps summary/tags/responses metadata in the parent's `getRoutes()` after `mount()` — verify the new test fails
- [x] 1.3 Add a failing test: a route with combined contributors (validating middleware + `endpoint()` marker) exposes the complete merged metadata after mounting, content-equal to the sub-router's `getRoutes()` entry apart from the prefix-transformed path — verify the new test fails
- [x] 1.4 Add tests: mounting does not merge the same contribution twice (parent contributes nothing; metadata content-equal, not doubled), and metadata-free mounted routes stay `metadata: undefined` — verify they fail/pass as expected against current behavior (no-duplicate test fails, metadata-free passes)
- [x] 1.5 Add tests: derived HEAD entries are still not copied (parent re-derives; GET metadata preserved) and a sub-router `all()` route's per-method copies carry metadata in the parent — verify per current behavior

## 2. Core implementation (GREEN)

- [x] 2.1 Extend `HandlerEntry` in `packages/router/src/segment-trie.ts` with optional `metadata?: RouteMetadata` (registration-time only) and verify `tsc --noEmit` in the router package passes
- [x] 2.2 In `packages/router/src/registration.ts`, compute `mergeContributions(contributions)` unconditionally (independent of `recordIntrospection`), `Object.freeze` the merged result, store it on the trie `HandlerEntry`, and keep pushing the same merged value into `routeDefinitions` — verify tests 1.1–1.3 still fail (copy path not yet fixed) and existing router tests pass
- [x] 2.3 In `packages/router/src/composition.ts`, widen `AddRouteFn` from `RouteHandler[]` to `RouteEntry[]`, add an internal metadata-marker helper (existing `RouteMetaMarker` shape), and re-emit `entry.metadata` as a marker entry exactly once per copied route — verify tests 1.1–1.5 now pass
- [x] 2.4 Widen `Router`'s private `addRoute` wrapper signature in `packages/router/src/router.ts` if required by the compiler, with no public-surface change — verify full router test suite passes

## 3. Gates (verification)

- [x] 3.1 Run the full router package test suite (`pnpm vitest run` in `packages/router`) — all green including differential-corpus and head-auto-registration suites
- [x] 3.2 Run public-surface-lock tests (`packages/types` and router surface) — green, no public API change
- [x] 3.3 Run per-package gates for `packages/router`: line coverage ≥ 90%, ESLint clean, `tsc` strict clean — all pass
- [x] 3.4 Run the hot-path guard suite (HP-18 patterns), `bench:validate`, and a CPU-pinned interleaved A/B dispatch benchmark (metadata-free and metadata-bearing routes) — no regression attributable to metadata retention; record results

## 4. Docs & governance

- [x] 4.1 Update `packages/router/README.md` and `ARCHITECTURE.md`: mount semantics now preserve route metadata; document the metadata copy path and the eager-copy limitation (routes registered after `mount()` are not copied) — verify docs build/render and statements match tests
- [x] 4.2 Record the durable decision as an RFC-002 amendment (or short ADR referencing it) in `docs/RFC/`: "route copies must be reconstruction-lossless; merged metadata persists on registration-time dispatch state" — required before this change is archived
- [x] 4.3 Add `@nextrush/router` changelog entry (mounted routes preserve metadata; internal-only change, no public API change) — verify entry matches shipped behavior
- [x] 4.4 Update `docs/issue/mounted-subrouter-drops-route-metadata.md` status to Fixed with the change reference; add an end-to-end verification note that `@nextrush/openapi` includes mounted routes' request bodies and endpoint docs — verify by running the openapi integration path against a mounted router
- [ ] 4.5 Run `openspec validate "preserve-route-metadata-on-mount" --strict` and the repo lint/build — all green; commit the change as a conventional commit per AGENTS.md §20
