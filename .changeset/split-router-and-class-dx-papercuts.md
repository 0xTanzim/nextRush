---
"@nextrush/router": patch
"@nextrush/class": patch
---

Three small papercut fixes, batched because they touch the same class/router package pair:

- **`@nextrush/router`**: `router.ts` (918 lines) split into `matching.ts`, `match-route.ts`,
  `composition.ts`, `middleware-adapter.ts`, and `registration.ts` along its existing thematic
  seams (matching engine, sub-router composition, middleware adaptation, route registration).
  `Router`'s public shape, exported symbols, and dispatch behavior are unchanged — confirmed via
  the package's public-surface snapshot test (byte-identical before/after) and the full
  behavioral suite (212/212 passing at every extraction step, not just at the end). Purely
  internal file reorganization.

- **`@nextrush/router` + `@nextrush/class`**: `@All()`/`app.all()` (and `router.group(...).all()`)
  now register a single ANY-method route-table entry instead of one entry per explicitly-
  enumerated HTTP method. All 7 standard verbs still match an `@All()` route identically — this
  changes only what `getRoutes()` reports for an `@All()` route (1 row instead of 7), not
  dispatch. `@nextrush/openapi`, the one in-repo consumer of `getRoutes()` found via a codebase-
  wide search, was updated in the same change: previously it silently emitted only 1 of 7
  expected operations for an `@All()` route in a generated OpenAPI spec (a real correctness bug),
  now it correctly expands an ANY-method row into one operation per standard verb. New,
  additive `RouteDefinition.isAnyMethod?: boolean` field in `@nextrush/types`.

- **`@nextrush/class`**: `@Body()` resolving to nothing because no body-parser middleware ran now
  throws a `MissingParameterError` whose message names the likely fix (`app.use(json())`),
  instead of the same generic message used for every other missing-parameter case. Other
  parameter sources (`@Param`, `@Query`, `@Header`) are unaffected — the hint is scoped to the
  body source specifically, where "no parser ran" is the common, previously-unexplained cause.
