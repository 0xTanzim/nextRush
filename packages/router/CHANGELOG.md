# @nextrush/router

## 4.0.0-beta.1

### Patch Changes

- Updated dependencies [[`207dbca`](https://github.com/0xTanzim/nextRush/commit/207dbca2ee20a0ce7a00fe6ee14615bbb56562a2)]:
  - @nextrush/types@4.0.0-beta.1
  - @nextrush/core@4.0.0-beta.1

## 4.0.0-beta.0

### Patch Changes

- 838367f: Router documentation accuracy, an internal `router.ts` split, and audit-flagged deduplication —
  all non-breaking (public-surface snapshot byte-identical; 212/212 behavioral tests green).

  - **`@nextrush/router`**: finished splitting `router.ts` so every shipping source file is now
    under the 300-line ceiling (`router.ts` is 298 lines; the remaining logic moved into focused
    internal modules `dispatch.ts`, `state.ts`, and `constants.ts` plus existing siblings, along the
    same seams the earlier modularity split used — no new structural pattern). Resolved the router
    audit's flagged duplications: `EMPTY_PARAMS` now has a single definition in a leaf `constants.ts`
    module, and the route-matching / allowed-methods path-normalization logic is consolidated into
    one shared `normalizePathForMatch` helper. Corrected the residual "radix tree" wording to
    "segment trie" across the README and the `TrieNode.children` JSDoc (which now accurately states
    children are keyed by whole path segment, not by first character). No exported symbol, signature,
    or runtime behavior changed — confirmed by the package's public-surface snapshot test and full
    suite.

  - **`@nextrush/types`**: documentation-comment-only correction. The `router.ts` type header no
    longer claims the router "uses a radix tree for efficient route matching"; it now accurately
    describes the segment trie keyed by whole path segments (O(k) lookups). No type, signature, or
    export change.

- 70197bb: Three small papercut fixes, batched because they touch the same class/router package pair:

  - **`@nextrush/router`**: `router.ts` (918 lines) split into `matching.ts`, `match-route.ts`,
    `composition.ts`, `middleware-adapter.ts`, and `registration.ts` along its existing thematic
    seams (matching engine, sub-router composition, middleware adaptation, route registration).
    `Router`'s public shape, exported symbols, and dispatch behavior are unchanged — confirmed via
    the package's public-surface snapshot test (byte-identical before/after) and the full
    behavioral suite (212/212 passing at every extraction step, not just at the end). Purely
    internal file reorganization.

  - **`@nextrush/router` + `@nextrush/class`**: `@All()`/`app.all()` (and `router.group(...).all()`)
    now register a single ANY-method route-table entry instead of one entry per explicitly-
    enumerated HTTP method. All 7 standard verbs still match an `@All()` route identically — this
    changes only what `getRoutes()` reports for an `@All()` route (1 row instead of 7), not
    dispatch. `@nextrush/openapi`, the one in-repo consumer of `getRoutes()` found via a codebase-
    wide search, was updated in the same change: previously it silently emitted only 1 of 7
    expected operations for an `@All()` route in a generated OpenAPI spec (a real correctness bug),
    now it correctly expands an ANY-method row into one operation per standard verb. New,
    additive `RouteDefinition.isAnyMethod?: boolean` field in `@nextrush/types`.

  - **`@nextrush/class`**: `@Body()` resolving to nothing because no body-parser middleware ran now
    throws a `MissingParameterError` whose message names the likely fix (`app.use(json())`),
    instead of the same generic message used for every other missing-parameter case. Other
    parameter sources (`@Param`, `@Query`, `@Header`) are unaffected — the hint is scoped to the
    body source specifically, where "no parser ran" is the common, previously-unexplained cause.

- Updated dependencies [2820a4c]
- Updated dependencies [eee4462]
- Updated dependencies [793d596]
- Updated dependencies [838367f]
  - @nextrush/types@4.0.0-beta.0
  - @nextrush/core@4.0.0-beta.0

## 3.1.0

### Minor Changes

- 32a0db6: Add the Route Metadata System — the framework-level foundation that lets any tool (OpenAPI, and later SDK/Postman/RPC generators) read a route's request/response shapes and documentation without duplication.
  - **`@nextrush/types`**: new `RouteDefinition` / `RouteMetadata` contracts and the `ROUTE_METADATA` contribution symbol. `StandardSchemaV1` moved here (from `@nextrush/validation`) as a shared contract.
  - **`@nextrush/router`**: new `endpoint()` metadata marker and `getRoutes(): readonly RouteDefinition[]` introspection. The router collects each route's metadata at registration by partitioning entries (functions run; pure markers contribute only) and merging contributions. Metadata lives in a side registry — the request hot path (`match()`, `HandlerEntry`, trie nodes) is byte-identical, and an interleaved A/B benchmark confirmed dispatch throughput is unchanged.
  - **`@nextrush/validation`**: `validate()` now contributes its request schemas via the protocol (non-enumerable internal marker — public API unchanged), so validated routes are documented for free.
  - **`@nextrush/controllers`**: class-based routes now contribute decorator documentation (`@Controller({ tags })`, `@Get/@Post({ description, deprecated })`) into their `RouteDefinition` via the same protocol, so controller routes appear fully documented in the spec alongside functional routes.
  - **`nextrush`**: re-exports `endpoint()` (and the `RouteDefinition` / `RouteMetadata` types) so it sits next to `createRouter` — `import { endpoint } from 'nextrush'`.

  Additive and backward-compatible: existing route registration and dispatch are unaffected.

### Patch Changes

- Updated dependencies [d7eb075]
- Updated dependencies [32a0db6]
  - @nextrush/types@3.1.0
  - @nextrush/core@3.1.0

## 3.0.7

### Patch Changes

- Updated dependencies [[`c9723dd`](https://github.com/0xTanzim/nextRush/commit/c9723ddb29e4bf834625f294eadb0c9e1c28432e)]:
  - @nextrush/core@3.0.7
  - @nextrush/types@3.0.7

## 3.0.6

### Patch Changes

- Updated dependencies []:
  - @nextrush/types@3.0.6
  - @nextrush/core@3.0.6

## 3.0.5

### Patch Changes

- [#21](https://github.com/0xTanzim/nextRush/pull/21) [`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

- Updated dependencies [[`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5)]:
  - @nextrush/types@3.0.5
  - @nextrush/core@3.0.5

## 3.0.4

### Patch Changes

- Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

- Updated dependencies []:
  - @nextrush/types@3.0.4
  - @nextrush/core@3.0.4

## 3.0.3

### Patch Changes

- Patch **3.0.3**: **`nextrush`** ships the **`nextrush`** CLI via **`@nextrush/dev`**; **`@nextrush/dev`** skips false-positive decorator `tsconfig` warnings on functional scaffolds; **`create-nextrush`** / docs / plugin metadata aligned to **3.0.3**.

- Updated dependencies []:
  - @nextrush/types@3.0.3
  - @nextrush/core@3.0.3

## 3.0.1

### Patch Changes

- Updated dependencies []:
  - @nextrush/types@3.0.1
  - @nextrush/core@3.0.1
