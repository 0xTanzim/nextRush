/**
 * @nextrush/controllers - Handler Builder
 *
 * Builds route handlers from controller methods with parameter injection.
 * Supports async transforms, guards (function and class-based), and interceptors.
 */

import type {
  CanActivate,
  ControllerDefinition,
  Guard,
  GuardContext,
  MiddlewareRef,
  ParamMetadata,
  RouteMetadata,
} from '@nextrush/decorators';
import {
  getAllGuards,
  getParamMetadata,
  getRedirectMetadata,
  getResponseHeaders,
  isGuardClass,
} from '@nextrush/decorators';
import type { ContainerInterface } from '@nextrush/di';
import type { Context, Middleware, RouteHandler } from '@nextrush/types';
import 'reflect-metadata';
import {
  ControllerResolutionError,
  GuardRejectionError,
  MissingParameterError,
  ParameterInjectionError,
} from './errors.js';
import type { BuiltRoute } from './types.js';

/**
 * Resolve middleware references to actual middleware functions.
 *
 * - Function refs are used directly
 * - String/symbol refs are resolved from the DI container
 */
function resolveMiddlewareRefs(refs: MiddlewareRef[], container: ContainerInterface): Middleware[] {
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
 * Build route handlers for a controller
 */
export function buildRoutes(
  definition: ControllerDefinition,
  container: ContainerInterface,
  globalPrefix: string,
  globalMiddleware: Middleware[]
): BuiltRoute[] {
  const routes: BuiltRoute[] = [];
  const { target, controller, routes: routeMetadata } = definition;

  for (const route of routeMetadata) {
    const handler = createRouteHandler(target, route, container);
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
    });
  }

  return routes;
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

/**
 * Create a route handler that resolves the controller and injects parameters
 */
function createRouteHandler(
  controllerClass: Function,
  route: RouteMetadata,
  container: ContainerInterface
): RouteHandler {
  const methodName = String(route.methodName);
  const paramMetadata = getParamMetadata(controllerClass, methodName);
  const guards = getAllGuards(controllerClass, methodName);

  // Precompute sorted param injection plan at build time (not per-request)
  const sortedParams =
    paramMetadata.length > 0 ? [...paramMetadata].sort((a, b) => a.index - b.index) : [];

  const statusCode = route.statusCode;
  const responseHeaders = getResponseHeaders(controllerClass, methodName);
  const redirectMeta = getRedirectMetadata(controllerClass, methodName);

  return async (ctx: Context): Promise<void> => {
    // Execute guards first (if any)
    if (guards.length > 0) {
      await executeGuards(guards, ctx, container, controllerClass.name, methodName);
    }

    let controllerInstance: unknown;

    try {
      controllerInstance = container.resolve(
        controllerClass as new (...args: unknown[]) => unknown
      );
    } catch (error) {
      throw new ControllerResolutionError(
        controllerClass.name,
        error instanceof Error ? error : undefined
      );
    }

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

    // Apply statusCode from route metadata if set
    if (statusCode !== undefined) {
      ctx.status = statusCode;
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
}

/**
 * Execute guards and throw if any guard rejects.
 * Supports both function-based and class-based guards.
 * Class guards are resolved from the DI container.
 */
async function executeGuards(
  guards: Guard[],
  ctx: Context,
  container: ContainerInterface,
  controllerName: string,
  methodName: string
): Promise<void> {
  const guardContext: GuardContext = {
    method: ctx.method,
    path: ctx.path,
    params: ctx.params,
    query: ctx.query,
    headers: ctx.headers,
    body: ctx.body,
    state: ctx.state,
    get: (name: string) => ctx.get(name),
  };

  for (let i = 0; i < guards.length; i++) {
    const guard = guards[i]!;
    let guardName: string;
    let result: boolean;

    try {
      if (isGuardClass(guard)) {
        // Class-based guard - resolve from DI container
        guardName = guard.name || `ClassGuard[${i}]`;
        const guardInstance = container.resolve(guard) as CanActivate;
        result = await guardInstance.canActivate(guardContext);
      } else {
        // Function-based guard
        guardName = guard.name || `Guard[${i}]`;
        result = await guard(guardContext);
      }

      if (!result) {
        throw new GuardRejectionError(
          guardName,
          `Access denied by guard for ${controllerName}.${methodName}`
        );
      }
    } catch (error) {
      if (error instanceof GuardRejectionError) {
        throw error;
      }
      // Guard threw an error - treat as rejection
      const errorGuardName = isGuardClass(guard)
        ? guard.name || `ClassGuard[${i}]`
        : guard.name || `Guard[${i}]`;
      throw new GuardRejectionError(
        errorGuardName,
        error instanceof Error ? error.message : 'Guard execution failed'
      );
    }
  }
}

/**
 * Resolve parameter values from a precomputed, pre-sorted injection plan.
 * Supports async transform functions for validation libraries (zod, valibot, etc.)
 */
async function resolveParametersFromPlan(
  ctx: Context,
  sortedMetadata: ParamMetadata[],
  controllerName: string,
  methodName: string
): Promise<unknown[]> {
  if (sortedMetadata.length === 0) {
    return [];
  }

  const maxIndex =
    sortedMetadata.length > 0 ? sortedMetadata[sortedMetadata.length - 1]!.index : -1;
  const args: unknown[] = new Array(maxIndex + 1).fill(undefined);

  for (const param of sortedMetadata) {
    try {
      // Await supports async custom extractors (createCustomParamDecorator)
      const value = await extractParameterValue(ctx, param);

      if (value === undefined) {
        if (param.required && param.defaultValue === undefined) {
          throw new MissingParameterError(
            controllerName,
            methodName,
            param.name ?? `index ${param.index}`,
            param.source
          );
        }
        args[param.index] = param.defaultValue;
      } else {
        // Support both sync and async transform functions
        args[param.index] = param.transform ? await param.transform(value) : value;
      }
    } catch (error) {
      if (error instanceof MissingParameterError) {
        throw error;
      }
      throw new ParameterInjectionError(
        controllerName,
        methodName,
        param.index,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return args;
}

/**
 * Extract parameter value from context based on source
 */
function extractParameterValue(ctx: Context, param: ParamMetadata): unknown {
  switch (param.source) {
    case 'body':
      if (param.name) {
        return (ctx.body as Record<string, unknown>)?.[param.name];
      }
      return ctx.body;

    case 'param':
      if (param.name) {
        return ctx.params[param.name];
      }
      return ctx.params;

    case 'query':
      if (param.name) {
        return ctx.query[param.name];
      }
      return ctx.query;

    case 'header':
      if (param.name) {
        return ctx.get(param.name);
      }
      return ctx.headers;

    case 'ctx':
      return ctx;

    case 'req':
      return ctx.raw.req;

    case 'res':
      return ctx.raw.res;

    case 'custom':
      if (param.customExtractor) {
        return param.customExtractor(ctx);
      }
      return undefined;

    default:
      return undefined;
  }
}
