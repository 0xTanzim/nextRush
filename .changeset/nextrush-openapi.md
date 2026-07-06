---
"@nextrush/openapi": minor
---

Add `@nextrush/openapi` — zero-config OpenAPI 3.1 generation, the first renderer of the Route Metadata System.

`app.plugin(openapi({ router }))` reads `router.getRoutes()` (request schemas contributed by `validate()`, docs by `endpoint()`), converts schemas to JSON Schema (vendor-dispatch for Zod/Valibot/ArkType, with a `toJsonSchema` escape hatch), assembles an OpenAPI 3.1 document **once** (lazily on first request, then cached), and serves it at `/openapi.json` plus a Swagger UI at `/docs`. Routes marked `endpoint({ visibility: 'internal' })` or matching `exclude` are omitted.

No decorators, no schema duplication — your existing `validate()` routes are the spec. Zero runtime dependencies; the request hot path never touches the generator.
