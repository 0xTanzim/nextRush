# nextrush

## 4.0.0

### Patch Changes

- [`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Consolidated patch release across all NextRush public packages.

- Updated dependencies [[`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9)]:
  - @nextrush/adapter-nextjs@1.0.0
  - @nextrush/adapter-node@4.0.0
  - @nextrush/class@1.0.0
  - @nextrush/core@4.0.0
  - @nextrush/di@4.0.0
  - @nextrush/errors@4.0.0
  - @nextrush/router@4.0.0
  - @nextrush/types@4.0.0

## 4.0.0-beta.2

### Patch Changes

- Consolidated patch release across all NextRush public packages.

- Updated dependencies []:
  - @nextrush/adapter-nextjs@1.0.0-beta.1
  - @nextrush/adapter-node@4.0.0-beta.2
  - @nextrush/class@1.0.0-beta.2
  - @nextrush/core@4.0.0-beta.2
  - @nextrush/di@4.0.0-beta.2
  - @nextrush/errors@4.0.0-beta.2
  - @nextrush/router@4.0.0-beta.2
  - @nextrush/types@4.0.0-beta.2

## 4.0.0-beta.1

### Patch Changes

- Updated dependencies [[`207dbca`](https://github.com/0xTanzim/nextRush/commit/207dbca2ee20a0ce7a00fe6ee14615bbb56562a2)]:
  - @nextrush/types@4.0.0-beta.1
  - @nextrush/adapter-node@4.0.0-beta.1
  - @nextrush/class@1.0.0-beta.1
  - @nextrush/core@4.0.0-beta.1
  - @nextrush/di@4.0.0-beta.1
  - @nextrush/errors@4.0.0-beta.1
  - @nextrush/router@4.0.0-beta.1

## 4.0.0-beta.0

### Major Changes

- 4231f6e: **BREAKING**: `nextrush`'s functional install no longer carries the class/DI stack, and
  `@nextrush/class`'s `RouteMetadata` type is renamed to `ControllerRouteMetadata`.

  **`nextrush`** (meta package): `@nextrush/class`, `@nextrush/di`, and `reflect-metadata` moved
  from `dependencies` to **optional `peerDependencies`**. A functional-only `pnpm add nextrush`
  no longer resolves the class runtime, the DI container, `tsyringe`, or `reflect-metadata` —
  closing the gap between the framework's "install only what you need" promise and what it
  actually shipped (see `report/framework/framework-composition-review.md`, F-01).

  **Migration:** if your project uses `nextrush/class` (decorators, DI, controllers), add the
  peer explicitly:

  ```bash
  pnpm add @nextrush/class reflect-metadata
  ```

  If you never install it, importing `nextrush/class` now fails with an actionable message
  naming the exact install command rather than an opaque module-resolution error. Projects
  scaffolded by `create-nextrush`'s **class-based** or **full** templates already add
  `@nextrush/class` for you — no action needed there.

  **`@nextrush/class`**: the decorator-storage interface `RouteMetadata` is renamed to
  `ControllerRouteMetadata`, reserving the name `RouteMetadata` for the single, unrelated,
  renderer-facing contract in `@nextrush/types` (re-exported via `nextrush`'s `.` entry). The two
  types had collided under one name with structurally incompatible shapes (F-02).

  **Migration:**

  ```ts
  // Before
  import type { RouteMetadata } from 'nextrush/class';

  // After
  import type { ControllerRouteMetadata } from 'nextrush/class';
  ```

  A `@deprecated` `RouteMetadata` alias for `ControllerRouteMetadata` ships in `nextrush/class`
  for this release only — it will be removed in the next major.

  **`create-nextrush`** (minor): the class-based and full templates now add `@nextrush/class`
  explicitly to the generated `package.json` (previously relied on it being a free transitive
  dependency of `nextrush`, which is no longer true after the change above).

  See `docs/guides/migration-framework-composition.md` for the full before/after guide and
  `docs/RFC/framework-composition/020-framework-composition-integrity.md` for the rationale.

- 793d596: **BREAKING**: Removed a batch of dead backward-compatibility aliases across several packages.
  Each had been superseded for at least one release and carried zero remaining internal use.

  **Adapters (`@nextrush/adapter-bun`, `-deno`, `-node`)**: removed the deprecated
  `ServeOptions.hostname` / `ServerInstance.hostname` fields. Use `host` instead — it was already
  the canonical field; `hostname` was accepted only as a fallback.

  **Adapters (`@nextrush/adapter-bun`, `-deno`, `-edge`)**: removed the `{Bun,Deno,Edge}BodySource`
  type/value aliases and their `create{Bun,Deno,Edge}BodySource` factory functions. Use
  `WebBodySource` / `createWebBodySource` from `@nextrush/runtime` — the aliases were pure
  re-exports pointing at the same implementation.

  **`@nextrush/core`**: removed the `createHttpError` alias. Use `createError` (same function,
  different name) from `@nextrush/core`, `@nextrush/errors`, or `nextrush`.

  **`@nextrush/errors`**: removed `ErrorContext` (use `Context` from `@nextrush/types`),
  `ErrorMiddleware` (use `Middleware` from `@nextrush/types`), and `catchAsync()` (it was a no-op
  wrapper — `return handler` — remove the call, your handler already works without it; async
  errors propagate to `errorHandler()` on their own).

  **`@nextrush/body-parser`**: removed the Node-stream fallback path — `BodyParserContext.raw`,
  the `RequestStream` interface, and the `BodyParserMiddleware` type alias (use `Middleware` from
  `@nextrush/types`). Body parsing now requires `ctx.bodySource`, which every current adapter
  (Node, Bun, Deno, Edge) already provides — this only affects a custom/third-party adapter that
  never implemented `bodySource`.

  **`@nextrush/helmet`**: removed `frameguard()`, the `frameguard` option on `helmet()`, and the
  `XFrameOptionsValue` type. `X-Frame-Options` is superseded by the Content-Security-Policy
  `frame-ancestors` directive, which every modern browser honors. Replace
  `helmet({ frameguard: 'DENY' })` with
  `helmet({ contentSecurityPolicy: { directives: { 'frame-ancestors': ["'none'"] } } })` (or
  `["'self'"]` for the `SAMEORIGIN` equivalent).

  **`@nextrush/cors`**: removed the `CorsMiddleware` type alias (confirmed zero real usage anywhere
  in this repo). Use `Middleware` from `@nextrush/types`.

  **`nextrush`** (meta package): re-exported `catchAsync` — bumped as a consequence of the
  `@nextrush/errors` removal above. `@nextrush/class` bumped patch since it re-exports
  `@nextrush/di` symbols that are unaffected, included only because its own test suite exercises
  `@nextrush/core`'s error re-exports.

  No migration tooling is provided for this batch — every replacement is a one-line rename or
  import-path swap (`frameguard` is the one exception, needing a CSP directive instead of a
  function call; see the table in
  [the upgrade guide](https://github.com/0xTanzim/nextRush/blob/main/apps/website/content/docs/migrate/upgrade-guide.mdx)
  for the full old → new mapping).

- 7a05218: **BREAKING**: Removed `@nextrush/controllers` and `@nextrush/decorators`.

  Both packages were pure compatibility shims — every export was a straight re-export from
  `@nextrush/class` (six DI symbols in `@nextrush/controllers` re-exported from `@nextrush/di`
  instead, with an identical end result). Neither package contained any logic of its own. A
  repo-wide sweep found zero internal consumers, and the migration tooling this removal depends on
  already existed and was already tested from the earlier class-consolidation effort.

  **Migration:**

  ```bash
  nextrush codemod consolidate-imports "src/**/*.ts"
  ```

  This automated codemod rewrites imports from either removed package into a single merged
  `nextrush/class` import, preserving `import type` and aliases, and is idempotent. Or migrate
  manually:

  ```diff
  - import { Controller, Get, UseGuard } from '@nextrush/decorators';
  - import { registerControllers } from '@nextrush/controllers';
  + import { Controller, Get, UseGuard, registerControllers } from 'nextrush/class';
  ```

  Every symbol either package re-exported remains available at its current location in
  `nextrush/class` (or `@nextrush/di` directly) — only the two old import paths are gone. See
  [Deprecations](https://github.com/0xTanzim/nextRush/blob/main/apps/website/content/docs/migrate/deprecations.mdx)
  for the complete symbol-by-symbol map.

  `nextrush` (the meta package) had `@nextrush/controllers` and `@nextrush/decorators` listed as
  direct dependencies with no code actually importing from either — both were removed from its
  `package.json`. `@nextrush/class`'s own version bumps because it is now the sole owner of the
  decorator/controller surface these two packages used to share responsibility for documenting and
  distributing, with no functional change to `@nextrush/class` itself.

### Patch Changes

- 1b9cf72: Ratified and documented NextRush's module-format policy: **ESM-only, permanently.**

  No `@nextrush/*` package's `exports` map will ever declare a `require` condition — this was
  already the de facto state, and is now a stated, non-negotiable architectural decision, not a
  default. Dual-publish (ESM + CommonJS) was formally evaluated and explicitly rejected (dual-
  package hazard risk on the `@nextrush/di` `reflect-metadata`/`tsyringe` path; the Node ≥22
  engine floor already covers the strongest historical case for dual-publishing via native
  `require(esm)`; the doubled, permanent build/test/publish cost across ~35 packages).

  No packaging change — this documents and enforces the existing state. CommonJS consumers use
  dynamic `import()`, or native `require(esm)` on Node ≥22.12 for synchronous import graphs.

  A new `pnpm validate:esm-only` check, wired into `pnpm verify`, fails CI if any package ever
  gains a `require` condition or drops `"type": "module"`.

- Updated dependencies [4ad3066]
- Updated dependencies [4231f6e]
- Updated dependencies [2820a4c]
- Updated dependencies [eee4462]
- Updated dependencies [793d596]
- Updated dependencies [7a05218]
- Updated dependencies [838367f]
- Updated dependencies [70197bb]
  - @nextrush/adapter-node@4.0.0-beta.0
  - @nextrush/class@4.0.0-beta.0
  - @nextrush/types@4.0.0-beta.0
  - @nextrush/core@4.0.0-beta.0
  - @nextrush/errors@4.0.0-beta.0
  - @nextrush/router@4.0.0-beta.0
  - @nextrush/di@4.0.0-beta.0

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

### Patch Changes

- Updated dependencies [d7eb075]
- Updated dependencies [0e2b399]
- Updated dependencies [32a0db6]
  - @nextrush/types@3.1.0
  - @nextrush/core@3.1.0
  - @nextrush/adapter-node@3.1.0
  - @nextrush/di@3.1.0
  - @nextrush/controllers@3.1.0
  - @nextrush/errors@3.1.0
  - @nextrush/router@3.1.0
  - @nextrush/decorators@3.1.0

## 3.0.7

### Patch Changes

- [#26](https://github.com/0xTanzim/nextRush/pull/26) [`c9723dd`](https://github.com/0xTanzim/nextRush/commit/c9723ddb29e4bf834625f294eadb0c9e1c28432e) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Simplify template code and auto-install dev package

- Updated dependencies [[`c9723dd`](https://github.com/0xTanzim/nextRush/commit/c9723ddb29e4bf834625f294eadb0c9e1c28432e)]:
  - @nextrush/core@3.0.7
  - @nextrush/adapter-node@3.0.7
  - @nextrush/controllers@3.0.7
  - @nextrush/router@3.0.7
  - @nextrush/types@3.0.7
  - @nextrush/errors@3.0.7
  - @nextrush/di@3.0.7
  - @nextrush/decorators@3.0.7

## 3.0.6

### Patch Changes

- [#23](https://github.com/0xTanzim/nextRush/pull/23) [`9f1d44e`](https://github.com/0xTanzim/nextRush/commit/9f1d44ebc7807955a5d218c2b52a228911a06236) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Fix CLI install reliability:
  - Ensure the `nextrush` meta-package never declares a `bin` entry (prevents pnpm bin-link conflicts).
  - Ensure `@nextrush/dev` always builds before publish so `nextrush`/`nextrush-dev` binaries work.
  - Add a repo-wide bin validator to catch missing `bin` targets during verification.
  - Scaffold projects with `nextrush dev` / `nextrush build` scripts (no `npx`).
  - Include `@nextrush/dev` in scaffolded dev dependencies so fresh installs expose the local CLI.

- Updated dependencies []:
  - @nextrush/types@3.0.6
  - @nextrush/errors@3.0.6
  - @nextrush/core@3.0.6
  - @nextrush/router@3.0.6
  - @nextrush/di@3.0.6
  - @nextrush/decorators@3.0.6
  - @nextrush/controllers@3.0.6
  - @nextrush/adapter-node@3.0.6

## 3.0.5

### Patch Changes

- [#21](https://github.com/0xTanzim/nextRush/pull/21) [`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

- Updated dependencies [[`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5)]:
  - @nextrush/adapter-node@3.0.5
  - @nextrush/controllers@3.0.5
  - @nextrush/decorators@3.0.5
  - @nextrush/dev@3.0.5
  - @nextrush/di@3.0.5
  - @nextrush/errors@3.0.5
  - @nextrush/router@3.0.5
  - @nextrush/types@3.0.5
  - @nextrush/core@3.0.5

## 3.0.4

### Patch Changes

- Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

- Updated dependencies []:
  - @nextrush/adapter-node@3.0.4
  - @nextrush/controllers@3.0.4
  - @nextrush/decorators@3.0.4
  - @nextrush/dev@3.0.4
  - @nextrush/di@3.0.4
  - @nextrush/errors@3.0.4
  - @nextrush/router@3.0.4
  - @nextrush/types@3.0.4
  - @nextrush/core@3.0.4

## 3.0.3

### Patch Changes

- Patch **3.0.3**: **`nextrush`** ships the **`nextrush`** CLI via **`@nextrush/dev`**; **`@nextrush/dev`** skips false-positive decorator `tsconfig` warnings on functional scaffolds; **`create-nextrush`** / docs / plugin metadata aligned to **3.0.3**.

- Updated dependencies []:
  - @nextrush/adapter-node@3.0.3
  - @nextrush/controllers@3.0.3
  - @nextrush/decorators@3.0.3
  - @nextrush/dev@3.0.3
  - @nextrush/di@3.0.3
  - @nextrush/errors@3.0.3
  - @nextrush/router@3.0.3
  - @nextrush/types@3.0.3
  - @nextrush/core@3.0.3

## 3.0.1

### Patch Changes

- [#15](https://github.com/0xTanzim/nextRush/pull/15) [`6c37c2f`](https://github.com/0xTanzim/nextRush/commit/6c37c2f1a60c24eda5fba50c7543627104fb776c) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Sync package metadata and documentation URLs, and ensure package-level homepage/readme publishing metadata is consistent across released packages.

- Updated dependencies []:
  - @nextrush/types@3.0.1
  - @nextrush/errors@3.0.1
  - @nextrush/core@3.0.1
  - @nextrush/router@3.0.1
  - @nextrush/di@3.0.1
  - @nextrush/decorators@3.0.1
  - @nextrush/controllers@3.0.1
  - @nextrush/adapter-node@3.0.1
