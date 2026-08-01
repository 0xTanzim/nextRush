/**
 * @nextrush/class - Route Handler Factory
 *
 * Builds the per-route handler: runs guards, lazily resolves the controller
 * singleton, injects parameters, invokes the method, and applies response
 * metadata (@SetHeader headers, route status code, @Redirect).
 */

import type { ControllerRouteMetadata } from '../types.js';
import {
  getHttpCode,
  getParamMetadata,
  getRedirectMetadata,
  getResponseHeaders,
} from '../metadata/metadata.js';
import { getAllFilters } from '../filters/filters.js';
import { getAllGuards } from '../guards/guards.js';
import { getAllInterceptors } from '../interceptors/interceptors.js';
import type { Container } from '@nextrush/di';
import type { Context, RouteHandler } from '@nextrush/types';
import { ControllerResolutionError } from '../errors.js';
import { wrapWithFilters } from '../filters/filter-runner.js';
import { executeGuards } from '../guards/guard-runner.js';
import { runInterceptors } from '../interceptors/interceptor-runner.js';
import { resolveParametersFromPlan } from '../binding/param-resolver.js';

/** A controller-class token tsyringe can resolve. */
type ControllerToken = new (...args: unknown[]) => unknown;

/**
 * Lazy-memoized singleton resolution (the default, zero new per-request cost).
 *
 * Resolves the controller on first use and caches it in the shared
 * `instanceCache`, so `validate: true`'s boot resolve and the first request
 * share one instance. A failed resolve is never cached — resolution retries on
 * each request until it succeeds.
 */
function resolveMemoizedSingleton(
  controllerClass: Function,
  container: Container,
  instanceCache: Map<Function, unknown>
): () => unknown {
  return () => {
    if (!instanceCache.has(controllerClass)) {
      try {
        instanceCache.set(controllerClass, container.resolve(controllerClass as ControllerToken));
      } catch (error) {
        throw new ControllerResolutionError(
          controllerClass.name,
          error instanceof Error ? error : undefined
        );
      }
    }
    return instanceCache.get(controllerClass);
  };
}

/**
 * Per-request-child resolution for effectively request-scoped controllers.
 *
 * A fresh child container is created on each request and the controller resolved
 * from it — request-scoped (ContainerScoped) dependencies are fresh per request
 * and shared within one, while singletons resolve from the parent and stay
 * shared. The instance is never memoized.
 */
function resolveFromRequestChild(
  controllerClass: Function,
  container: Container
): () => unknown {
  return () => {
    try {
      return container.createChild().resolve(controllerClass as ControllerToken);
    } catch (error) {
      throw new ControllerResolutionError(
        controllerClass.name,
        error instanceof Error ? error : undefined
      );
    }
  };
}

/**
 * Create a route handler that resolves the controller and injects parameters.
 *
 * @param instanceCache - Shared controller-instance cache. The controller
 *   singleton is resolved once and stored here, so `validate: true`'s boot-time
 *   resolve and the first request share one instance rather than resolving twice.
 * @param isRequestScoped - Whether this controller is effectively request-scoped
 *   (itself or anything in its dependency graph declares `scope: 'request'`).
 *   When true, a fresh per-request child container is created on each request and
 *   the controller resolved from it (never memoized), so request-scoped instances
 *   are fresh per request and shared within one. When false, the lazy-memoized
 *   singleton path is kept — zero new per-request overhead.
 */
export function createRouteHandler(
  controllerClass: Function,
  route: ControllerRouteMetadata,
  container: Container,
  instanceCache: Map<Function, unknown>,
  isRequestScoped = false
): RouteHandler {
  const methodName = String(route.methodName);
  const paramMetadata = getParamMetadata(controllerClass, methodName);
  const guards = getAllGuards(controllerClass, methodName);
  const filters = getAllFilters(controllerClass, methodName);
  const interceptors = getAllInterceptors(controllerClass, methodName);

  // Precompute sorted param injection plan at build time (not per-request)
  const sortedParams =
    paramMetadata.length > 0 ? [...paramMetadata].sort((a, b) => a.index - b.index) : [];

  const statusCode = route.statusCode;
  // @HttpCode overrides the route decorator's statusCode option when both are set.
  const httpCode = getHttpCode(controllerClass, methodName);
  const effectiveStatusCode = httpCode ?? statusCode;
  const responseHeaders = getResponseHeaders(controllerClass, methodName);
  const redirectMeta = getRedirectMetadata(controllerClass, methodName);

  // Choose the controller-resolution strategy once, at build time.
  const resolveControllerInstance = isRequestScoped
    ? resolveFromRequestChild(controllerClass, container)
    : resolveMemoizedSingleton(controllerClass, container, instanceCache);

  const execute: RouteHandler = async (ctx: Context): Promise<void> => {
    // Execute guards first (if any) — always per-request, never hoisted.
    if (guards.length > 0) {
      await executeGuards(guards, ctx, container, controllerClass.name, methodName);
    }

    const controllerInstance = resolveControllerInstance();
    const args = await resolveParametersFromPlan(
      ctx,
      sortedParams,
      controllerClass.name,
      methodName
    );

    const method = (controllerInstance as Record<string, unknown>)[methodName];

    if (typeof method !== 'function') {
      throw new Error(`Method "${methodName}" not found on controller "${controllerClass.name}"`);
    }

    // Invoke the method through the interceptor onion when interceptors are
    // declared; otherwise call it directly (no overhead for interceptor-free
    // routes). The (possibly transformed) result flows into response handling.
    const invokeMethod = (): Promise<unknown> =>
      Promise.resolve(method.apply(controllerInstance, args));
    const result =
      interceptors.length > 0
        ? await runInterceptors(interceptors, ctx, container, invokeMethod)
        : await invokeMethod();

    // Apply response headers from @SetHeader() metadata
    for (const header of responseHeaders) {
      ctx.set(header.name, header.value);
    }

    // Apply status code: @HttpCode takes precedence over the route statusCode.
    if (effectiveStatusCode !== undefined) {
      ctx.status = effectiveStatusCode;
    }

    // Handle @Redirect() metadata
    if (redirectMeta && !ctx.responded) {
      let redirectUrl = redirectMeta.url;
      let redirectStatus = redirectMeta.statusCode;

      // Method return value can override the redirect URL/status
      if (typeof result === 'string') {
        redirectUrl = result;
      } else if (result && typeof result === 'object' && 'url' in result) {
        const override = result as { url?: string; statusCode?: number };
        if (override.url) redirectUrl = override.url;
        if (override.statusCode) redirectStatus = override.statusCode;
      }

      ctx.status = redirectStatus;
      ctx.set('Location', redirectUrl);
      ctx.send('');
      return;
    }

    // Check if response has already been sent (adapter-agnostic)
    if (result !== undefined && !ctx.responded) {
      if (typeof result === 'object') {
        ctx.json(result);
      } else {
        ctx.send(String(result));
      }
    }
  };

  // Wrap with the exception-filter pipeline only when the route declares
  // filters — filter-free routes keep their original, unwrapped behavior so
  // errors propagate to the global error middleware exactly as before.
  return filters.length > 0 ? wrapWithFilters(execute, filters, container) : execute;
}
