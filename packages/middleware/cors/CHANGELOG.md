# @nextrush/cors

## 4.0.0-beta.1

### Patch Changes

- Consolidated patch release across all NextRush public packages.

- Updated dependencies []:
  - @nextrush/types@4.0.0-beta.2

## 4.0.0-beta.0

### Major Changes

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

### Patch Changes

- Updated dependencies [2820a4c]
- Updated dependencies [838367f]
  - @nextrush/types@4.0.0-beta.0

## 3.0.6

### Patch Changes

- Updated dependencies [d7eb075]
- Updated dependencies [32a0db6]
  - @nextrush/types@3.1.0

## 3.0.5

### Patch Changes

- [#21](https://github.com/0xTanzim/nextRush/pull/21) [`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

- Updated dependencies [[`1f97078`](https://github.com/0xTanzim/nextRush/commit/1f970782653a9454e3a67e7ac004cb40dd791ae5)]:
  - @nextrush/types@3.0.5

## 3.0.4

### Patch Changes

- Stable **3.0.4**: **`@nextrush/di`** clears resolution tracking on **`container.reset()`** and runs Vitest test files sequentially (`fileParallelism: false`) so the global singleton container is not stressed by parallel test files—fixes flaky / hung circular-dependency tests in CI and locally. Unified semver and docs/wiki surfaces updated to **3.0.4**.

- Updated dependencies []:
  - @nextrush/types@3.0.4

## 3.0.3

### Patch Changes

- Patch **3.0.3**: **`nextrush`** ships the **`nextrush`** CLI via **`@nextrush/dev`**; **`@nextrush/dev`** skips false-positive decorator `tsconfig` warnings on functional scaffolds; **`create-nextrush`** / docs / plugin metadata aligned to **3.0.3**.

- Updated dependencies []:
  - @nextrush/types@3.0.3

## 3.0.1

### Patch Changes

- [#15](https://github.com/0xTanzim/nextRush/pull/15) [`6c37c2f`](https://github.com/0xTanzim/nextRush/commit/6c37c2f1a60c24eda5fba50c7543627104fb776c) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Sync package metadata and documentation URLs, and ensure package-level homepage/readme publishing metadata is consistent across released packages.

- Updated dependencies []:
  - @nextrush/types@3.0.1
