/**
 * @nextrush/decorators
 *
 * Decorator-based metadata for building HTTP controllers.
 * Provides @Controller, route decorators, and parameter decorators.
 *
 * @packageDocumentation
 */

// Types
export type {
  BodyOptions, ControllerMetadata, ControllerOptions, HeaderOptions, MiddlewareRef, ParamMetadata, ParamOptions, ParamSource, QueryOptions, RouteMetadata, RouteMethods, RouteOptions, TransformFn
} from './types.js';

export { DECORATOR_METADATA_KEYS, isValidHttpMethod, isValidParamSource } from './types.js';

// Class Decorators
export { Controller } from './class.js';

// Route Decorators
export { All, Delete, Get, Head, Options, Patch, Post, Put } from './routes.js';

// Parameter Decorators
export { Body, Ctx, Header, Param, Query, Req, Res } from './params.js';

// Metadata Readers
export type { ControllerDefinition } from './metadata.js';

export {
  buildFullPath, getAllParamMetadata,
  getControllerDefinition, getControllerMetadata, getMethodParameterTypes,
  getMethodReturnType, getParamMetadata, getRouteMetadata, isController
} from './metadata.js';
