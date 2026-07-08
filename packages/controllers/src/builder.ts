/**
 * @nextrush/controllers - Handler Builder
 *
 * Builds route handlers from controller methods with parameter injection.
 * Orchestrates path construction, middleware resolution, and route metadata,
 * delegating per-route handler creation to {@link createRouteHandler}.
 */

import type {
  ControllerDefinition,
  ControllerMetadata,
  MiddlewareRef,
  RouteMetadata,
} from '@nextrush/decorators';
import type { Container } from '@nextrush/di';
import type { MetadataContribution, Middleware } from '@nextrush/types';
import { createRouteHandler } from './handler.js';
import type { BuiltRoute } from './types.js';

/**
 * Resolve middleware references to actual middleware functions.
 *
 * - Function refs are used directly
 * - String/symbol refs are resolved from the DI container
 */
function resolveMiddlewareRefs(refs: MiddlewareRef[], container: Container): Middleware[] {
  return refs.map((ref) => {
    if (typeof ref === 'function') {
      return ref as Middleware;
    }

    // String or symbol — resolve from DI container
    const resolved = container.resolve<Middleware>(ref as string);

    if (typeof resolved !== 'function') {
      throw new Error(
        `Middleware token "${String(ref)}" resolved to a non-function value. ` +
          'Ensure the registered provider returns a middleware function.'
      );
    }

    return resolved;
  });
}

/**
 * Build route handlers for a controller.
 *
 * @param instanceCache - Shared controller-instance cache (keyed by controller
 *   class). Handlers read-or-populate it so a controller singleton is resolved
 *   exactly once across boot-time validation and all requests. Defaults to a
 *   fresh per-call map when omitted (standalone use), preserving lazy resolution.
 */
export function buildRoutes(
  definition: ControllerDefinition,
  container: Container,
  globalPrefix: string,
  globalMiddleware: Middleware[],
  instanceCache: Map<Function, unknown> = new Map(),
  isRequestScoped = false
): BuiltRoute[] {
  const routes: BuiltRoute[] = [];
  const { target, controller, routes: routeMetadata } = definition;

  for (const route of routeMetadata) {
    const handler = createRouteHandler(target, route, container, instanceCache, isRequestScoped);
    const fullPath = buildFullRoutePath(
      globalPrefix,
      controller.path,
      route.path,
      controller.version
    );

    const combinedMiddleware: Middleware[] = [
      ...globalMiddleware,
      ...resolveMiddlewareRefs(controller.middleware ?? [], container),
      ...resolveMiddlewareRefs(route.middleware ?? [], container),
    ];

    routes.push({
      method: route.method,
      path: fullPath,
      handler,
      middleware: combinedMiddleware,
      controller: target,
      methodName: String(route.methodName),
      metadata: toRouteMetaContribution(controller, route),
    });
  }

  return routes;
}

/**
 * Map decorator documentation to a route metadata contribution.
 *
 * Pulls `description`/`deprecated` from the route decorator and `tags` from the
 * controller decorator. Returns `undefined` when the route carries no docs, so
 * undocumented routes stay metadata-free rather than gaining empty entries.
 */
function toRouteMetaContribution(
  controller: ControllerMetadata,
  route: RouteMetadata
): MetadataContribution | undefined {
  const contribution: {
    description?: string;
    deprecated?: boolean;
    tags?: string[];
  } = {};

  if (route.description) {
    contribution.description = route.description;
  }
  if (route.deprecated) {
    contribution.deprecated = true;
  }
  if (controller.tags && controller.tags.length > 0) {
    contribution.tags = [...controller.tags];
  }

  return Object.keys(contribution).length > 0 ? contribution : undefined;
}

/**
 * Build full route path with all prefixes
 */
function buildFullRoutePath(
  globalPrefix: string,
  controllerPath: string,
  routePath: string,
  version?: string
): string {
  const parts: string[] = [];

  if (globalPrefix && globalPrefix !== '/') {
    parts.push(globalPrefix.startsWith('/') ? globalPrefix : '/' + globalPrefix);
  }

  if (version) {
    parts.push('/' + version);
  }

  if (controllerPath && controllerPath !== '/') {
    parts.push(controllerPath.startsWith('/') ? controllerPath : '/' + controllerPath);
  }

  if (routePath && routePath !== '/') {
    parts.push(routePath.startsWith('/') ? routePath : '/' + routePath);
  }

  const fullPath = parts.join('') || '/';

  return fullPath.replace(/\/+/g, '/');
}
