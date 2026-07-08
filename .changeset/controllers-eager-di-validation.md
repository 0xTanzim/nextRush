---
'@nextrush/controllers': minor
'nextrush': minor
---

Controllers: fail fast on unresolvable dependencies + app owns a DI container

`registerControllers()` now eagerly resolves every registered controller at
registration time, so unsatisfiable or circular constructor dependencies throw
a `ControllerResolutionError` at boot instead of surfacing as a 500 on the first
request. Opt out with the new `validate: false` option.

`createApp()` (from `nextrush`) now always provides `app.container` (defaulting
to the shared `@nextrush/di` container), giving class-based registrars an
explicit container seam. DI resolution behavior is unchanged. Full per-app
container isolation is proposed in
`docs/RFC/RFC-NEXTRUSH-DI-CONTAINER-OWNERSHIP.md`.
