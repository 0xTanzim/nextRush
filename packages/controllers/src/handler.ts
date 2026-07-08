/**
 * @nextrush/controllers - Route Handler Factory
 *
 * Builds the per-route handler: runs guards, lazily resolves the controller
 * singleton, injects parameters, invokes the method, and applies response
 * metadata (@SetHeader headers, route status code, @Redirect).
 */

import type { RouteMetadata } from '@nextrush/decorators';
import {
  getAllFilters,
  getAllGuards,
  getHttpCode,
  getParamMetadata,
  getRedirectMetadata,
  getResponseHeaders,
} from '@nextrush/decorators';
import type { Container } from '@nextrush/di';
import type { Context, RouteHandler } from '@nextrush/types';
import { ControllerResolutionError } from './errors.js';
import { wrapWithFilters } from './filter-runner.js';
import { executeGuards } from './guard-runner.js';
import { resolveParametersFromPlan } from './param-resolver.js';

/**
 * Create a route handler that resolves the controller and injects parameters.
 *
 * @param instanceCache - Shared controller-instance cache. The controller
 *   singleton is resolved once and stored here, so `validate: true`'s boot-time
 *   resolve and the first request share one instance rather than resolving twice.
 */
export function createRouteHandler(
  controllerClass: Function,
  route: RouteMetadata,
  container: Container,
  instanceCache: Map<Function, unknown>
): RouteHandler {
  const methodName = String(route.methodName);
  const paramMetadata = getParamMetadata(controllerClass, methodName);
  const guards = getAllGuards(controllerClass, methodName);
  const filters = getAllFilters(controllerClass, methodName);

  // Precompute sorted param injection plan at build time (not per-request)
  const sortedParams =
    paramMetadata.length > 0 ? [...paramMetadata].sort((a, b) => a.index - b.index) : [];

  const statusCode = route.statusCode;
  // @HttpCode overrides the route decorator's statusCode option when both are set.
  const httpCode = getHttpCode(controllerClass, methodName);
  const effectiveStatusCode = httpCode ?? statusCode;
  const responseHeaders = getResponseHeaders(controllerClass, methodName);
  const redirectMeta = getRedirectMetadata(controllerClass, methodName);

  const execute: RouteHandler = async (ctx: Context): Promise<void> => {
    // Execute guards first (if any) — always per-request, never hoisted.
    if (guards.length > 0) {
      await executeGuards(guards, ctx, container, controllerClass.name, methodName);
    }

    // Controllers are registered as singletons, so the instance never changes.
    // Resolve lazily on first use and memoize in the shared cache — this keeps
    // the hot path allocation-free without forcing resolution at build time (so
    // a `validate: false` opt-out still defers DI resolution to request time),
    // and reuses the instance already resolved by boot-time eager validation.
    if (!instanceCache.has(controllerClass)) {
      try {
        instanceCache.set(
          controllerClass,
          container.resolve(controllerClass as new (...args: unknown[]) => unknown)
        );
      } catch (error) {
        // Do not cache a failed resolution — keep retrying on each request
        // until it succeeds (preserves retry-on-failure semantics).
        throw new ControllerResolutionError(
          controllerClass.name,
          error instanceof Error ? error : undefined
        );
      }
    }
    const controllerInstance = instanceCache.get(controllerClass);
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

    const result = await method.apply(controllerInstance, args);

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
