---
'@nextrush/controllers': minor
'nextrush': minor
---

Keep the functional entry DI-free + validate class guards at boot

`createApp()` from `nextrush` no longer attaches a DI container by default, so
importing the functional entry no longer transitively loads `reflect-metadata`
and tsyringe — functional users pay no class-based cost. The container is
bring-your-own via `options.container`; class-based apps are unaffected because
`registerControllers` supplies the global `@nextrush/di` container fallback
itself. `app.container` is `undefined` unless you pass one.

`registerControllers()` eager validation now also resolves class-based guards
(deduped) at registration, so a guard with an unresolvable or circular
dependency fails at boot instead of as a 500 on the first request to a guarded
route. Opt out with `validate: false`.
