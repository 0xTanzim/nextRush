# @nextrush/testing

## 1.0.3

### Patch Changes

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

- Updated dependencies [[`23e927a`](https://github.com/0xTanzim/nextRush/commit/23e927ae3d41b655da6e6862272356df7a2d481f), [`57d4713`](https://github.com/0xTanzim/nextRush/commit/57d4713e607d071112db9250c9e6e7984214fc15), [`9e6de5f`](https://github.com/0xTanzim/nextRush/commit/9e6de5f81b93401198138d11f6c2eaf5948502ad), [`6004c48`](https://github.com/0xTanzim/nextRush/commit/6004c482727f50cd760d4ab55d3c6b7f033e018b), [`2d0f0c1`](https://github.com/0xTanzim/nextRush/commit/2d0f0c185165d50960e2c66b4a9c714d1463381b), [`4bdf830`](https://github.com/0xTanzim/nextRush/commit/4bdf8303cbeed3bf4351d035935c44d5110f8738), [`b882dc8`](https://github.com/0xTanzim/nextRush/commit/b882dc8677b60c1b0f5f5cf62bdf099cabcd3153), [`ca01a63`](https://github.com/0xTanzim/nextRush/commit/ca01a63205e3bfec5fe4b85f5daad57383d1be8e), [`a701579`](https://github.com/0xTanzim/nextRush/commit/a701579e7ac52bfeab8a5d8c539e07b40661e885)]:
  - @nextrush/core@4.1.0
  - @nextrush/router@4.1.0
  - @nextrush/types@4.1.0
  - @nextrush/di@4.1.0
  - @nextrush/class@1.0.3

## 1.0.2

### Patch Changes

- [`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Prepare the NextRush v4 ecosystem patch release with updates across core, routing, adapters, middleware, utilities, OpenAPI, testing, development tooling, and the create-nextrush scaffolder.

- Updated dependencies [[`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8), [`b2a5e2c`](https://github.com/0xTanzim/nextRush/commit/b2a5e2c6d399f4ed6453df412652a8abf8ea55fd)]:
  - @nextrush/router@4.0.2
  - @nextrush/class@1.0.2
  - @nextrush/types@4.0.2
  - @nextrush/core@4.0.2
  - @nextrush/di@4.0.2

## 1.0.1

### Patch Changes

- Updated dependencies []:
  - @nextrush/types@4.0.1
  - @nextrush/core@4.0.1
  - @nextrush/router@4.0.1
  - @nextrush/di@4.0.1
  - @nextrush/class@1.0.1

## 1.0.0

### Patch Changes

- [`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Consolidated patch release across all NextRush public packages.

- Updated dependencies [[`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9)]:
  - @nextrush/class@1.0.0
  - @nextrush/core@4.0.0
  - @nextrush/di@4.0.0
  - @nextrush/router@4.0.0
  - @nextrush/types@4.0.0

## 1.0.0-beta.1

### Patch Changes

- Consolidated patch release across all NextRush public packages.

- Updated dependencies []:
  - @nextrush/class@1.0.0-beta.2
  - @nextrush/core@4.0.0-beta.2
  - @nextrush/di@4.0.0-beta.2
  - @nextrush/router@4.0.0-beta.2
  - @nextrush/types@4.0.0-beta.2

## 1.0.0-beta.0

### Patch Changes

- Updated dependencies [4231f6e]
- Updated dependencies [2820a4c]
- Updated dependencies [eee4462]
- Updated dependencies [793d596]
- Updated dependencies [7a05218]
- Updated dependencies [838367f]
- Updated dependencies [70197bb]
  - @nextrush/class@4.0.0-beta.0
  - @nextrush/types@4.0.0-beta.0
  - @nextrush/core@4.0.0-beta.0
  - @nextrush/router@4.0.0-beta.0
  - @nextrush/di@4.0.0-beta.0
