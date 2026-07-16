/**
 * @nextrush/types - Route Metadata Contracts
 *
 * `RouteDefinition` is the single source of truth for what a route *is and
 * means*. The router collects it once at registration; renderers
 * (`@nextrush/openapi`, and later SDK/Postman/RPC generators) read it. The
 * router itself is renderer-agnostic — it stores raw schemas and generic
 * metadata, never OpenAPI shapes.
 *
 * See docs/RFC/RFC-NEXTRUSH-ROUTE-METADATA.md.
 *
 * @packageDocumentation
 */

import type { Middleware } from './context';
import type { HttpMethod } from './http';
import type { StandardSchemaV1 } from './standard-schema';

/**
 * Well-known symbol by which anything — a middleware function (e.g. `validate()`)
 * or a pure marker (e.g. `endpoint()`) — contributes metadata to the route it is
 * registered on. The router reads this symbol off every route entry at
 * registration and merges the contributions.
 *
 * `Symbol.for` (global registry) is used so the identity holds even across
 * duplicate package instances.
 */
export const ROUTE_METADATA: unique symbol = Symbol.for('nextrush.route.metadata');

/** A partial metadata contribution; contributions merge in registration order. */
export type MetadataContribution = Partial<RouteMetadata>;

/**
 * A pure-metadata marker carried in a route's argument list. Not a middleware —
 * it has no runtime behavior and never enters the executed chain.
 */
export interface RouteMetaMarker {
  readonly [ROUTE_METADATA]: MetadataContribution;
}

/** An entry in a route's argument list: behavior (`Middleware`) or pure metadata (a marker). */
export type RouteEntry = Middleware | RouteMetaMarker;

/**
 * Generic, renderer-agnostic description of a route's request/response shapes
 * and documentation facts. Every field is a fact any renderer needs; no
 * renderer-specific artifacts (e.g. OpenAPI `operationId`) live here.
 */
export interface RouteMetadata {
  /** Request shapes — contributed by `validate()`; never hand-written on the golden path. */
  readonly request?: {
    readonly body?: StandardSchemaV1;
    readonly query?: StandardSchemaV1;
    readonly params?: StandardSchemaV1;
  };
  /** Response shapes by numeric status — contributed by `endpoint()`. */
  readonly responses?: Readonly<Record<number, StandardSchemaV1>>;
  readonly summary?: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly deprecated?: boolean;
  /** Cross-renderer intent — an `'internal'` route is excluded from public specs/SDKs. */
  readonly visibility?: 'public' | 'internal';
}

/**
 * The canonical description of a registered endpoint, produced by the router
 * and consumed by renderers.
 */
export interface RouteDefinition {
  /**
   * Canonical route key — `${METHOD} ${pathPattern}` (e.g. `"GET /users/:id"`),
   * the key the router uses internally. Deterministic and stable across
   * restarts, but it encodes the path, so it changes if the path or a param
   * name changes — a key, not a rename-stable opaque id.
   */
  readonly key: string;
  readonly method: HttpMethod;
  /** Full, mount/prefix-resolved path pattern. */
  readonly path: string;
  readonly metadata?: RouteMetadata;
  /**
   * `true` when this entry represents an any-method route (registered via
   * `router.all()` / `@All()`), matching every standard HTTP method under a
   * single introspection row rather than one row per method (T016). `method`
   * is still a real `HttpMethod` value for structural compatibility with
   * existing consumers that read `.method` unconditionally — check this flag
   * first when the distinction matters (e.g. an OpenAPI renderer expanding
   * one row into per-verb operations). Absent (`undefined`) for every
   * ordinary single-method route.
   */
  readonly isAnyMethod?: boolean;
}
