---
'@nextrush/decorators': minor
---

Add service lifecycle hook interfaces: `OnInit` and `OnShutdown`, plus the
runtime type guards `isOnInit` / `isOnShutdown`.

These are duck-typed behavioral interfaces (no decorator) — a service opts in by
declaring `onInit(): void | Promise<void>` and/or
`onShutdown(): void | Promise<void>`. The guards narrow a resolved **instance**
(not a class constructor, unlike `isGuardClass`) by detecting a callable method
on the prototype chain. `@nextrush/controllers` uses them to bridge hooks into
`app.ready()` / `app.close()`.

Additive and opt-in — no existing behavior changes.
