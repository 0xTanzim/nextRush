---
'@nextrush/runtime': minor
'@nextrush/core': minor
'@nextrush/adapter-bun': patch
'@nextrush/adapter-deno': patch
'@nextrush/adapter-node': patch
'@nextrush/adapter-edge': patch
---

A handler built before the application booted now boots it, instead of dispatching against an empty stack.

**A `createHandler`-only entry point routes.** `Bun.serve({ fetch: createHandler(app) })`,
`Deno.serve({ handler: createHandler(app) })`, and `http.createServer(createHandler(app))` are the
documented forms for a runtime that owns its own server, and none of them has a startup phase to
await `app.ready()` in. The handler now boots the application on the first request, so declared
routes and extension-registered middleware are present and an unknown path is a `404` rather than
an empty `200`.

The failure this replaces was silent, and that was the worst part of it: the handler composed the
middleware stack as it stood at construction, so an application's own router — mounted only by
`ready()` — was simply absent. Every declared route fell through to the finalizer's empty `200`,
with nothing logged and nothing thrown. `serve()`/`listen()` were unaffected because they boot
before building a handler.

The boot barrier is shared: `@nextrush/runtime` exports `createBootGate(app, { label, markRunning })`
returning `{ handler, ensure() }`. `handler` is resolved synchronously for an application that was
already booted, so an entry point with an eager startup phase keeps exactly its previous timing, and
a request in steady state reads `handler` with no promise hop at all. Concurrent first requests share
one boot; a failed boot clears its memo so the next request retries rather than serving every later
request from a poisoned barrier.

`Application.callback()` now fails fast when the application owns a router that boot has not yet
mounted, naming the router and listing the ways to boot (`listen`, `serve`, `createHandler`). The
check is deliberately narrow: it fires only when the application has a router, so a bare
`createApp()` — which has none — is unaffected.

The boot-reuse warning (a second, different `Application` booting in the same process or isolate)
moved into the shared gate, so every adapter emits it with its own label. Edge no longer keeps that
bookkeeping in its own module; the diagnostic behaviour and its cross-platform message are unchanged
apart from naming the adapter instead of listing each edge factory.
