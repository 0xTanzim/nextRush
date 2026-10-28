# Spec Delta

## MODIFIED Requirements

### Requirement: A Next.js App Router route handler can mount a NextRush application without rewriting the request

`@nextrush/adapter-nextjs`'s `handle(app)` SHALL return a **callable** route handler that also
exposes the seven named method handlers (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`,
`OPTIONS`) as properties, and SHALL delegate to `@nextrush/adapter-edge`'s `createFetchHandler`,
forwarding the incoming `Request` unmodified. The callable and each named property MUST dispatch
through one method-agnostic dispatcher (routing on `request.method`), so both the
direct-assignment form (`export const GET = handle(app)`) and the destructuring form
(`export const { GET, POST } = handle(app)`) are valid. Mount prefixes MUST be declared by the
application itself (`app.route(prefix, router)`) and MUST NOT be inferred or stripped by the
adapter. The package MUST import no runtime-specific API (`node:*`, `process`, `Buffer`, or a
`Deno`/`Bun` global) and MUST support only the App Router on Next.js 14, 15, and 16.

#### Scenario: A mounted app sees the true request

- **WHEN** a request to `/api/hello` reaches a route handler built with `handle(app)`, and `app`
  declares `app.route('/api', router)` with `router.get('/hello', …)`
- **THEN** the handler's `ctx.path` is `/api/hello`, `ctx.url` is the full request URL, and
  `ctx.raw.req` is the same `Request` object Next.js passed in — none of them show a stripped path

#### Scenario: All seven methods are available from one call

- **WHEN** `handle(app)` is called
- **THEN** the returned value is a function exposing `GET`, `POST`, `PUT`, `PATCH`, `DELETE`,
  `HEAD`, and `OPTIONS` as function properties, each dispatching to the same underlying
  `Application`

#### Scenario: Direct assignment exports a callable handler

- **WHEN** a route module exports `const GET = handle(app)` (and likewise for the other methods)
- **THEN** each export is `typeof … === 'function'` and Next.js can invoke it, dispatching the
  request through the NextRush application

#### Scenario: Direct assignment and destructuring behave identically

- **WHEN** the same request is dispatched through a handler obtained by direct assignment and
  through the matching named property obtained by destructuring
- **THEN** status, headers, and body are identical

#### Scenario: Background work reaches Next's `after()` when available

- **WHEN** a handler calls `ctx.waitUntil(promise)` under a Next.js version exposing
  `after` from `next/server`
- **THEN** `promise` is scheduled through `after()`; when `next/server` cannot be imported or
  exposes no `after`, `ctx.waitUntil()` no-ops without throwing

#### Scenario: A mount-prefix mismatch is diagnosed, never silently rescued, in development

- **WHEN** the underlying application produces a 404 for a request, `app.options.env` is not
  `'production'`, and the app has a matching route once the route file's mount segments are
  removed from the path
- **THEN** the framework logs an actionable message naming the mounted prefix and the missing
  `app.route()` call, and still returns the original 404 response — the alternate path is never
  served

#### Scenario: Cross-runtime parity holds for the Next.js entry point

- **WHEN** the `packages/adapters/conformance` suite's `nextjs` driver runs under the node,
  workerd, deno, and bun runners
- **THEN** observable behavior (status, headers, body, error shape) is identical across all four,
  matching the other Web adapters covered by this capability

#### Scenario: The functional install path stays free of Next.js

- **WHEN** a project runs `pnpm add nextrush` with no further installs
- **THEN** neither `@nextrush/adapter-nextjs` nor `next` is resolved onto disk
- **THEN** all cross-adapter behavior (query, headers, cookies, raw, responses) remains identical

#### Scenario: Allocation micro-benchmarks document the removed work

- **WHEN** `apps/benchmark/scripts/web-context-alloc.js` runs on a query-less, raw-unread request
- **THEN** it shows neither the empty-`query` object nor the `{ req, res }` wrapper is allocated

#### Scenario: Response parity is unaffected

- **WHEN** `pnpm bench:validate` runs across all benchmark servers
- **THEN** response bodies and Content-Type remain byte-identical

## ADDED Requirements

### Requirement: Repeated `handle()` calls share one initialized engine per app and option set

Calling `handle()` more than once with the same app source and equivalent options SHALL return the
same handler set and initialize the application and fetch engine only once, so exporting each
method via direct assignment does not multiply engines. A different `timeout` value or a different
`onError` function MUST yield a separate handler set and engine. A shared handler MUST preserve the
existing failed-boot retry contract: a failed resolution is not cached permanently.

#### Scenario: Seven direct-assignment exports initialize one engine

- **WHEN** a route module calls `handle(app)` once per HTTP method with the same app and options
- **THEN** the app factory resolves once and all seven exports dispatch through one engine

#### Scenario: Equivalent option objects share; differing options do not

- **WHEN** `handle(app)` and `handle(app, {})` are called, then `handle(app, { timeout: 5 })`
- **THEN** the first two return the same handler set, and the third returns a distinct handler set

#### Scenario: A failed boot is retried on the next call

- **WHEN** the app factory rejects on the first request and succeeds on a later one
- **THEN** the later request boots the app successfully instead of reusing the failure
