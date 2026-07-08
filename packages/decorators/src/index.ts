/**
 * @nextrush/decorators
 *
 * @deprecated Import from '@nextrush/class' instead.
 * This package is a compatibility shim and will be removed in a future major version.
 *
 * @packageDocumentation
 */

// Backward-compatibility re-exports from @nextrush/class
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
} from '@nextrush/class';

export {
  DECORATOR_METADATA_KEYS,
  isGuardClass,
  isValidHttpMethod,
  isValidParamSource,
} from '@nextrush/class';

// Service Lifecycle Hooks
export type { OnInit, OnShutdown } from '@nextrush/class';
export { isOnInit, isOnShutdown } from '@nextrush/class';

// Class Decorators
export { Controller } from '@nextrush/class';

// Module Decorator
export { Module, getModuleMetadata, isModule } from '@nextrush/class';
export type {
  ModuleMetadata,
  ModuleOptions,
  ModuleProvider,
  ModuleProviderConfig,
} from '@nextrush/class';

// Response Decorators
export { HttpCode } from '@nextrush/class';
export { Redirect, SetHeader } from '@nextrush/class';

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
} from '@nextrush/class';

// Parameter Decorators
export { Body, Ctx, Header, Param, Query, Req, Res, createCustomParamDecorator } from '@nextrush/class';

// Guard Decorators
export { UseGuard, getAllGuards, getClassGuards, getMethodGuards } from '@nextrush/class';

// Exception Filter Decorators
export {
  Catch,
  UseFilter,
  getAllFilters,
  getCatchTypes,
  getClassFilters,
  getMethodFilters,
} from '@nextrush/class';

// Interceptor Decorators
export {
  UseInterceptor,
  getAllInterceptors,
  getClassInterceptors,
  getMethodInterceptors,
} from '@nextrush/class';

// Metadata Readers
export type { ControllerDefinition } from '@nextrush/class';
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
} from '@nextrush/class';

// Internal reflection helpers
export { getConstructorParamTypes } from '@nextrush/class';
