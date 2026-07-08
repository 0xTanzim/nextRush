---
'@nextrush/controllers': minor
---

Controllers: opt-in per-app DI container isolation

`registerControllers()` gains an `isolate?: boolean` option (default `false`).
With `isolate: true`, the call creates a fresh container via `createContainer()`
and re-registers the reachable `@Service`/`@Repository`/`@Config` graph of the
registered controllers into it (each with its declared scope), so two apps in
one process own **separate** service singletons instead of sharing the
process-global ones registered at import time. Controllers, their handlers, and
boot-time validation all resolve from the isolated container.

Non-breaking: `isolate` defaults to `false`, preserving the current shared
(`options.container ?? app.container ?? global`) behavior for every existing
caller. `@Service` global registration is unchanged. An explicit
`options.container` always wins — even under `isolate: true` — so register any
string/symbol `@inject` tokens and `useValue`/`useFactory` providers on the
container you pass **before** calling `registerControllers`. This is the
opt-in, non-breaking Option A from
`docs/RFC/RFC-NEXTRUSH-DI-CONTAINER-OWNERSHIP.md` (CRITICAL-2).
