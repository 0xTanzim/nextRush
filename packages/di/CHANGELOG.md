# @nextrush/di

## 4.1.0

### Minor Changes

- [#63](https://github.com/0xTanzim/nextRush/pull/63) [`6004c48`](https://github.com/0xTanzim/nextRush/commit/6004c482727f50cd760d4ab55d3c6b7f033e018b) Thanks [@0xTanzim](https://github.com/0xTanzim)! - A JSON response's `Content-Type` is now `application/json`, with no `charset` parameter.

  **What changes.** Every framework-generated JSON response — a handler's `ctx.json()`, an object
  passed to `ctx.send()`, and the framework's own `404`/`500`/`504` envelope — carries
  `content-type: application/json` on every adapter. It previously carried
  `application/json; charset=utf-8`.

  ```ts
  // Before
  expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
  // After
  expect(res.headers.get('content-type')).toBe('application/json');
  ```

  **Why.** RFC 8259 §8.1 registers `application/json` with no parameters — JSON is UTF-8 by
  definition, so a `charset` parameter is one the specification does not define. Hono 4.13.0 and
  Express 5.2.1 already send the bare value; only Fastify sends the parameterised form. The earlier
  conformance rule that pinned the parameterised value existed to stop adapters drifting apart — Edge
  and Bun's server-level error path emitted a bare `application/json` while the shared helper emitted
  the parameterised form. Every adapter now goes through the one shared helper that emits the bare
  value, so the uniformity is preserved and the drift is gone.

  **Migration.** Applications that only _parse_ the media type are unaffected: JSON parsing keys off
  the `application/json` type, and the `charset` parameter was never required for it. Only an
  exact-string comparison needs updating. The value is now identical on every adapter, so one
  assertion update covers all of them.

  **What does not change.** The status, the body bytes, `Content-Length`, the header set, the
  multi-value `Set-Cookie` behaviour, `text/plain` and `text/html`, and every other response
  behaviour. Request parsing, routing, middleware ordering, `ctx.next()`, body limits, raw-body bytes,
  UTF-8 correctness, caching, streaming, and error status mapping are all untouched.

  **Why this is a minor release.** No exported API, status, body, or request behavior changes, and
  JSON parsing keys off the media type rather than the exact header string. The one observable
  difference is the `Content-Type` value: an application that compares it to the old parameterised
  string exactly must update that assertion as shown above. The maintainer classified that
  wire-visible difference as a minor change for this release line; it is documented here rather
  than left implicit.

  **Performance.** The change removes a per-request `Headers` allocation from every Web response,
  and the bare media type lets Deno's `Response` constructor take its static fast path — together
  **−16.6 % server CPU per request on Deno GET** and −8.1 % on Deno POST, measured against the
  previous release, with no regression on Bun or Node.

  **The request deadline no longer costs a timer per request.** A request that waits on I/O — a body
  read, a database call — is still pending when the timeout window opens, so the framework armed a
  `setTimeout` for it and cleared it when the request settled. That pair costs 2.15 µs on Deno
  against 0.16 µs on Bun, and it measured **8.28 µs of server CPU per request on Deno POST (+29.8 %)**.
  The deadline is now served by one shared timer per runner: the deadline value, the `504`, the
  `ctx.signal` cancellation, and the late-rejection guard are unchanged, and the measured effect is
  **−13.8 % on Deno POST and −10.4 % on Bun POST**, with no change on the GET fast path.

### Patch Changes

- Updated dependencies [[`57d4713`](https://github.com/0xTanzim/nextRush/commit/57d4713e607d071112db9250c9e6e7984214fc15), [`6004c48`](https://github.com/0xTanzim/nextRush/commit/6004c482727f50cd760d4ab55d3c6b7f033e018b), [`4bdf830`](https://github.com/0xTanzim/nextRush/commit/4bdf8303cbeed3bf4351d035935c44d5110f8738), [`a701579`](https://github.com/0xTanzim/nextRush/commit/a701579e7ac52bfeab8a5d8c539e07b40661e885)]:
  - @nextrush/types@4.1.0

## 4.0.2

### Patch Changes

- [`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Prepare the NextRush v4 ecosystem patch release with updates across core, routing, adapters, middleware, utilities, OpenAPI, testing, development tooling, and the create-nextrush scaffolder.

- Updated dependencies [[`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8)]:
  - @nextrush/types@4.0.2

## 4.0.1

### Patch Changes

- Updated dependencies []:
  - @nextrush/types@4.0.1

## 4.0.0

### Patch Changes

- [`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Consolidated patch release across all NextRush public packages.

- Updated dependencies [[`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9)]:
  - @nextrush/types@4.0.0

## 4.0.0-beta.2

### Patch Changes

- Consolidated patch release across all NextRush public packages.

- Updated dependencies []:
  - @nextrush/types@4.0.0-beta.2

## 4.0.0-beta.1

### Patch Changes

- Updated dependencies [[`207dbca`](https://github.com/0xTanzim/nextRush/commit/207dbca2ee20a0ce7a00fe6ee14615bbb56562a2)]:
  - @nextrush/types@4.0.0-beta.1

## 4.0.0-beta.0

### Patch Changes

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

### Patch Changes

- Updated dependencies [d7eb075]
- Updated dependencies [32a0db6]
  - @nextrush/types@3.1.0

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
