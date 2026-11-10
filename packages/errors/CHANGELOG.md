# @nextrush/errors

## 4.2.0

### Minor Changes

- [#78](https://github.com/0xTanzim/nextRush/pull/78) [`4bb3dbf`](https://github.com/0xTanzim/nextRush/commit/4bb3dbf195cdc67833c598e3db1e70efa02bc93e) Thanks [@0xTanzim](https://github.com/0xTanzim)! - `validate()` exposes coerced query/params and accepts a failure status.

  ```ts
  const Query = z.object({ limit: z.coerce.number().int().min(1).default(50) });

  app.get('/items', validate({ query: Query }, { errorStatus: 422 }), (ctx) => {
    const { query } = validated(ctx); // { limit: number } — coerced
    ctx.json({ limit: query.limit });
  });
  ```

  - **Coerced query/params are no longer discarded.** They are written to `ctx.state.validated` and
    read back with the new `validated(ctx)` accessor, which returns `{}` when no `validate()` ran so a
    destructure never throws. Only targets that were configured _and_ passed appear. Nothing is written
    on failure, so the existing atomicity guarantee holds.
  - **Strict type safety and helpers.** `validated` is fully generic (`validated<{ query: MyQuery }>(ctx)`)
    and provides target-specific helpers (`validated.query<T>(ctx)`, `validated.params<T>(ctx)`, `validated.body<T>(ctx)`)
    for cast-free typing under TypeScript strict mode.
  - `ctx.query` and `ctx.params` are still left unmodified. They are declared as string maps, so writing
    a coerced number back would make the type disagree with the runtime. The coerced values live on
    `ctx.state` (which is `unknown`-valued) instead.
  - **`createValidate()` factory.** For projects where an API specification mandates `422` (or any custom status)
    across dozens of routers, `createValidate({ errorStatus: 422 })` creates a preconfigured `validate` function
    so the status option does not need to be repeated on every route.
  - **`ValidationError` accepts an optional status**, defaulting to `400`, so `new ValidationError(issues)`
    is unchanged for every existing caller. `validate(arg, { errorStatus })` threads it through.
    `ValidationError.fromField` and `fromFields` also accept optional `status`.
  - **`errorHandler({ validationErrorStatus: 422 })`** provides a global fallback in `@nextrush/errors`
    mapping default 400 validation errors to 422.
  - The error `code` stays `VALIDATION_ERROR` at any status: the code names the kind of failure, the
    status names its class. A `422` validation failure still aggregates every issue across every target.

  - **`errorStatus` is validated at construction** and must be an integer 400-499, so a typo throws a
    `RangeError` at startup instead of producing an invalid status at request time. Without this guard an
    out-of-range value reached `res.writeHead()`, whose asynchronous `ERR_HTTP_INVALID_STATUS_CODE` is an
    uncaught exception that takes the whole process down — a config typo became a remote DoS.
  - **Stacking `validate()` on one route merges** the coerced targets instead of the second call
    clobbering the first, so `validate({ params })` then `validate({ query })` keeps both.
  - **A `body` schema without a body parser now names the real cause.** Previously a request that carried
    a body but had no parser installed failed with "expected object, received undefined", which blames the
    schema. It now throws an error naming the missing `bodyParser()`; the client still receives an opaque
    5xx and the developer gets the cause in the log.
  - **A misspelled or unknown schema target is rejected at construction.** `validate({ querys: Schema })`
    used to validate _nothing_ and silently pass every request through — the worst failure mode for a
    validation middleware, because it looks like it works. Unknown keys, and targets whose value is not a
    Standard Schema, now throw a `TypeError` naming the offending key. An empty map stays a documented
    pass-through.

### Patch Changes

- Updated dependencies [[`914f2de`](https://github.com/0xTanzim/nextRush/commit/914f2de19ffbb4ff1790f5be86eadcc771bb7611), [`bd568d8`](https://github.com/0xTanzim/nextRush/commit/bd568d8926ea4ead65c4bce32016f691dec91140), [`73fd473`](https://github.com/0xTanzim/nextRush/commit/73fd4736234780455adf95e69cc981d52b84422b)]:
  - @nextrush/types@4.2.0

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

## 3.1.0

### Patch Changes

- 0e2b399: Fix `errorHandler()` silently dropping subclass-specific fields (e.g.
  `ValidationError.issues`) from the serialized response body.

  `errorHandler()` previously built its own response body by hand
  (`{ error, message, code, status, details }`) instead of calling the thrown
  error's own `toJSON()`. Any `NextRushError` subclass that overrides `toJSON()`
  to add fields — most notably `ValidationError`, which adds `issues` — had
  those fields silently dropped when rendered through `errorHandler()`, even
  though `error.toJSON()` produced them correctly on its own.

  `errorHandler()` now delegates to `err.toJSON()` for any `NextRushError` (which
  includes `HttpError` and all its subclasses), and falls back to the previous
  hand-rolled shape only for plain `Error`/unknown thrown values. The response
  shape for existing `HttpError` usage is unchanged; `ValidationError` responses
  now correctly include `issues`.

  Found via live end-to-end testing of `@nextrush/validation` against a real
  Node HTTP server — no application code needs to change.

- Updated dependencies [d7eb075]
- Updated dependencies [32a0db6]
  - @nextrush/types@3.1.0

## 3.0.7

### Patch Changes

- Updated dependencies []:
  - @nextrush/types@3.0.7

## 3.0.6

### Patch Changes

- Updated dependencies []:
  - @nextrush/types@3.0.6

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

- Updated dependencies []:
  - @nextrush/types@3.0.1
