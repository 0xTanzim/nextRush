/**
 * @nextrush/openapi - Public options & types
 */

import type { Router, StandardSchemaV1 } from '@nextrush/types';

/** Converts a Standard Schema to a JSON Schema object. May return a Promise. */
export type SchemaConverter = (schema: StandardSchemaV1) => unknown;

export interface OpenApiInfo {
  title?: string;
  version?: string;
  description?: string;
}

export interface OpenApiOptions {
  /**
   * The router whose routes to document (same pattern as `controllersPlugin({ router })`).
   * Only its `getRoutes()` projection is read — never per request.
   */
  router: Pick<Router, 'getRoutes'>;
  /** Document info block. Defaults: title 'API', version '1.0.0'. */
  info?: OpenApiInfo;
  /** Path serving the JSON spec. Default `/openapi.json`. */
  path?: string;
  /** Path serving the docs UI, or `false` to disable. Default `/docs`. */
  docs?: string | false;
  /** Path prefixes to exclude from the spec (e.g. `/internal`). Prefix match. */
  exclude?: readonly string[];
  /** Whether the spec is served at all. Default `true`. */
  enabled?: boolean;
  /** Override schema→JSON-Schema conversion. Default: vendor-dispatch (zod/valibot/arktype). */
  toJsonSchema?: SchemaConverter;
}

/** A JSON-serializable OpenAPI 3.1 document (kept loose — renderers/clients validate). */
export type OpenApiDocument = Record<string, unknown>;
