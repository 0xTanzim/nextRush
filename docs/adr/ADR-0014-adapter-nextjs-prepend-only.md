# ADR-0014: `@nextrush/adapter-nextjs` — prepend-only Next.js App Router bridge

| Field             | Value                                                        |
| ------------------ | ------------------------------------------------------------- |
| **Status**         | Accepted · Shipped                                              |
| **Date**           | 2026-07-25                                                      |
| **Governing RFC**  | `docs/RFC/runtime-adapters/024-adapter-nextjs.md`               |

## Context

NextRush had no supported way to mount an application inside a Next.js App Router route handler.
The naive integration required six hand-written wrapper lambdas (to erase a type-incompatible
second parameter Next passes), a hand-maintained mount prefix, and a silently no-op
`ctx.waitUntil()`. RFC-024 explored two designs for the mount prefix: stripping it from the
request (inferred from Next's catch-all `params`) versus prepending it at route registration
(`app.route('/api', router)`, unchanged from how NextRush already works everywhere else).

## Decision

Ship `@nextrush/adapter-nextjs` (`nextrush/nextjs`) as a thin bridge over
`@nextrush/adapter-edge`'s `createFetchHandler`. It never modifies the request. Routes are
declared with their full path via ordinary `app.route(prefix, router)`; the bridge adds no path
semantics of its own. App Router only, on Next 14/15/16. The Pages Router is a permanent
non-goal, not a deferred one.

## Options Considered

1. **Prepend (chosen).** Zero request modification; `ctx.path`/`ctx.url`/`ctx.raw.req` are always
   the true request. One mount-prefix mismatch failure mode, mitigated by a development-only
   diagnostic. Matches Hono's `basePath()`, which is a registration prefix, not a rewrite.
2. **Strip via URL rewrite.** Rejected — `WebContextBase` computes `url`/`path`/`query` eagerly
   from `request.url`, so stripping made the prefix unrecoverable: broken relative redirects,
   OpenAPI paths missing their prefix, logs showing an unreachable path. Required a
   `Request` reconstruction (with a cross-runtime `duplex: 'half'` streaming-body question) and a
   `getMountPath()` escape hatch just to undo what the adapter did.
3. **Adapter injects the prefix at boot.** Rejected — core mounts the app-owned router inside
   `Application._boot()`, so an app shared between a Next route file and `listen()` would route
   differently per host. Mount configuration belongs to the app, not its adapter.
4. **Support the Pages Router too.** Rejected — the only reason the package would import
   `node:*`; would have required a two-subpath split and pulled in an unrelated
   `@nextrush/adapter-node` boot-barrier defect as a prerequisite.

## Consequences

- The package is fully Web-standard (no `node:*`, `process`, or runtime global), so one entry
  point runs on every host Next.js runs on — verified by the conformance suite under all four
  runtime runners (node/workerd/deno/bun), not asserted.
- Zero added allocations per request: the same `Request` object is forwarded unmodified.
- The mount prefix must be written in two places (the route file's folder, and the app's
  `app.route()` call). A development-only diagnostic names both halves on a 404 rather than
  leaving it a bare failure.
- `createApp({ basePath })`, which would collapse the mount declaration to one line, is
  explicitly deferred (RFC-024 §17) as its own `@nextrush/core` public-API RFC — not folded into
  this adapter.
- `@nextrush/adapter-node`'s missing `ready()` boot barrier (found while evaluating Pages Router
  support) is a real, separate defect, filed for its own fix and out of this RFC's scope.

## Compliance

- [x] No existing package's public API changes.
- [x] `nextrush` gains one optional-peer subpath (`./nextjs`); a functional-only install resolves
      neither it nor `next`.
- [x] Package hierarchy respected — depends only on `@nextrush/adapter-edge` (a sibling) and
      `@nextrush/core`/`@nextrush/types`.
- [x] Cross-runtime parity is a P2 exit condition on the real conformance suite, not a claim.
- [x] Zero-dependency rule holds — `next` is a lazily-imported optional peer, never a hard
      dependency.
