/**
 * @nextrush/router - Route Metadata Contributions
 *
 * Inline route metadata (`endpoint()`) and the registration-time merge of
 * contributions from `validate()`, `endpoint()`, etc. Extracted from `router.ts`
 * (audit RT-3). None of this is on the request hot path — it is read only at
 * registration and by `getRoutes()` at doc-generation time.
 *
 * @packageDocumentation
 */

import {
  ROUTE_METADATA,
  type MetadataContribution,
  type RouteEntry,
  type RouteMetadata,
  type RouteMetaMarker,
} from '@nextrush/types';

/**
 * Declare route metadata inline in a route's argument list. Returns a pure data
 * marker (not a middleware) — the router reads its metadata at registration and
 * never executes it per request.
 *
 * @example
 * ```typescript
 * router.post('/users',
 *   validate(User),
 *   endpoint({ summary: 'Create a user', responses: { 201: UserResponse } }),
 *   handler,
 * );
 * ```
 */
export function endpoint(metadata: MetadataContribution): RouteMetaMarker {
  return { [ROUTE_METADATA]: metadata };
}

/** Mutable view of RouteMetadata, used only while merging contributions. */
type MutableRouteMetadata = { -readonly [K in keyof RouteMetadata]?: RouteMetadata[K] };

/**
 * Merge metadata contributions (from `validate()`, `endpoint()`, etc.) in
 * registration order. Scalars and arrays are last-write-wins; the `request` and
 * `responses` maps merge per key. Returns `undefined` when nothing contributed
 * (an undocumented route).
 */
export function mergeContributions(
  contributions: readonly MetadataContribution[]
): RouteMetadata | undefined {
  if (contributions.length === 0) return undefined;

  const meta: MutableRouteMetadata = {};
  for (const c of contributions) {
    if (c.summary !== undefined) meta.summary = c.summary;
    if (c.description !== undefined) meta.description = c.description;
    if (c.deprecated !== undefined) meta.deprecated = c.deprecated;
    if (c.visibility !== undefined) meta.visibility = c.visibility;
    if (c.tags !== undefined) meta.tags = c.tags;
    if (c.request) meta.request = { ...meta.request, ...c.request };
    if (c.responses) meta.responses = { ...meta.responses, ...c.responses };
  }
  return meta;
}

/** Read a route entry's metadata contribution, if it carries one. */
export function readContribution(entry: RouteEntry): MetadataContribution | undefined {
  return (entry as Partial<RouteMetaMarker>)[ROUTE_METADATA];
}
