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
    ParamMetadata,
    RouteMetadata,
} from '@nextrush/decorators';
import { getAllGuards, getParamMetadata, isGuardClass } from '@nextrush/decorators';
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
    const fullPath = buildFullRoutePath(globalPrefix, controller.path, route.path, controller.version);

    const combinedMiddleware: Middleware[] = [
      ...globalMiddleware,
      ...(controller.middleware ?? []) as Middleware[],
      ...(route.middleware ?? []) as Middleware[],
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

  return async (ctx: Context): Promise<void> => {
    // Execute guards first (if any)
    if (guards.length > 0) {
      await executeGuards(guards, ctx, container, controllerClass.name, methodName);
    }

    let controllerInstance: unknown;

    try {
      controllerInstance = container.resolve(controllerClass as new (...args: unknown[]) => unknown);
    } catch (error) {
      throw new ControllerResolutionError(
        controllerClass.name,
        error instanceof Error ? error : undefined
      );
    }

    const args = await resolveParameters(
      ctx,
      paramMetadata,
      controllerClass.name,
      methodName
    );

    const method = (controllerInstance as Record<string, unknown>)[methodName];

    if (typeof method !== 'function') {
      throw new Error(`Method "${methodName}" not found on controller "${controllerClass.name}"`);
    }

    const result = await method.apply(controllerInstance, args);

    const response = ctx.raw.res as { writableEnded?: boolean };

    if (result !== undefined && !response.writableEnded) {
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
        ? (guard.name || `ClassGuard[${i}]`)
        : (guard.name || `Guard[${i}]`);
      throw new GuardRejectionError(
        errorGuardName,
        error instanceof Error ? error.message : 'Guard execution failed'
      );
    }
  }
}

/**
 * Resolve parameter values from context based on metadata
 * Supports async transform functions for validation libraries (zod, valibot, etc.)
 */
async function resolveParameters(
  ctx: Context,
  metadata: ParamMetadata[],
  controllerName: string,
  methodName: string
): Promise<unknown[]> {
  if (metadata.length === 0) {
    return [];
  }

  const sortedMetadata = [...metadata].sort((a, b) => a.index - b.index);
  const maxIndex = Math.max(...sortedMetadata.map((m) => m.index));
  const args: unknown[] = new Array(maxIndex + 1).fill(undefined);

  for (const param of sortedMetadata) {
    try {
      const value = extractParameterValue(ctx, param);

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

    default:
      return undefined;
  }
}
