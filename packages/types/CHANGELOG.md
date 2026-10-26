# @nextrush/types

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

## 4.0.2

### Patch Changes

- [`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Prepare the NextRush v4 ecosystem patch release with updates across core, routing, adapters, middleware, utilities, OpenAPI, testing, development tooling, and the create-nextrush scaffolder.

## 4.0.1

## 4.0.0

### Patch Changes

- [`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Consolidated patch release across all NextRush public packages.

## 4.0.0-beta.2

### Patch Changes

- Consolidated patch release across all NextRush public packages.

## 4.0.0-beta.1

### Patch Changes

- [`207dbca`](https://github.com/0xTanzim/nextRush/commit/207dbca2ee20a0ce7a00fe6ee14615bbb56562a2) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Adds `ctx.platform` (`PlatformId | undefined`) across `@nextrush/adapter-edge` and
  `@nextrush/adapter-serverless`, orthogonal to the unchanged `ctx.runtime` (RFC-026). Each
  serverless Tier-1 handler (`createLambdaHandler`/`createGoogleHandler`/`createAzureHandler`) sets
  it explicitly to its own known platform; `@nextrush/adapter-edge`'s Cloudflare/Vercel/Netlify
  handlers detect it via the new `detectPlatform()` in `@nextrush/runtime`. Fully additive — no
  existing type or value changes.

## 4.0.0-beta.0

### Minor Changes

- 2820a4c: Enforce the two-tier adapter contract (RFC-NEXTRUSH-ADAPTER-CONTRACT).

  - **`@nextrush/types`**: add the `AdapterContextFactory<Args, Ctx>` type, formalizing the shared "adapters build `Context` via a factory and run `app.callback()`" invariant at the type level. Additive — the existing `ServerAdapter`/`FetchAdapter`/`ServerHandle` contracts are unchanged.
  - **Adapters**: add a compile-time context-factory conformance guard to the node (ServerAdapter tier) and edge (FetchAdapter tier) adapters, so a drift in the context factory's return type stops compiling. The pre-existing shape guards (`serve`/`createHandler`/`createFetchHandler`) remain. Internal, non-exported — no public surface change.

  Also adds negative type-enforcement tests to `@nextrush/types` proving a malformed adapter (missing method, wrong return type) fails to satisfy the contract.

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
