# single-entry-any-method-routes Specification

## Purpose
TBD - created by archiving change improve-router-modularity-and-class-dx-papercuts. Update Purpose after archive.
## Requirements
### Requirement: `@All`/`app.all` registers a single any-method route entry
`@All()` (class decorator) and `app.all()` (functional API) SHALL register one route entry that
matches all HTTP methods, rather than one explicit registration per enumerated method.

#### Scenario: `@All` yields a single route-table row
- **WHEN** a route is registered via `@All('/x')` or `app.all('/x', handler)`
- **THEN** `getRoutes()` (or the equivalent route-introspection API) shows exactly one entry for
  that path, not one row per HTTP method

#### Scenario: All HTTP methods still match the registered route
- **WHEN** a request with any standard HTTP method (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`,
  `HEAD`, `OPTIONS`) is made against a path registered via `@All`/`app.all`
- **THEN** the request matches and is handled correctly, identical to before this change

#### Scenario: No existing route-table consumer breaks
- **WHEN** any in-repo consumer of route introspection (e.g. `@nextrush/openapi`'s route
  generation, or class-package diagnostics) processes a route table containing an `@All` route
- **THEN** it correctly handles the single-entry, any-method shape without producing incorrect
  output (this scenario governs the pre-implementation consumer search noted in design.md's Risk
  section)

