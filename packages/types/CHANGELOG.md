# @nextrush/types

## 4.0.0-beta.0

### Minor Changes

- 2820a4c: Enforce the two-tier adapter contract (RFC-NEXTRUSH-ADAPTER-CONTRACT).

  - **`@nextrush/types`**: add the `AdapterContextFactory<Args, Ctx>` type, formalizing the shared "adapters build `Context` via a factory and run `app.callback()`" invariant at the type level. Additive — the existing `ServerAdapter`/`FetchAdapter`/`ServerHandle` contracts are unchanged.
  - **Adapters**: add a compile-time context-factory conformance guard to the node (ServerAdapter tier) and edge (FetchAdapter tier) adapters, so a drift in the context factory's return type stops compiling. The pre-existing shape guards (`serve`/`createHandler`/`createFetchHandler`) remain. Internal, non-exported — no public surface change.

  Also adds negative type-enforcement tests to `@nextrush/types` proving a malformed adapter (missing method, wrong return type) fails to satisfy the contract.

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

## 3.1.0

### Major Changes

- d7eb075: Extension Model — replace the plugin system with Composition-First (RFC-NEXTRUSH-PLUGIN-SYSTEM).

  **Breaking changes**
  - **Removed the plugin system.** `Plugin`, `PluginWithHooks`, `PluginMeta`, `PluginFactory`, `ApplicationLike`, `app.plugin()`, `app.pluginAsync()`, `app.getPlugin()`, `app.hasPlugin()`, and the deprecated `app.onError()` setter are gone.
  - **New `Extension` contract** (`@nextrush/types`): `{ name, needs?, setup(ctx), destroy? }`, registered via `app.extend()` and booted at `app.ready()` (a deferred boot barrier that adapters call automatically before serving — eliminating the un-awaited-async-plugin race). Extensions decorate the app via the extension-only `ctx.decorate()`; `app.hasDecorator()` is the public read side. Error handling: use `app.setErrorHandler()`.
  - **App-owned router.** `Application` accepts `{ router }`; `app.get/post/put/patch/delete/head/all` delegate to it and it mounts last at `ready()`. `nextrush`'s `createApp()` injects a default router (batteries-included); `@nextrush/core`'s `createApp()` is bring-your-own-router. (No `app.options()` verb — it collides with the config property; use `app.all()`/CORS for OPTIONS.)
  - **Per-app DI container.** The container contract moved to `@nextrush/types` (`Container`); `@nextrush/di` re-exports it (the previous `ContainerInterface` alias has been removed — use `Container` directly). Each app owns its container (`app.container`, `createApp({ container })`), exposed to extensions via `ExtensionContext.container`.
  - **Package reclassification:** `@nextrush/events` → an Extension (`events()`); `@nextrush/openapi` → middleware (`app.use(openapi({ router }))`); `@nextrush/template` → middleware only (`templatePlugin()` removed); `@nextrush/controllers` → `registerControllers(app, options)` registrar (`ControllersPlugin`/`controllersPlugin` removed, `ControllersPluginOptions` → `ControllersOptions`). Adapter `serve()`/`listen()` are now async on Bun and Deno.

  See `docs/guides/migration-extension-model.md` for a full before/after guide.

### Minor Changes

- 32a0db6: Add the Route Metadata System — the framework-level foundation that lets any tool (OpenAPI, and later SDK/Postman/RPC generators) read a route's request/response shapes and documentation without duplication.
  - **`@nextrush/types`**: new `RouteDefinition` / `RouteMetadata` contracts and the `ROUTE_METADATA` contribution symbol. `StandardSchemaV1` moved here (from `@nextrush/validation`) as a shared contract.
  - **`@nextrush/router`**: new `endpoint()` metadata marker and `getRoutes(): readonly RouteDefinition[]` introspection. The router collects each route's metadata at registration by partitioning entries (functions run; pure markers contribute only) and merging contributions. Metadata lives in a side registry — the request hot path (`match()`, `HandlerEntry`, trie nodes) is byte-identical, and an interleaved A/B benchmark confirmed dispatch throughput is unchanged.
  - **`@nextrush/validation`**: `validate()` now contributes its request schemas via the protocol (non-enumerable internal marker — public API unchanged), so validated routes are documented for free.
  - **`@nextrush/controllers`**: class-based routes now contribute decorator documentation (`@Controller({ tags })`, `@Get/@Post({ description, deprecated })`) into their `RouteDefinition` via the same protocol, so controller routes appear fully documented in the spec alongside functional routes.
  - **`nextrush`**: re-exports `endpoint()` (and the `RouteDefinition` / `RouteMetadata` types) so it sits next to `createRouter` — `import { endpoint } from 'nextrush'`.

  Additive and backward-compatible: existing route registration and dispatch are unaffected.

## 3.0.7

## 3.0.6

## 3.0.5

### Patch Changes

- [#21](https://github.com/0xTanzim/nextRush/pull/21) [`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

## 3.0.4

### Patch Changes

- Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

## 3.0.3

### Patch Changes

- Patch **3.0.3**: **`nextrush`** ships the **`nextrush`** CLI via **`@nextrush/dev`**; **`@nextrush/dev`** skips false-positive decorator `tsconfig` warnings on functional scaffolds; **`create-nextrush`** / docs / plugin metadata aligned to **3.0.3**.

## 3.0.1
