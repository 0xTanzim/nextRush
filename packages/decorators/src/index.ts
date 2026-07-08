/**
 * @nextrush/decorators
 *
 * Decorator-based metadata for building HTTP controllers.
 * Provides @Controller, route decorators, and parameter decorators.
 *
 * @packageDocumentation
 */

// reflect-metadata polyfill — loaded once at the package entry point so every decorator
// (applied in consumer code reached via this barrel) has Reflect.defineMetadata available.
import 'reflect-metadata';

// Types
export type {
  BodyOptions,
  CanActivate,
  Constructor,
  ControllerMetadata,
  ControllerOptions,
  CustomParamExtractor,
  ExceptionFilter,
  ExceptionFilterClass,
  FilterMetadata,
  Guard,
  GuardContext,
  GuardFn,
  GuardMetadata,
  HeaderOptions,
  Interceptor,
  InterceptorClass,
  InterceptorMetadata,
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

// Response Decorators
export { HttpCode } from './http-code.js';
export { Redirect, SetHeader } from './response-decorators.js';

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
} from './routes.js';

// Parameter Decorators
export { Body, Ctx, Header, Param, Query, Req, Res, createCustomParamDecorator } from './params.js';

// Guard Decorators
export { UseGuard, getAllGuards, getClassGuards, getMethodGuards } from './guards.js';

// Exception Filter Decorators
export {
  Catch,
  UseFilter,
  getAllFilters,
  getCatchTypes,
  getClassFilters,
  getMethodFilters,
} from './filters.js';

// Interceptor Decorators
export {
  UseInterceptor,
  getAllInterceptors,
  getClassInterceptors,
  getMethodInterceptors,
} from './interceptors.js';

// Metadata Readers
export type { ControllerDefinition } from './metadata.js';

export {
  getAllParamMetadata,
  getControllerDefinition,
  getControllerMetadata,
  getHttpCode,
  getParamMetadata,
  getRedirectMetadata,
  getResponseHeaders,
  getRouteMetadata,
  isController,
} from './metadata.js';
