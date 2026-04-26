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
  BodyOptions,
  CanActivate,
  Constructor,
  ControllerMetadata,
  ControllerOptions,
  CustomParamExtractor,
  Guard,
  GuardContext,
  GuardFn,
  GuardMetadata,
  HeaderOptions,
  MiddlewareRef,
  ParamMetadata,
  ParamOptions,
  ParamSource,
  QueryOptions,
  RedirectMetadata,
  ResponseHeaderMetadata,
  RouteMetadata,
  RouteMethods,
  RouteOptions,
  TransformFn,
} from './types.js';

export {
  DECORATOR_METADATA_KEYS,
  isGuardClass,
  isValidHttpMethod,
  isValidParamSource,
} from './types.js';

// Class Decorators
export { Controller } from './class.js';

// Route Decorators
export {
  All,
  Delete,
  Get,
  Head,
  Options,
  Patch,
  Post,
  Put,
  Redirect,
  SetHeader,
} from './routes.js';

// Parameter Decorators
export { Body, Ctx, Header, Param, Query, Req, Res, createCustomParamDecorator } from './params.js';

// Guard Decorators
export { UseGuard, getAllGuards, getClassGuards, getMethodGuards } from './guards.js';

// Metadata Readers
export type { ControllerDefinition } from './metadata.js';

export {
  buildFullPath,
  getAllParamMetadata,
  getControllerDefinition,
  getControllerMetadata,
  getMethodParameterTypes,
  getMethodReturnType,
  getParamMetadata,
  getRedirectMetadata,
  getResponseHeaders,
  getRouteMetadata,
  isController,
} from './metadata.js';
