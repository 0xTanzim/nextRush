# create-nextrush

## 1.1.0

### Minor Changes

- [#47](https://github.com/0xTanzim/nextRush/pull/47) [`8b456d2`](https://github.com/0xTanzim/nextRush/commit/8b456d2f19f36aa99acd0daebb55dd7687ee41b7) Thanks [@0xTanzim](https://github.com/0xTanzim)! - feat(class-based): proper feature-module scaffold — root `AppModule` composes feature modules via `@Module({ imports })` under `src/modules/<feature>/`; health + todos features demonstrate constructor DI, full CRUD decorators (`@Param`/`@Body`/`@Query`/`@HttpCode`), `@Repository`, and `HttpError` paths.

  feat(functional): todos CRUD feature — `src/routes/todos.ts` handlers using `ctx.params`/`ctx.query`/`ctx.body`/`ctx.status`/`ctx.throw`, backed by a pure `createTodoStore()` factory (`src/routes/todos-data.ts`) with unit tests.

## 1.0.1

### Patch Changes

- [#45](https://github.com/0xTanzim/nextRush/pull/45) [`c3604bc`](https://github.com/0xTanzim/nextRush/commit/c3604bca67b29c2fa292d2d23a2cf55794c4f819) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Scaffolded projects now pin `compilerOptions.types: ["node"]` in the generated
  tsconfig.json. TypeScript >= 6 no longer auto-includes `@types/*` when `types` is
  omitted, so a generated project failed `tsc --noEmit` with TS2591 ("Cannot find
  name 'process'") out of the box even though `@types/node` is installed as a
  devDependency (issue [#40](https://github.com/0xTanzim/nextrush/issues/40)). The explicit pin restores the type-checking a scaffolded
  app expects, matching the `@types/node` devDependency the scaffolder always installs.

## 1.0.0

### Patch Changes

- [`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Consolidated patch release across all NextRush public packages.

## 1.0.0-beta.1

### Patch Changes

- Consolidated patch release across all NextRush public packages.

## 1.0.0-beta.0

### Minor Changes

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

## 3.0.9

### Patch Changes

- [#31](https://github.com/0xTanzim/nextRush/pull/31) [`d599592`](https://github.com/0xTanzim/nextRush/commit/d599592e28a499d57a25f234ca455c5d960bdb40) Thanks [@0xTanzim](https://github.com/0xTanzim)! - versions retrieve issue fix

## 3.0.8

### Patch Changes

- [#29](https://github.com/0xTanzim/nextRush/pull/29) [`39d1bed`](https://github.com/0xTanzim/nextRush/commit/39d1bedb098d751c9b464a3d16bfbcc67eb378d9) Thanks [@0xTanzim](https://github.com/0xTanzim)! - version mismatch fix. The generated `package.json` should use `^3.0.0` for `nextrush` and related packages, not the exact version from `constants.js`. This allows users to get compatible updates without being locked to a specific version.

## 3.0.7

### Patch Changes

- [#26](https://github.com/0xTanzim/nextRush/pull/26) [`c9723dd`](https://github.com/0xTanzim/nextRush/commit/c9723ddb29e4bf834625f294eadb0c9e1c28432e) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Simplify template code and auto-install dev package

## 3.0.6

### Patch Changes

- [#23](https://github.com/0xTanzim/nextRush/pull/23) [`9f1d44e`](https://github.com/0xTanzim/nextRush/commit/9f1d44ebc7807955a5d218c2b52a228911a06236) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Fix CLI install reliability:
  - Ensure the `nextrush` meta-package never declares a `bin` entry (prevents pnpm bin-link conflicts).
  - Ensure `@nextrush/dev` always builds before publish so `nextrush`/`nextrush-dev` binaries work.
  - Add a repo-wide bin validator to catch missing `bin` targets during verification.
  - Scaffold projects with `nextrush dev` / `nextrush build` scripts (no `npx`).
  - Include `@nextrush/dev` in scaffolded dev dependencies so fresh installs expose the local CLI.

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

### Patch Changes

- [#15](https://github.com/0xTanzim/nextRush/pull/15) [`6c37c2f`](https://github.com/0xTanzim/nextRush/commit/6c37c2f1a60c24eda5fba50c7543627104fb776c) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Sync package metadata and documentation URLs, and ensure package-level homepage/readme publishing metadata is consistent across released packages.
