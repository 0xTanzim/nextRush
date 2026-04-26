/**
 * @nextrush/decorators - Metadata Readers
 *
 * Utility functions to read decorator metadata from controller classes.
 * Used by @nextrush/controllers plugin to build routes.
 */

import 'reflect-metadata';
import type {
  ControllerMetadata,
  ParamMetadata,
  RedirectMetadata,
  ResponseHeaderMetadata,
  RouteMetadata,
} from './types.js';
import { DECORATOR_METADATA_KEYS } from './types.js';

/**
 * Check if a class has @Controller decorator.
 *
 * @example
 * ```typescript
 * @Controller('/users')
 * class UserController { }
 *
 * isController(UserController); // true
 * isController(SomeService);    // false
 * ```
 */
export function isController(target: Function): boolean {
  return Reflect.hasOwnMetadata(DECORATOR_METADATA_KEYS.CONTROLLER, target);
}

/**
 * Get controller metadata from a class.
 * Returns undefined if class doesn't have @Controller decorator.
 *
 * @example
 * ```typescript
 * @Controller('/users')
 * class UserController { }
 *
 * const meta = getControllerMetadata(UserController);
 * // { path: '/users', version: undefined, middleware: undefined, tags: undefined }
 * ```
 */
export function getControllerMetadata(target: Function): ControllerMetadata | undefined {
  const meta = Reflect.getOwnMetadata(DECORATOR_METADATA_KEYS.CONTROLLER, target);
  return meta ? { ...meta } : undefined;
}

/**
 * Get all route metadata from a controller class.
 * Returns empty array if no routes are defined.
 *
 * @example
 * ```typescript
 * @Controller('/users')
 * class UserController {
 *   @Get()
 *   findAll() { }
 *
 *   @Get('/:id')
 *   findOne() { }
 * }
 *
 * const routes = getRouteMetadata(UserController);
 * // [{ method: 'GET', path: '/', ... }, { method: 'GET', path: '/:id', ... }]
 * ```
 */
export function getRouteMetadata(target: Function): RouteMetadata[] {
  const routes = Reflect.getOwnMetadata(DECORATOR_METADATA_KEYS.ROUTES, target);
  return routes ? [...routes] : [];
}

/**
 * Get parameter metadata for a specific method.
 * Returns empty array if no parameters have decorators.
 *
 * @example
 * ```typescript
 * @Controller('/users')
 * class UserController {
 *   @Get('/:id')
 *   findOne(@Param('id') id: string, @Query('include') include: string) { }
 * }
 *
 * const params = getParamMetadata(UserController, 'findOne');
 * // [{ source: 'param', index: 0, name: 'id' }, { source: 'query', index: 1, name: 'include' }]
 * ```
 */
export function getParamMetadata(target: Function, methodName: string | symbol): ParamMetadata[] {
  const allParams: Map<string, ParamMetadata[]> =
    Reflect.getOwnMetadata(DECORATOR_METADATA_KEYS.PARAMS, target) ?? new Map();

  const params = allParams.get(String(methodName));
  return params ? [...params] : [];
}

/**
 * Get all parameter metadata for all methods in a controller.
 * Returns a Map where keys are method names.
 *
 * @example
 * ```typescript
 * const allParams = getAllParamMetadata(UserController);
 * // Map { 'findOne' => [...], 'create' => [...] }
 * ```
 */
export function getAllParamMetadata(target: Function): Map<string, ParamMetadata[]> {
  const params = Reflect.getOwnMetadata(DECORATOR_METADATA_KEYS.PARAMS, target);
  if (!params) return new Map();
  // Return a shallow copy to prevent external mutation
  const copy = new Map<string, ParamMetadata[]>();
  for (const [key, value] of params) {
    copy.set(key, [...value]);
  }
  return copy;
}

