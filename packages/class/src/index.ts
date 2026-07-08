/**
 * @nextrush/class
 *
 * Unified class-based API for NextRush — decorators, DI, and controller registration.
 * Merges the former @nextrush/decorators and @nextrush/controllers into one cohesive package.
 *
 * @packageDocumentation
 */

// Canonical reflect-metadata load for the package. Decorator metadata (route,
// param, and DI reflection) depends on this side-effect import being evaluated
// before any decorated class is defined; keeping it at the entry point avoids
// scattering the same import across internal modules.
import 'reflect-metadata';

// ============================================
// DECORATORS: Controller, Routes, Parameters
// ============================================

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

// Service Lifecycle Hooks (duck-typed — no decorator)
export type { OnInit, OnShutdown } from './lifecycle-types.js';
export { isOnInit, isOnShutdown } from './lifecycle-types.js';

// Class Decorators
export { Controller } from './class.js';

// Module Decorator
export { Module, getModuleMetadata, isModule } from './module.js';
export type {
  ModuleMetadata,
  ModuleOptions,
  ModuleProvider,
  ModuleProviderConfig,
} from './module-types.js';

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

// Internal reflection helpers (for DI use)
export { getConstructorParamTypes } from './reflection.js';

// ============================================
// CONTROLLERS: Auto-discovery & Registration
// ============================================

// Registration
export { registerControllers } from './registrar.js';

// Module registration
export { registerModule, type ModuleRegistrationOptions } from './module-registrar.js';
export { collectModuleControllers, collectModuleGraph } from './module-graph.js';

// Discovery
export {
    discoverControllers,
    getControllersFromResults,
    getErrorsFromResults
} from './discovery.js';

// Discovery Source (new)
export type { DiscoverySource, ClassRef } from './discovery/source.js';
export { FilesystemSource, MemorySource } from './discovery/source.js';

// Bootstrap (new)
export type { BootstrapContext, ResolvedBootstrapOptions } from './bootstrap/context.js';
export { bootstrapPipeline } from './bootstrap/pipeline.js';

// Registry
export { ControllerRegistry } from './registry.js';

// Builder
export { buildRoutes } from './builder.js';

// Types
export type {
    BuiltRoute,
    ControllersOptions,
    DiscoveryOptions,
    DiscoveryResult,
    RegisteredController,
    ResolvedOptions
} from './registrar-types.js';

// Errors
export {
    ControllerError,
    ControllerResolutionError,
    DiscoveryError,
    GuardRejectionError,
    HttpError,
    MissingParameterError,
    NoRoutesError,
    NotAControllerError,
    NotAModuleError,
    ParameterInjectionError,
    RouteRegistrationError
} from './errors.js';

// ============================================
// DI: Re-exports from @nextrush/di
// ============================================

export {
    Repository,
    Service,
    container,
    createContainer,
    inject,
    type Container
} from '@nextrush/di';
