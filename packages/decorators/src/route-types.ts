/**
 * @nextrush/decorators - Route Type Definitions
 *
 * Metadata and options shapes for route decorators (@Get, @Post, etc.) and the
 * response-shaping decorators (@SetHeader, @Redirect).
 */

import type { HttpMethod } from '@nextrush/types';

import type { MiddlewareRef } from './controller-types.js';

/**
 * Supported HTTP methods for route decorators
 */
export type RouteMethods = Extract<
  HttpMethod,
  'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
>;

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
