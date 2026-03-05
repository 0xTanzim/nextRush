/**
 * @nextrush/decorators - Type Definitions
 *
 * Core type definitions for controller, route, and parameter metadata.
 * These types define the shape of metadata stored by decorators.
 */

import type { HttpMethod } from '@nextrush/types';

/**
 * Supported HTTP methods for route decorators
 */
export type RouteMethods = Extract<
  HttpMethod,
  'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
>;

/**
 * Parameter source types for parameter decorators
 */
export type ParamSource = 'body' | 'query' | 'param' | 'header' | 'ctx' | 'req' | 'res' | 'custom';

/**
 * Controller metadata stored by @Controller decorator
 */
export interface ControllerMetadata {
  /** Base path prefix for all routes in this controller */
  readonly path: string;

  /** Optional controller version for API versioning */
  readonly version?: string;

  /** Middleware to apply to all routes in this controller */
  readonly middleware?: MiddlewareRef[];

  /** Controller-level tags for documentation/grouping */
  readonly tags?: string[];
}

/**
 * Route metadata stored by @Get, @Post, etc. decorators
 */
export interface RouteMetadata {
  /** HTTP method for this route */
  readonly method: RouteMethods;

  /** Path pattern for this route (relative to controller path) */
  readonly path: string;

  /** Method name on the controller class */
  readonly methodName: string | symbol;

  /** Parameter index in the prototype */
  readonly propertyKey: string | symbol;

  /** Route-specific middleware */
  readonly middleware?: MiddlewareRef[];

  /** Response status code (default: 200 for GET, 201 for POST) */
  readonly statusCode?: number;

  /** Route description for documentation */
  readonly description?: string;

  /** Whether this route is deprecated */
  readonly deprecated?: boolean;
}

/**
 * Parameter metadata stored by @Body, @Param, etc. decorators
 */
export interface ParamMetadata {
  /** Source of the parameter value */
  readonly source: ParamSource;

  /** Parameter index in method signature */
  readonly index: number;

  /** Property name to extract (e.g., 'id' from params.id) */
  readonly name?: string;

  /** Whether the parameter is required (default: true for body/param) */
  readonly required?: boolean;

  /** Default value if not provided */
  readonly defaultValue?: unknown;

  /** Validation pipe or transform function */
  readonly transform?: TransformFn;

  /** Custom extractor function for user-defined param decorators */
  readonly customExtractor?: CustomParamExtractor;
}

/**
 * Transform function for parameter value transformation.
 * Supports both sync and async transforms.
 */
export type TransformFn<TInput = unknown, TOutput = unknown> =
  | ((value: TInput) => TOutput)
  | ((value: TInput) => Promise<TOutput>);

/**
 * Reference to middleware - can be a class token or function
 */
export type MiddlewareRef = symbol | string | ((...args: unknown[]) => unknown);

/**
 * Minimal context interface for guards (avoids circular dependency)
 */
export interface GuardContext {
  readonly method: string;
  readonly path: string;
  readonly params: Record<string, string>;
  readonly query: Record<string, string | string[] | undefined>;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body: unknown;
  readonly state: Record<string, unknown>;
  get(name: string): string | undefined;
}

/**
 * Guard function type.
 *
 * Guards determine if a request should proceed to the handler.
 * Return true to allow, false to reject, or throw an error for custom handling.
 */
export type GuardFn = (ctx: GuardContext) => boolean | Promise<boolean>;

/**
 * Interface for class-based guards with dependency injection support.
 *
 * Implement this interface to create guards that can be:
 * - Resolved from the DI container
 * - Injected with dependencies
 * - Unit tested with mock dependencies
 *
 * @example
 * ```typescript
 * import { Service } from '@nextrush/di';
 * import type { CanActivate, GuardContext } from '@nextrush/decorators';
 *
 * @Service()
 * class AuthGuard implements CanActivate {
 *   constructor(private authService: AuthService) {}
 *
 *   async canActivate(ctx: GuardContext): Promise<boolean> {
 *     const token = ctx.get('authorization');
 *     if (!token) return false;
 *
 *     const user = await this.authService.verify(token);
 *     ctx.state.user = user;
 *     return Boolean(user);
 *   }
 * }
 * ```
 */
export interface CanActivate {
  canActivate(ctx: GuardContext): boolean | Promise<boolean>;
}

/**
 * Guard type that can be either a function or a class implementing CanActivate.
 * Used by @UseGuard decorator to accept both patterns.
 */
export type Guard = GuardFn | Constructor<CanActivate>;

/**
 * Constructor type for class-based guards
 */
