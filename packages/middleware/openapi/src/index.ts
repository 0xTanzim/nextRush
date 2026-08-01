/**
 * @nextrush/openapi
 *
 * Zero-config OpenAPI 3.1 generation for NextRush — the first renderer of the
 * Route Metadata System. Reads `router.getRoutes()` (schemas contributed by
 * `validate()`, docs by `endpoint()`), generates a cached OpenAPI document, and
 * serves it plus a docs UI.
 *
 * @example
 * ```typescript
 * import { openapi } from '@nextrush/openapi';
 * app.use(openapi({ router })); // GET /openapi.json + GET /docs
 * ```
 *
 * @packageDocumentation
 */

export { openapi } from './middleware.js';
export { generateDocument, toOpenApiPath, extractPathParams } from './generate.js';
export type {
  OpenApiDocument,
  OpenApiInfo,
  OpenApiOptions,
  SchemaConverter,
} from './types.js';
