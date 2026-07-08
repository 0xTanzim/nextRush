/**
 * Router stage: Mount all built routes on the router.
 */

import type { BootstrapContext } from '../context.js';
import type { Router } from '@nextrush/core';
import { ROUTE_METADATA } from '@nextrush/types';
import { RouteRegistrationError } from '../../errors.js';
import type { BuiltRoute } from '../../registrar/registrar-types.js';

export function routerStage(ctx: BootstrapContext): void {
  const router = ctx.router;

  // Register from the frozen Application Graph (the source of truth once built);
  // fall back to the raw built routes defensively if the graph is not assembled.
  const routes = ctx.graph ? ctx.graph.routes : ctx.builtRoutes;

  for (const route of routes) {
    try {
      const method = route.method.toLowerCase() as keyof Router;

      if (typeof router[method] !== 'function') {
        throw new RouteRegistrationError(
          'Unknown',
          route.method,
          route.path,
          `Router does not support HTTP method: ${route.method}`
        );
      }

      // Build middleware+handler array from route definition
      const entries = buildRouteEntries(route);

      (router[method] as (path: string, ...entries: unknown[]) => unknown)(
        route.path,
        ...entries
      );
    } catch (error) {
      throw new RouteRegistrationError(
        'Unknown',
        route.method,
        route.path,
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      );
    }
  }
}

/**
 * Build middleware + handler array from a route definition.
 * Mirrors buildRouteEntries from registrar.ts.
 */
function buildRouteEntries(route: BuiltRoute): unknown[] {
  const entries: unknown[] = [...route.middleware];
  if (route.metadata) {
    entries.push({ [ROUTE_METADATA]: route.metadata });
  }
  entries.push(route.handler);
  return entries;
}
