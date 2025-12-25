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
export type RouteMethods = Extract<HttpMethod, 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'>;

/**
 * Parameter source types for parameter decorators
 */
export type ParamSource = 'body' | 'query' | 'param' | 'header' | 'ctx' | 'req' | 'res';

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
}

/**
 * Transform function for parameter value transformation
 */
export type TransformFn<TInput = unknown, TOutput = unknown> = (value: TInput) => TOutput;

/**
 * Reference to middleware - can be a class token or function
 */
export type MiddlewareRef = symbol | string | ((...args: unknown[]) => unknown);

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
  return ['body', 'query', 'param', 'header', 'ctx', 'req', 'res'].includes(source);
}
