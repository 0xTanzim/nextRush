---
'@nextrush/controllers': minor
'nextrush': minor
---

Controllers: fail fast on unresolvable dependencies

`registerControllers()` now eagerly resolves every registered controller (and
its class-based guards) at registration time, so unsatisfiable or circular
constructor dependencies throw at boot instead of surfacing as a 500 on the
first request. Opt out with the new `validate: false` option.

The DI container remains bring-your-own via `createApp({ container })`;
`registerControllers` falls back to the global `@nextrush/di` container when the
app doesn't provide one. Full per-app container isolation is proposed in
`docs/RFC/RFC-NEXTRUSH-DI-CONTAINER-OWNERSHIP.md`.
