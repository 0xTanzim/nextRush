# @nextrush/openapi

## 1.0.0-beta.0

### Patch Changes

- 70197bb: Fix `generateDocument()` silently emitting only 1 of 7 expected operations for an
  `@All()`/`app.all()` route.

  Previously, an `@All()` route produced 7 rows in the router's route table (one per HTTP method),
  so the generator naturally emitted one OpenAPI operation per row. As part of
  `@nextrush/router`'s `@All()` consolidation (now a single route-table row marked
  `isAnyMethod: true`), `generateDocument()` now explicitly expands an `isAnyMethod` row into one
  operation per standard HTTP verb (`get`/`post`/`put`/`delete`/`patch`/`head`/`options`), each with
  a distinct `operationId`. Before this fix, the same consolidation would have caused the generator
  to emit only a single operation for an `@All()` route — 6 of 7 methods silently missing from the
  generated spec. Non-`@All()` routes are unaffected; all 21 pre-existing tests pass unchanged.

- Updated dependencies [2820a4c]
- Updated dependencies [838367f]
  - @nextrush/types@4.0.0-beta.0

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

- 32a0db6: Add `@nextrush/openapi` — zero-config OpenAPI 3.1 generation, the first renderer of the Route Metadata System.

  `app.plugin(openapi({ router }))` reads `router.getRoutes()` (request schemas contributed by `validate()`, docs by `endpoint()`), converts schemas to JSON Schema (vendor-dispatch for Zod/Valibot/ArkType, with a `toJsonSchema` escape hatch), assembles an OpenAPI 3.1 document **once** (lazily on first request, then cached), and serves it at `/openapi.json` plus a Swagger UI at `/docs`. Routes marked `endpoint({ visibility: 'internal' })` or matching `exclude` are omitted.

  No decorators, no schema duplication — your existing `validate()` routes are the spec. Zero runtime dependencies; the request hot path never touches the generator.

### Patch Changes

- Updated dependencies [d7eb075]
- Updated dependencies [32a0db6]
  - @nextrush/types@3.1.0