export type Constructor<T = unknown> = new (...args: unknown[]) => T;

/**
 * Type guard to check if a guard is a class (constructor) rather than a function.
 *
 * This checks if the guard has a prototype with the canActivate method defined,
 * which indicates it's a class implementing CanActivate rather than a function.
 */
export function isGuardClass(guard: Guard): guard is Constructor<CanActivate> {
  // Check if it's a function (both classes and functions are typeof 'function')
  if (typeof guard !== 'function') {
    return false;
  }

  // Check if it has a prototype with canActivate method
  // Arrow functions and regular functions won't have canActivate on their prototype
  const proto = guard.prototype;
  if (!proto || typeof proto !== 'object') {
    return false;
  }

  // Check if canActivate is defined on the prototype (class method)
  return typeof proto.canActivate === 'function';
}

/**
 * Guard metadata stored by @UseGuard decorator
 */
export interface GuardMetadata {
  /** Array of guards (can be functions or class constructors) */
  readonly guards: Guard[];

  /** Whether this is a class or method level guard */
  readonly target: 'class' | 'method';

  /** Method name (only for method-level guards) */
  readonly methodName?: string | symbol;
}

/**
 * Options for @Controller decorator
 */
export interface ControllerOptions {
  /** Base path prefix for all routes */
  path?: string;

  /** API version prefix (e.g., 'v1' → '/v1/users') */
  version?: string;

  /** Middleware to apply to all routes */
  middleware?: MiddlewareRef[];

  /** Tags for documentation grouping */
  tags?: string[];
}

/**
 * Options for route decorators (@Get, @Post, etc.)
 */
export interface RouteOptions {
  /** Route path (alternative to string argument) */
  path?: string;

  /** Route-specific middleware */
  middleware?: MiddlewareRef[];

  /** Response status code */
  statusCode?: number;

  /** Route description */
  description?: string;

  /** Mark route as deprecated */
  deprecated?: boolean;
}

/**
 * Options for @Body decorator
 */
export interface BodyOptions {
  /** Whether the body is required (default: true) */
  required?: boolean;

  /** Transform function to apply */
  transform?: TransformFn;
}

/**
 * Options for @Param decorator
 */
export interface ParamOptions {
  /** Whether the param is required (default: true) */
  required?: boolean;

  /** Default value if not provided */
  defaultValue?: unknown;

  /** Transform function (e.g., parseInt for numeric IDs) */
  transform?: TransformFn;
}

/**
 * Options for @Query decorator
 */
export interface QueryOptions {
  /** Whether the query param is required (default: false) */
  required?: boolean;

  /** Default value if not provided */
  defaultValue?: unknown;

  /** Transform function */
  transform?: TransformFn;
}

/**
 * Options for @Header decorator
 */
export interface HeaderOptions {
  /** Whether the header is required (default: false) */
  required?: boolean;

  /** Default value if not provided */
  defaultValue?: unknown;
}

/**
 * Metadata keys used for decorator storage
 */
export const DECORATOR_METADATA_KEYS = {
  CONTROLLER: Symbol.for('nextrush:controller'),
  ROUTES: Symbol.for('nextrush:routes'),
  PARAMS: Symbol.for('nextrush:params'),
  MIDDLEWARE: Symbol.for('nextrush:middleware'),
  GUARDS: Symbol.for('nextrush:guards'),
  INTERCEPTORS: Symbol.for('nextrush:interceptors'),
  RESPONSE_HEADERS: Symbol.for('nextrush:response-headers'),
  REDIRECT: Symbol.for('nextrush:redirect'),
} as const;

/**
 * Type guard to check if a value is a valid HTTP method
 */
export function isValidHttpMethod(method: string): method is RouteMethods {
  return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(method);
}

/**
 * Type guard to check if a value is a valid param source
 */
export function isValidParamSource(source: string): source is ParamSource {
  return ['body', 'query', 'param', 'header', 'ctx', 'req', 'res', 'custom'].includes(source);
}

/**
 * Custom parameter extractor function.
 *
 * Receives the context object and returns the extracted value.
 * Supports both sync and async extraction.
 */
export type CustomParamExtractor<T = unknown> =
  | ((ctx: import('@nextrush/types').Context) => T)
  | ((ctx: import('@nextrush/types').Context) => Promise<T>);

/**
 * Metadata for @SetHeader decorator — stored per method.
 */
export interface ResponseHeaderMetadata {
  readonly name: string;
  readonly value: string;
}

/**
 * Metadata for @Redirect decorator — stored per method.
 */
export interface RedirectMetadata {
  readonly url: string;
  readonly statusCode: number;
}
