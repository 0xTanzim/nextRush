# @nextrush/static

## 1.0.2

### Patch Changes

- [#63](https://github.com/0xTanzim/nextRush/pull/63) [`1f1a0fe`](https://github.com/0xTanzim/nextRush/commit/1f1a0fe580f622d965ef0c9cf9f575dc2a606bf2) Thanks [@0xTanzim](https://github.com/0xTanzim)! - **Static-file responses now actually carry the headers this middleware sets, and a conditional
  request returns `304` instead of an empty `200`.**

  **What changes.** `serveStatic()` records `Content-Type`, `ETag`, `Last-Modified`,
  `Cache-Control`, `Accept-Ranges`, and `X-Content-Type-Options` through `ctx.set()`, then wrote the
  file body with `ctx.raw.res.end(content)`. Recorded headers only reach the socket on the adapter's
  flush, so the body arrived and **every header was dropped**: a served file went out with nothing but
  `Content-Length`, which browsers answer by sniffing the type, and no validator, which forces a full
  re-download of every asset on every request. The small-file body and the `304` are now committed with
  `ctx.send()`, the same path every other response takes.

  A matching `If-None-Match` also returned `200` with an empty body, because `ctx.status = 304` alone
  never reached `res.statusCode`; it now returns a real `304` with its validators.

  Two redundant syscalls went with it: the small-file branch called `handle.stat()` on a descriptor
  `readFile()` had already fstat'd, purely to maintain a `Content-Length` header that the same branch
  never sent.

  **Measured.** 36-byte file on the Node adapter, paired A/B on server CPU per request: **143.59 →
  126.04 µs (−13.6 %, 3/3 pairs)**, repeated at −12.4 % (3/3) before the `304` fix. The response gained
  six headers over the same run. Against a hand-rolled `readFile` + `ctx.send` handler the same file
  still costs 2.7× (46 µs), because the middleware additionally `lstat`s for the symlink policy and
  `readFile()` issues a second read to reach EOF.

  **Known limitation.** Range (`206`) and large-file streamed responses still write through
  `ctx.raw.res` and so still land without the recorded headers; carrying them needs an adapter-level
  "flush head, then stream" hook, which this package cannot add on its own.

  **What does not change.** The public API, options, routing and prefix handling, dotfile and symlink
  policy, path containment, `HEAD`/`416` status handling, range parsing, stream timeouts, and the
  metadata cache. No dependency changes.

- Updated dependencies [[`57d4713`](https://github.com/0xTanzim/nextRush/commit/57d4713e607d071112db9250c9e6e7984214fc15), [`6004c48`](https://github.com/0xTanzim/nextRush/commit/6004c482727f50cd760d4ab55d3c6b7f033e018b), [`4bdf830`](https://github.com/0xTanzim/nextRush/commit/4bdf8303cbeed3bf4351d035935c44d5110f8738), [`a701579`](https://github.com/0xTanzim/nextRush/commit/a701579e7ac52bfeab8a5d8c539e07b40661e885)]:
  - @nextrush/types@4.1.0

## 1.0.1

### Patch Changes

- [`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Prepare the NextRush v4 ecosystem patch release with updates across core, routing, adapters, middleware, utilities, OpenAPI, testing, development tooling, and the create-nextrush scaffolder.

- Updated dependencies [[`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8)]:
  - @nextrush/types@4.0.2
  - @nextrush/core@4.0.2

## 1.0.0

### Patch Changes

- [`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Consolidated patch release across all NextRush public packages.

- Updated dependencies [[`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9)]:
  - @nextrush/core@4.0.0
  - @nextrush/types@4.0.0

## 1.0.0-beta.1

### Patch Changes

- Consolidated patch release across all NextRush public packages.

- Updated dependencies []:
  - @nextrush/core@4.0.0-beta.2
  - @nextrush/types@4.0.0-beta.2

## 1.0.0-beta.0

### Patch Changes

- Updated dependencies [2820a4c]
- Updated dependencies [eee4462]
- Updated dependencies [793d596]
- Updated dependencies [838367f]
  - @nextrush/types@4.0.0-beta.0
  - @nextrush/core@4.0.0-beta.0

## 3.1.0

### Patch Changes

- Updated dependencies [d7eb075]
- Updated dependencies [32a0db6]
  - @nextrush/types@3.1.0
  - @nextrush/core@3.1.0

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

- [#15](https://github.com/0xTanzim/nextRush/pull/15) [`6c37c2f`](https://github.com/0xTanzim/nextRush/commit/6c37c2f1a60c24eda5fba50c7543627104fb776c) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Sync package metadata and documentation URLs, and ensure package-level homepage/readme publishing metadata is consistent across released packages.

- Updated dependencies []:
  - @nextrush/types@3.0.1
  - @nextrush/core@3.0.1
