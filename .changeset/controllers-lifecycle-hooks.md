---
'@nextrush/controllers': minor
---

`registerControllers` now bridges service lifecycle hooks (`OnInit` /
`OnShutdown` from `@nextrush/decorators`) into the application lifecycle.

After registration/validation, the registrar walks the controller + transitive
`@Service`/`@Repository`/`@Config` graph, resolves each service, and collects
the distinct instances implementing a hook. When at least one exists, it
registers a single internal Extension so `onInit()` runs at `app.ready()`
(dependencies first — a reverse-BFS approximation) and `onShutdown()` runs at
`app.close()` in reverse order. Async hooks are awaited.

No Extension is registered when no instance implements a hook. If the app is
already booted/running when hooks are found, a clear error instructs the caller
to register controllers before `serve()`/`listen()`/`ready()`.

Opt-in and non-breaking: services without hooks are untouched.
