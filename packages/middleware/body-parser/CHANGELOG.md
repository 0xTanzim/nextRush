# @nextrush/body-parser

## 4.1.0

### Minor Changes

- [#61](https://github.com/0xTanzim/nextRush/pull/61) [`9e6de5f`](https://github.com/0xTanzim/nextRush/commit/9e6de5f81b93401198138d11f6c2eaf5948502ad) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Error bodies are now a stable, runtime-independent contract, and an unparsed `Content-Type` is an
  explicit choice instead of a silent fallthrough.

  **A client error keeps its own code.** `{"code":"INTERNAL_ERROR","status":400}` was what a failed
  body parse sent: a 4xx that read to the client like a server fault, so nothing could branch on the
  failure. A non-`NextRushError` now reports the code it carries, or its status's canonical code when
  it carries none:

  | Error                                   | Body before                              | Body now               |
  | --------------------------------------- | ---------------------------------------- | ---------------------- |
  | `BodyParserError` (`INVALID_JSON`, 400) | `code: 'INTERNAL_ERROR'`                 | `code: 'INVALID_JSON'` |
  | A plain error with `status: 404`        | `code: 'INTERNAL_ERROR'`                 | `code: 'NOT_FOUND'`    |
  | Any 5xx                                 | `code: 'INTERNAL_ERROR'`, masked message | unchanged              |

  Every 5xx body is byte-for-byte what it was — the code and message of an internal failure still
  never reach the client. `@nextrush/errors` exports the derivation both error responses now call,
  `resolveErrorCode(error, status)`, so `app`'s default error response and `errorHandler()` cannot
  drift apart. `errorHandler()` also now reads a plain error's `status` (via the existing
  `getErrorStatus()`) instead of always reporting `500`, which is what made the two surfaces agree.

  **Failure messages are framework constants.** `@nextrush/body-parser` put the JS engine's own parse
  text in the response — `"Invalid JSON: Expected property name or '}' in JSON at position 1"` — which
  differs per runtime for the same bytes, so the body was a function of where the code ran. Every
  response-visible message is now fixed (`'Invalid JSON'`, `'Invalid URL-encoded body'`, `'Error
reading request body'`), and the engine's text is retained as a **non-enumerable**
  `BodyParserError.cause` for server-side logging. It never appears in `toJSON()`, in
  `JSON.stringify(error)`, or in any response. If you matched on a message, read `error.code` or
  `error.cause` instead.

  **`onUnsupportedContentType`.** A `POST` whose `Content-Type` matches no configured parser used to
  answer `200` with `ctx.body === undefined`, so the client's eventual error was whatever validation
  said about a missing field. `bodyParser()` now takes an explicit policy:

  ```ts
  app.use(bodyParser({ onUnsupportedContentType: 'reject' }));
  ```

  `'ignore'` is the default and preserves today's behaviour exactly. `'reject'` answers `415` naming
  the content type **before any handler runs**. Use `'reject'` for a JSON API: the wrong media type is
  the failure, and it should be reported as one. A bodyless method and a request with no
  `Content-Type` at all are never rejected under either policy; `multipart/*` rejects under both, as
  it always has.

  > **Planned for the next major:** the default becomes `'reject'`. Silently accepting an unparsed
  > body is the wrong default for the APIs this package exists to build, but flipping it now would
  > turn previously-accepted requests into errors without a version to carry the change, so it is
  > scheduled rather than shipped. Set the option explicitly to have the future behaviour today.

- [#63](https://github.com/0xTanzim/nextRush/pull/63) [`4bdf830`](https://github.com/0xTanzim/nextRush/commit/4bdf8303cbeed3bf4351d035935c44d5110f8738) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Opt-in lazy body parsing: `bodyParser({ lazy: true })` defers the read and the parse until the
  application calls `await ctx.readBody()`, so a request whose body is never read costs no body work.

  ```ts
  app.use(bodyParser({ lazy: true }));

  app.post('/hooks', async (ctx) => {
    const payload = await ctx.readBody<{ action: string }>(); // the only trigger
    return ctx.json({ received: payload.action });
  });
  ```

  Eager parsing remains the default and its behaviour is unchanged: same error codes, statuses,
  envelopes, `verify` ordering, and `rawBody` timing.

  On a request a lazy parser claimed, `ctx.body` throws `BODY_NOT_READ` until `readBody()` succeeds,
  so a missing await fails loudly instead of looking like an empty body. `readBody()` exists in both
  modes, reads the stream once, shares an in-flight read between concurrent callers, and caches a
  failure for the rest of the request. A write to `ctx.body` (a validation coercion, a terminal
  framework write) settles the body: a later `readBody()` returns the written value.

  `@nextrush/validation`, `@nextrush/class` guards and `@Body()` parameters, and `@nextrush/csrf`'s
  default extractor now consume the body through `readBody()`, so they work in both modes.

  **Implementer note (release classification).** `Context.readBody()` is a required member of the
  public contract. Applications are unaffected, but a custom `Context` implementation — an external
  adapter or a hand-written test double — must add it or stop compiling. Whether that warrants a
  major bump of `@nextrush/types` (and, through the fixed group, the whole framework) or a minor
  with a documented implementer note is a maintainer call; this changeset proposes minor.

  The evidence for the minor reading: every first-party context is either `WebContextBase`-derived (the
  Web adapters) or `NodeContext`, and both implement `readBody()` now. No package, example, or guide
  implements `Context` from scratch — the adapter documentation describes adapters as extending the
  shared base — so the break reaches hand-written test doubles and hypothetical from-scratch adapters,
  not applications. Adding a required member to `Context` also has precedent here (`ctx.cookies`,
  RFC-034). A major is still defensible if the project treats the interface as an implementable
  contract; the difference is a policy decision, not a technical one.

  Measured on Bun 1.4.4 with a 1 KB JSON `POST`: an unread lazy request drops from 9.39 µs to
  6.45 µs (−31 %); a request that reads pays ~0.4–0.5 µs more than eager. Details in RFC-047 §14.

### Patch Changes

- Updated dependencies [[`57d4713`](https://github.com/0xTanzim/nextRush/commit/57d4713e607d071112db9250c9e6e7984214fc15), [`6004c48`](https://github.com/0xTanzim/nextRush/commit/6004c482727f50cd760d4ab55d3c6b7f033e018b), [`4bdf830`](https://github.com/0xTanzim/nextRush/commit/4bdf8303cbeed3bf4351d035935c44d5110f8738), [`a701579`](https://github.com/0xTanzim/nextRush/commit/a701579e7ac52bfeab8a5d8c539e07b40661e885)]:
  - @nextrush/types@4.1.0

## 4.0.1

### Patch Changes

- [`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Prepare the NextRush v4 ecosystem patch release with updates across core, routing, adapters, middleware, utilities, OpenAPI, testing, development tooling, and the create-nextrush scaffolder.

- Updated dependencies [[`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8)]:
  - @nextrush/types@4.0.2

## 4.0.0

### Patch Changes

- [`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Consolidated patch release across all NextRush public packages.

- Updated dependencies [[`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9)]:
  - @nextrush/types@4.0.0

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
