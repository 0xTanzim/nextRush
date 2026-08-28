/**
 * @nextrush/router - Router Composition
 *
 * Sub-router mounting/copying logic extracted from the `Router` class (T014,
 * design.md D3 — extracted after the matching-engine split left `router.ts`
 * still over the 300-line ceiling).
 *
 * `copyRoutes`'s tree walk is structurally pure (segments/prefix/middleware are
 * all explicit parameters), but its side effect — registering the copied route —
 * needs `Router.addRoute`, a private method. Rather than reach into `Router`
 * internals or promote `addRoute` to `public` (a public-API change out of scope
 * for this refactor), the effect is injected explicitly as an `addRoute`
 * callback parameter. `use`/`mount`/`mountRouter` stay on `Router` itself:
 * they return `this` for fluent chaining and read `Router` instance state
 * (`root`, `routerMiddleware`) that isn't naturally expressible as function
 * parameters without more ceremony than the win justifies.
 *
 * @packageDocumentation
 * @internal
 */

import { ROUTE_METADATA, type HttpMethod, type Middleware, type RouteEntry, type RouteMetadata, type RouteMetaMarker } from '@nextrush/types';
import type { TrieNode } from './segment-trie';

/**
 * Callback signature matching `Router['addRoute']` (the validating wrapper on
 * `Router`) — injected, not imported. Takes full `RouteEntry[]` (behavior and
 * pure-metadata markers) so a copied route can re-emit its metadata.
 */
export type AddRouteFn = (
  method: HttpMethod,
  path: string,
  entries: RouteEntry[],
  middleware: Middleware[]
) => void;

/**
 * Re-emit a copied route's merged metadata as a pure metadata entry — the same
 * `RouteMetaMarker` shape `endpoint()` produces. Pure data: never executed.
 */
function metadataMarker(metadata: RouteMetadata): RouteMetaMarker {
  return { [ROUTE_METADATA]: metadata };
}

/**
 * Recursively copy routes from one router's trie into another via the
 * supplied `addRoute` callback.
 */
export function copyRoutes(
  node: TrieNode,
  prefix: string,
  segments: string[],
  subRouterMiddleware: Middleware[],
  addRoute: AddRouteFn
): void {
  // Copy handlers at this node
  for (const [method, entry] of node.handlers) {
    // A derived HEAD entry is not copied — the parent re-derives it from the
    // GET registration below, which keeps the parent's own explicit-HEAD
    // precedence and introspection rows correct.
    if (entry.autoHead) continue;
    const path = prefix + '/' + segments.join('/');
    // Prepend sub-router middleware so it runs before the route's own middleware
    const combined =
      subRouterMiddleware.length > 0
        ? [...subRouterMiddleware, ...entry.middleware]
        : entry.middleware;
    // Re-emit the route's merged metadata exactly once as a pure marker entry,
    // so the copied route re-enters `addRoute` through the SAME contribution
    // collection path as a directly registered route — lossless for every
    // contributor kind (validate()-style middleware, endpoint() markers, and
    // anything else carrying ROUTE_METADATA).
    const copiedEntries: RouteEntry[] = entry.metadata
      ? [entry.handler, metadataMarker(entry.metadata)]
      : [entry.handler];
    addRoute(method, path || '/', copiedEntries, combined);
  }

  // Copy static children
  for (const [, child] of node.children) {
    copyRoutes(child, prefix, [...segments, child.segment], subRouterMiddleware, addRoute);
  }

  // Copy param child
  if (node.paramChild) {
    copyRoutes(
      node.paramChild,
      prefix,
      [...segments, node.paramChild.segment],
      subRouterMiddleware,
      addRoute
    );
  }

  // Copy wildcard child
  if (node.wildcardChild) {
    copyRoutes(node.wildcardChild, prefix, [...segments, '*'], subRouterMiddleware, addRoute);
  }
}
