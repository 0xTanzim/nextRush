# @nextrush/compression

## 3.1.0

### Minor Changes

- [#61](https://github.com/0xTanzim/nextRush/pull/61) [`ed8d225`](https://github.com/0xTanzim/nextRush/commit/ed8d2255a69f46ec58e5e6751567a27d5a0dc8b1) Thanks [@0xTanzim](https://github.com/0xTanzim)! - **Response-aware middleware reads one response shape, never the parsed request body, and the timer's
  documented default now matches what it does.**

  `@nextrush/compression` had two sources for the response it wanted to compress: `ctx.body` and
  `raw.res.body`. The first is the **parsed request body**. So on a request whose response type was
  already visible when the middleware resumed — a middleware that declares `Content-Type` before
  `await next()` — a 20 KB POST was gzipped once as if it were the response, and the write that followed
  failed because the response had already been sent. The second source is a slot no adapter fills, which
  is why every shipped adapter compressed nothing and said nothing.

  Both reads are replaced by a single declared shape: the outgoing response the adapter still exposes
  (`raw.res`, marked by `getHeader`), from which the middleware reads headers and the buffered body — and
  only that. When no outgoing body exists, it does **not** substitute the request body; it returns and
  reports the situation **once per process**:

  ```
  [@nextrush/compression] no outgoing body available: a response written with
  ctx.json()/send()/html() is committed before this middleware runs, so it cannot
  be compressed. ...
  ```

  There is nothing compression can act on today: the Node adapter writes and ends the response inside the
  handler, and the Web adapters record it privately and build the `Response` after the chain unwinds. No
  longer silent, and no longer capable of touching a request body. The package README states the
  limitation and the real-adapter tests pin it.

  `@nextrush/timer` keeps `exposeHeader` defaulting to `false`, and its JSDoc and README examples now pass
  `exposeHeader: true` — the earlier examples showed a header the default does not produce. The reason the
  default is `false` is now stated plainly: the header is written after the handler has responded, which
  lands on the Web adapters and cannot land on the Node adapter, where the response is already on the wire.
  `serverTiming()` is documented the same way, and a real-adapter test locks both behaviours.

  For adapter authors, `ConformanceDriver` gains `honorsPostHandlerHeaderWrite` — `false` for Node, `true`
  for the Web family, serverless, and Next.js — and conformance scenario `[#29](https://github.com/0xTanzim/nextrush/issues/29)` asserts the **observed**
  behaviour agrees with the declared value, so an adapter that changes under the framework fails
  conformance instead of silently flipping. A driver implementation must declare the new flag.

### Patch Changes

- Updated dependencies [[`57d4713`](https://github.com/0xTanzim/nextRush/commit/57d4713e607d071112db9250c9e6e7984214fc15), [`6004c48`](https://github.com/0xTanzim/nextRush/commit/6004c482727f50cd760d4ab55d3c6b7f033e018b), [`4bdf830`](https://github.com/0xTanzim/nextRush/commit/4bdf8303cbeed3bf4351d035935c44d5110f8738), [`a701579`](https://github.com/0xTanzim/nextRush/commit/a701579e7ac52bfeab8a5d8c539e07b40661e885)]:
  - @nextrush/types@4.1.0

## 3.0.7

### Patch Changes

- [`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Prepare the NextRush v4 ecosystem patch release with updates across core, routing, adapters, middleware, utilities, OpenAPI, testing, development tooling, and the create-nextrush scaffolder.

- Updated dependencies [[`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8)]:
  - @nextrush/types@4.0.2

## 3.0.6

### Patch Changes

- [`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Consolidated patch release across all NextRush public packages.

- Updated dependencies [[`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9)]:
  - @nextrush/types@4.0.0

## 3.0.6-beta.0

### Patch Changes

- Consolidated patch release across all NextRush public packages.

- Updated dependencies []:
  - @nextrush/types@4.0.0-beta.2

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