/**
 * Get full controller definition including metadata, routes, and params.
 * Returns undefined if class is not a controller.
 *
 * @example
 * ```typescript
 * const def = getControllerDefinition(UserController);
 * // {
 * //   controller: { path: '/users', ... },
 * //   routes: [{ method: 'GET', path: '/', ... }],
 * //   params: Map { 'findOne' => [...] }
 * // }
 * ```
 */
export function getControllerDefinition(target: Function): ControllerDefinition | undefined {
  const controller = getControllerMetadata(target);

  if (!controller) {
    return undefined;
  }

  return {
    target,
    controller,
    routes: getRouteMetadata(target),
    params: getAllParamMetadata(target),
  };
}

/**
 * Full controller definition with all metadata
 */
export interface ControllerDefinition {
  /** Controller class constructor */
  readonly target: Function;

  /** Controller-level metadata */
  readonly controller: ControllerMetadata;

  /** All route metadata */
  readonly routes: RouteMetadata[];

  /** Parameter metadata keyed by method name */
  readonly params: Map<string, ParamMetadata[]>;
}

/**
 * Build full route path by combining controller path and route path.
 * Handles version prefix if specified.
 *
 * @example
 * ```typescript
 * buildFullPath({ path: '/users', version: 'v1' }, { path: '/:id' });
 * // '/v1/users/:id'
 *
 * buildFullPath({ path: '/users' }, { path: '/' });
 * // '/users'
 * ```
 */
export function buildFullPath(controller: ControllerMetadata, route: RouteMetadata): string {
  const parts: string[] = [];

  if (controller.version) {
    parts.push(`/${controller.version}`);
  }

  if (controller.path !== '/') {
    parts.push(controller.path);
  }

  if (route.path !== '/') {
    parts.push(route.path);
  }

  const fullPath = parts.join('') || '/';

  return fullPath.replace(/\/+/g, '/');
}

/**
 * Get design-time parameter types for a method using reflect-metadata.
 * Requires `emitDecoratorMetadata: true` in tsconfig.
 *
 * @example
 * ```typescript
 * class UserController {
 *   findOne(id: string, ctx: Context): Promise<User> { }
 * }
 *
 * getMethodParameterTypes(UserController.prototype, 'findOne');
 * // [String, Context]
 * ```
 */
export function getMethodParameterTypes(target: object, methodName: string | symbol): Function[] {
  return Reflect.getMetadata('design:paramtypes', target, methodName) ?? [];
}

/**
 * Get design-time return type for a method using reflect-metadata.
 * Requires `emitDecoratorMetadata: true` in tsconfig.
 *
 * @example
 * ```typescript
 * class UserController {
 *   findOne(): Promise<User> { }
 * }
 *
 * getMethodReturnType(UserController.prototype, 'findOne');
 * // Promise
 * ```
 */
export function getMethodReturnType(
  target: object,
  methodName: string | symbol
): Function | undefined {
  return Reflect.getMetadata('design:returntype', target, methodName);
}

/**
 * Get response headers metadata for a controller method.
 *
 * Returns the list of `@SetHeader()` entries for the given method,
 * or an empty array if none are defined.
 */
export function getResponseHeaders(target: Function, methodName: string): ResponseHeaderMetadata[] {
  const map: Map<string, ResponseHeaderMetadata[]> | undefined = Reflect.getOwnMetadata(
    DECORATOR_METADATA_KEYS.RESPONSE_HEADERS,
    target
  );
  return [...(map?.get(methodName) ?? [])];
}

/**
 * Get redirect metadata for a controller method.
 *
 * Returns the `@Redirect()` configuration for the given method,
 * or `undefined` if not decorated.
 */
export function getRedirectMetadata(
  target: Function,
  methodName: string
): RedirectMetadata | undefined {
  const map: Map<string, RedirectMetadata> | undefined = Reflect.getOwnMetadata(
    DECORATOR_METADATA_KEYS.REDIRECT,
    target
  );
  return map?.get(methodName);
}
