---
"create-nextrush": minor
---

Migrate the `full` project template to the framework's class-based module standard.

The `full` style now mirrors the `class-based` style: a root `AppModule` composes a
`HelloModule` via `@Module({ imports })` under `src/modules/hello/`, and the entrypoint wires
the whole graph in one call with `registerModule(app, AppModule, { prefix: '/api' })` +
`await listen(app, PORT)`.

This replaces the old filesystem controller auto-discovery path
(`registerControllers` with `IS_DIST_RUNTIME` / `CONTROLLERS_ROOT` / `CONTROLLERS_INCLUDE`
globals and a `serve()` entry) so both class-based-family templates share one idiomatic,
module-based architecture. The functional `/health` route and the first-in-chain
`error-handler` middleware are preserved — `full` still teaches both routing styles in one
service.
