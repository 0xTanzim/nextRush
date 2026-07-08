---
'@nextrush/controllers': minor
---

Controllers: `registerModule` for `@Module`-based composition

Adds `registerModule(app, RootModule, options?)` — an async registrar that wires
a whole `@Module` graph in one call. It recursively walks `imports` (post-order,
deduping diamond/duplicate imports and guarding cycles), registers every
module's providers into the DI container (bare classes with their declared
`@Service` scope; `{ provide, useClass | useValue | useFactory, scope }` configs),
and registers all controllers across the graph through the existing
`registerControllers` pipeline — route building, eager DI/guard validation,
`OnInit`/`OnShutdown` bridging, and isolate/request-scope support are reused, not
duplicated.

Honors the same options as `registerControllers` where sensible (`prefix`,
`middleware`, `container`, `isolate`, `validate`, `debug`). Also exports
`collectModuleGraph`, `collectModuleControllers`, `ModuleRegistrationOptions`,
and the `NotAModuleError`. `registerControllers` is unchanged. Per-module
encapsulation (module-private providers) is documented as follow-up work — see
`docs/RFC/RFC-NEXTRUSH-MODULES.md`.
