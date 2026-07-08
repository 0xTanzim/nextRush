---
"@nextrush/class": minor
"@nextrush/testing": minor
"@nextrush/decorators": minor
"@nextrush/controllers": minor
"@nextrush/dev": minor
"nextrush": minor
---

Class runtime consolidation (RFC-NEXTRUSH-CLASS-CONSOLIDATION).

**New**
- `@nextrush/class` — the single class-based runtime, merging the former
  `@nextrush/decorators` + `@nextrush/controllers`. Import everything for the
  class paradigm from `nextrush/class` (unchanged) or `@nextrush/class`.
- `@nextrush/testing` — `createTestModule({ controllers, providers })` with
  `.override().useValue()/.useClass()/.useFactory()`, `.compile()`, and
  `get()/request()/close()` against an isolated per-test container.
- Bootstrap pipeline (named stages over a single `BootstrapContext`) +
  `DiscoverySource` (`FilesystemSource` default, `MemorySource` for tests).
- Immutable **Application Graph** IR (read-once, freeze, run): metadata read
  once at boot and frozen; zero `Reflect` on the request path. Freezes shape,
  not instances — request-scoped controllers still instantiate per request.
- Opt-in diagnostics via `getClassDiagnostics(app)` (route/provider graph,
  duplicate-route + circular-dependency detection, stage timing); zero-cost off.
- `@nextrush/dev` codemod: `nextrush codemod consolidate-imports <glob>`.

**Deprecated (non-breaking this release)**
- `@nextrush/decorators` and `@nextrush/controllers` are now thin, `@deprecated`
  compatibility shims that re-export from `@nextrush/class`. All existing imports
  keep working. Migrate to `nextrush/class` (run the codemod). The shims will be
  **removed in a future major**.

This release is additive: no public import breaks. It is intended to ship within
the Extension-model v4 major, which carries the breaking changes.
