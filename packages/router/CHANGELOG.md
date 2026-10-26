# @nextrush/router

## 4.1.0

### Minor Changes

- [#61](https://github.com/0xTanzim/nextRush/pull/61) [`57d4713`](https://github.com/0xTanzim/nextRush/commit/57d4713e607d071112db9250c9e6e7984214fc15) Thanks [@0xTanzim](https://github.com/0xTanzim)! - **A dot segment is rejected in every spelling, and the path a Web adapter publishes is no longer
  reshaped by a `URL` parser.**

  `GET /files/%2e%2e/admin` was matched literally: `canonicalizePath()` treats `%2e` as three ordinary
  characters, so that traversal spelling slipped past the rejection the literal `/files/../admin`
  already received and was routed (or answered `404`) instead of `400`. Every percent-encoded dot
  spelling — `%2e`, `%2E`, mixed case, either end of a segment — is now a dot segment, decided in one
  linear scan as the path is canonicalized. A name that merely _contains_ a dot is still not a segment:
  `..hidden`, `archive.tar.gz`, and `%252e%252e` (a double-encoded dot, which is a literal `%` to every
  parser in the chain) all route as before.

  The Web context also stops deriving `ctx.path` through `new URL()`. That call parsed, percent-encoded,
  and **resolved dot segments**, so on Deno — which hands the request target over unparsed — a target of
  `/files/../admin` became `/admin` and dispatched to a route the client never named, while Node
  rejected the same target with `400`. The two now agree: the published path is the bytes the platform
  delivered, with no decoding and no resolution, and a request that names a traversal is rejected on
  both.

  One consequence is worth stating plainly: a target whose bytes `URL.pathname` would percent-encode (a
  non-ASCII character, a space, `"`, `<`, `` ` ``, `{`, `}`) is now published **as delivered** rather
  than re-encoded. Re-encoding would publish a form the client never sent and then match routes and
  mounts against it — the same class of reshaping as resolving a segment.

  **The platform decides first, and now says so.** Whether a dot segment survives to the application at
  all belongs to the HTTP front end: `Bun.serve`, the edge isolates, and the serverless event mapping
  parse the target into a `URL` before any framework code runs, so the original bytes are already gone
  and the rejection cannot fire there. That fact is now a capability —
  `RuntimeCapabilities.rawRequestTarget`, `true` on Node and Deno, `false` on the parsing platforms and
  wherever it cannot be proven — and the adapter conformance suite derives its expectation from it over
  a real socket instead of asserting one answer for every runtime. Nothing in the request path branches
  on the flag.

  `RuntimeCapabilities` gained a required property, so code that constructs one must include it; reading
  it is unchanged. The behavior, the per-platform matrix, and where to enforce a path ACL are documented
  in the security guide and on each adapter page.

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

- [#61](https://github.com/0xTanzim/nextRush/pull/61) [`ca01a63`](https://github.com/0xTanzim/nextRush/commit/ca01a63205e3bfec5fe4b85f5daad57383d1be8e) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Parameter and wildcard values keep the casing the client sent. Route matching is unchanged — still
  case-insensitive by default — but a value is no longer read out of the case-folded path the lookup
  runs on: `GET /users/ABC123` binds `{ id: 'ABC123' }` where dispatch previously bound
  `{ id: 'abc123' }`. The package README already documented this behavior ("parameter names and
  values always preserve their original case"), so this closes the gap between the documented
  contract and dispatch.

  The mechanism is one canonicalization yielding both strings a match needs. `canonicalizePath()`
  now returns a case-preserved `valuePath` alongside the folded `path`, and the trie walk folds each
  segment individually for its child lookup rather than folding the whole path first. Because a bound
  value and its position come from the same string, a fold that changes a character's length no
  longer risks shifting a later binding. When nothing folded, the two paths are the same string, so
  an all-lowercase request allocates nothing extra; measured per-request allocation on the match and
  dispatch paths is unchanged.

  `canonicalizePath()` additionally exports the `CanonicalPaths` type, and
  `Router.matchesMountPrefix()` now returns the case-preserved remainder, so a mounted router binds
  the client's casing too. `Router.match(method, path)` is unchanged: still two arguments, still
  normalizes its own input.

  Consumers that relied on a folded identifier must fold it themselves
  (`ctx.params.id.toLowerCase()`); everything that treats a parameter as an opaque value is
  unaffected.

### Patch Changes

- [#63](https://github.com/0xTanzim/nextRush/pull/63) [`b882dc8`](https://github.com/0xTanzim/nextRush/commit/b882dc8677b60c1b0f5f5cf62bdf099cabcd3153) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Widen the optional peer ranges to match the rest of the workspace: `@nextrush/router` now accepts
  `@nextrush/core` at `^` rather than an exact version, and `nextrush` accepts
  `@nextrush/adapter-nextjs`, `@nextrush/class`, and `@nextrush/di` the same way. The published
  ranges now admit compatible minors instead of pinning the version they were developed against, so
  a dependency's minor release no longer forces a major release of the dependent package. No runtime
  behavior changes.

- [#63](https://github.com/0xTanzim/nextRush/pull/63) [`a701579`](https://github.com/0xTanzim/nextRush/commit/a701579e7ac52bfeab8a5d8c539e07b40661e885) Thanks [@0xTanzim](https://github.com/0xTanzim)! - **A route that finishes synchronously now answers with a `Response` instead of a promise, so Bun
  stops paying a microtask hop the runtime never needed.**

  **What changes.** `createWebRunner` returns `Response | Promise<Response>`, and `createHandler` in
  the Bun, Deno and edge adapters follows that type. When the application's only middleware is the
  mounted router and the route executor reports that the handler settled without leaving work
  pending, the runner builds the response and returns it directly. Every other shape — application
  middleware, per-route middleware, an async handler, a throw — takes the existing promise path
  unchanged, timeout race included.

  **Why it is safe to answer early.** The new `Application.syncDispatchSafe` getter is true only when
  the middleware stack is exactly one entry _and_ that entry is a router dispatch mounted at the root.
  That middleware returns the executor's promise directly and never resumes after the handler, so
  nothing can mutate the response once the handler returns. A middleware registered ahead of the
  router can resume after `next()`, which is why a stack with two or more entries never takes the
  path — even when every middleware in it happens to be synchronous. The executor sets its marker
  only in the no-per-route-middleware branch, and only when the handler returned without a promise; a
  throw produces a rejection and no marker.

  **Compatibility.** Runtime behaviour is unchanged: callers that `await` the handler still work,
  because a `Response` awaits to itself. The type widening is source-visible for code that stores the
  return value in a `Promise<Response>`-typed variable; annotate it as `Response | Promise<Response>`
  (the adapters' own `BunFetchHandler` and `FetchHandler` types already do). `Bun.serve`, `Deno.serve`
  and the edge runtimes all accept either shape.

  **Measured (`wrk -t2 -c64`, server pinned to one core, paired order-flipped, CPU µs/request from
  `/proc/<pid>/stat`).** Bun GET: 14.86 → 13.20 µs (−11.7 %, 5/5 pairs). Deno GET: 12.75 → 11.44 µs
  (−6.8 %, 3/3). Deno POST: 36.59 → 34.76 µs (−2.9 %, 3/3). Bun POST and Node GET/POST: unchanged
  within noise (Bun POST keeps its `bodyParser` middleware, so the chain is genuinely asynchronous and
  the path does not apply). Node is unaffected because its adapter owns a callback-based runner.

- Updated dependencies [[`57d4713`](https://github.com/0xTanzim/nextRush/commit/57d4713e607d071112db9250c9e6e7984214fc15), [`6004c48`](https://github.com/0xTanzim/nextRush/commit/6004c482727f50cd760d4ab55d3c6b7f033e018b), [`4bdf830`](https://github.com/0xTanzim/nextRush/commit/4bdf8303cbeed3bf4351d035935c44d5110f8738), [`a701579`](https://github.com/0xTanzim/nextRush/commit/a701579e7ac52bfeab8a5d8c539e07b40661e885)]:
  - @nextrush/types@4.1.0

## 4.0.2

### Patch Changes

- [`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Prepare the NextRush v4 ecosystem patch release with updates across core, routing, adapters, middleware, utilities, OpenAPI, testing, development tooling, and the create-nextrush scaffolder.

- [`b2a5e2c`](https://github.com/0xTanzim/nextRush/commit/b2a5e2c6d399f4ed6453df412652a8abf8ea55fd) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Routes mounted via `mount()`/`use(prefix, router)` now preserve their route metadata: request schemas from `validate()` and inline docs from `endpoint()` survive the copy, so `getRoutes()` (and `@nextrush/openapi`) documents mounted routes exactly like directly registered ones. Internal representation change only — no public API change, and the dispatch hot path is unaffected (verified by the hot-path guard suite and a CPU-pinned interleaved A/B benchmark). Implements the RFC-002 v5 amendment (mount-time metadata preservation).

- Updated dependencies [[`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8)]:
  - @nextrush/types@4.0.2
  - @nextrush/core@4.0.2

## 4.0.1

### Patch Changes

- Updated dependencies []:
  - @nextrush/types@4.0.1
  - @nextrush/core@4.0.1

## 4.0.0

### Patch Changes

- [`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Consolidated patch release across all NextRush public packages.

- Updated dependencies [[`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9)]:
  - @nextrush/core@4.0.0
  - @nextrush/types@4.0.0

## 4.0.0-beta.2

### Patch Changes

- Consolidated patch release across all NextRush public packages.

- Updated dependencies []:
  - @nextrush/core@4.0.0-beta.2
  - @nextrush/types@4.0.0-beta.2

## 4.0.0-beta.1

### Patch Changes

- Updated dependencies [[`207dbca`](https://github.com/0xTanzim/nextRush/commit/207dbca2ee20a0ce7a00fe6ee14615bbb56562a2)]:
  - @nextrush/types@4.0.0-beta.1
  - @nextrush/core@4.0.0-beta.1

## 4.0.0-beta.0

### Patch Changes

- 838367f: Router documentation accuracy, an internal `router.ts` split, and audit-flagged deduplication —
  all non-breaking (public-surface snapshot byte-identical; 212/212 behavioral tests green).

  - **`@nextrush/router`**: finished splitting `router.ts` so every shipping source file is now
    under the 300-line ceiling (`router.ts` is 298 lines; the remaining logic moved into focused
    internal modules `dispatch.ts`, `state.ts`, and `constants.ts` plus existing siblings, along the
    same seams the earlier modularity split used — no new structural pattern). Resolved the router
    audit's flagged duplications: `EMPTY_PARAMS` now has a single definition in a leaf `constants.ts`
    module, and the route-matching / allowed-methods path-normalization logic is consolidated into
    one shared `normalizePathForMatch` helper. Corrected the residual "radix tree" wording to
    "segment trie" across the README and the `TrieNode.children` JSDoc (which now accurately states
    children are keyed by whole path segment, not by first character). No exported symbol, signature,
    or runtime behavior changed — confirmed by the package's public-surface snapshot test and full
    suite.

  - **`@nextrush/types`**: documentation-comment-only correction. The `router.ts` type header no
    longer claims the router "uses a radix tree for efficient route matching"; it now accurately
    describes the segment trie keyed by whole path segments (O(k) lookups). No type, signature, or
    export change.

- 70197bb: Three small papercut fixes, batched because they touch the same class/router package pair:

  - **`@nextrush/router`**: `router.ts` (918 lines) split into `matching.ts`, `match-route.ts`,
    `composition.ts`, `middleware-adapter.ts`, and `registration.ts` along its existing thematic
    seams (matching engine, sub-router composition, middleware adaptation, route registration).
    `Router`'s public shape, exported symbols, and dispatch behavior are unchanged — confirmed via
    the package's public-surface snapshot test (byte-identical before/after) and the full
    behavioral suite (212/212 passing at every extraction step, not just at the end). Purely
    internal file reorganization.

  - **`@nextrush/router` + `@nextrush/class`**: `@All()`/`app.all()` (and `router.group(...).all()`)
    now register a single ANY-method route-table entry instead of one entry per explicitly-
    enumerated HTTP method. All 7 standard verbs still match an `@All()` route identically — this
    changes only what `getRoutes()` reports for an `@All()` route (1 row instead of 7), not
    dispatch. `@nextrush/openapi`, the one in-repo consumer of `getRoutes()` found via a codebase-
    wide search, was updated in the same change: previously it silently emitted only 1 of 7
    expected operations for an `@All()` route in a generated OpenAPI spec (a real correctness bug),
    now it correctly expands an ANY-method row into one operation per standard verb. New,
    additive `RouteDefinition.isAnyMethod?: boolean` field in `@nextrush/types`.

  - **`@nextrush/class`**: `@Body()` resolving to nothing because no body-parser middleware ran now
    throws a `MissingParameterError` whose message names the likely fix (`app.use(json())`),
    instead of the same generic message used for every other missing-parameter case. Other
    parameter sources (`@Param`, `@Query`, `@Header`) are unaffected — the hint is scoped to the
    body source specifically, where "no parser ran" is the common, previously-unexplained cause.

- Updated dependencies [2820a4c]
- Updated dependencies [eee4462]
- Updated dependencies [793d596]
- Updated dependencies [838367f]
  - @nextrush/types@4.0.0-beta.0
  - @nextrush/core@4.0.0-beta.0

## 3.1.0

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
- Updated dependencies [32a0db6]
  - @nextrush/types@3.1.0
  - @nextrush/core@3.1.0

## 3.0.7

### Patch Changes

- Updated dependencies [[`c9723dd`](https://github.com/0xTanzim/nextRush/commit/c9723ddb29e4bf834625f294eadb0c9e1c28432e)]:
  - @nextrush/core@3.0.7
  - @nextrush/types@3.0.7

## 3.0.6

### Patch Changes

- Updated dependencies []:
  - @nextrush/types@3.0.6
  - @nextrush/core@3.0.6

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

- Updated dependencies []:
  - @nextrush/types@3.0.1
  - @nextrush/core@3.0.1
