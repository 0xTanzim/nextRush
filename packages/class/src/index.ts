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
  ControllerRouteMetadata,
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
  RouteMethods,
  RouteOptions,
  TransformFn,
} from './types.js';
// Re-exporting the deprecated alias itself (for the one-minor backward-compat window) is not a
// violation of the deprecation — the rule should only fire on NEW consumers of the old name.
// eslint-disable-next-line @typescript-eslint/no-deprecated
export type { RouteMetadata } from './types.js';

export {
  DECORATOR_METADATA_KEYS,
  isGuardClass,
  isValidHttpMethod,
  isValidParamSource,
} from './types.js';

// Service Lifecycle Hooks (duck-typed — no decorator)
export type { OnInit, OnShutdown } from './lifecycle/lifecycle-types.js';
export { isOnInit, isOnShutdown } from './lifecycle/lifecycle-types.js';

// Class Decorators
export { Controller } from './decorators/class.js';

// Module Decorator
export { Module, getModuleMetadata, isModule } from './modules/module.js';
export type {
  ModuleMetadata,
  ModuleOptions,
  ModuleProvider,
  ModuleProviderConfig,
} from './modules/module-types.js';

// Response Decorators
export { HttpCode } from './decorators/http-code.js';
export { Redirect, SetHeader } from './decorators/response-decorators.js';

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
} from './decorators/routes.js';

// Parameter Decorators
export { Body, Ctx, Header, Param, Query, Req, Res, createCustomParamDecorator } from './binding/params.js';

// Guard Decorators
export { UseGuard, getAllGuards, getClassGuards, getMethodGuards } from './guards/guards.js';

// Exception Filter Decorators
export {
  Catch,
  UseFilter,
  getAllFilters,
  getCatchTypes,
  getClassFilters,
  getMethodFilters,
} from './filters/filters.js';

// Interceptor Decorators
export {
  UseInterceptor,
  getAllInterceptors,
  getClassInterceptors,
  getMethodInterceptors,
} from './interceptors/interceptors.js';

// Metadata Readers
export type { ControllerDefinition } from './metadata/metadata.js';

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
} from './metadata/metadata.js';

// Internal reflection helpers (for DI use)
export { getConstructorParamTypes } from './reflection/reflection.js';

// ============================================
// CONTROLLERS: Auto-discovery & Registration
// ============================================

// Registration
export { registerControllers } from './registrar/registrar.js';

// Module registration
export { registerModule, type ModuleRegistrationOptions } from './modules/module-registrar.js';
export { collectModuleControllers, collectModuleGraph } from './modules/module-graph.js';

// Discovery
export {
    discoverControllers,
    getControllersFromResults,
    getErrorsFromResults
} from './discovery/discovery.js';

// Discovery Source (new)
export type { DiscoverySource } from './discovery/source.js';
export { FilesystemSource, MemorySource } from './discovery/source.js';

// Bootstrap Graph IR (RFC-NEXTRUSH-CLASS-CONSOLIDATION P3.4)
export type { ApplicationGraph } from './bootstrap/graph.js';

// Diagnostics (RFC-NEXTRUSH-CLASS-CONSOLIDATION P3.6)
export type {
  CircularDependency,
  DiagnosticsReport,
  DuplicateRoute,
  ProviderEntry,
  RouteEntry,
  TimingEntry,
} from './diagnostics/index.js';
export { getClassDiagnostics } from './diagnostics/get-diagnostics.js';

// Registry
export { ControllerRegistry } from './registrar/registry.js';

// Builder
export { buildRoutes } from './registrar/builder.js';

// Types
export type {
    BuiltRoute,
    ControllersOptions,
    DiscoveryOptions,
    DiscoveryResult,
    RegisteredController,
    ResolvedOptions
} from './registrar/registrar-types.js';

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
