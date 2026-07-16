---
"@nextrush/openapi": patch
---

Fix `generateDocument()` silently emitting only 1 of 7 expected operations for an
`@All()`/`app.all()` route.

Previously, an `@All()` route produced 7 rows in the router's route table (one per HTTP method),
so the generator naturally emitted one OpenAPI operation per row. As part of
`@nextrush/router`'s `@All()` consolidation (now a single route-table row marked
`isAnyMethod: true`), `generateDocument()` now explicitly expands an `isAnyMethod` row into one
operation per standard HTTP verb (`get`/`post`/`put`/`delete`/`patch`/`head`/`options`), each with
a distinct `operationId`. Before this fix, the same consolidation would have caused the generator
to emit only a single operation for an `@All()` route — 6 of 7 methods silently missing from the
generated spec. Non-`@All()` routes are unaffected; all 21 pre-existing tests pass unchanged.
