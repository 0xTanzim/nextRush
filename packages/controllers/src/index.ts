/**
 * @nextrush/controllers
 *
 * @deprecated Import from '@nextrush/class' instead.
 * This package is a compatibility shim and will be removed in a future major version.
 *
 * @packageDocumentation
 */

// Canonical reflect-metadata load for back-compat
import 'reflect-metadata';

// Backward-compatibility re-exports from @nextrush/class

// Registration
export { registerControllers } from '@nextrush/class';

// Module registration
export { registerModule, type ModuleRegistrationOptions } from '@nextrush/class';
export { collectModuleControllers, collectModuleGraph } from '@nextrush/class';

// Discovery
export {
    discoverControllers,
    getControllersFromResults,
    getErrorsFromResults
} from '@nextrush/class';

// Registry
export { ControllerRegistry } from '@nextrush/class';

// Builder
export { buildRoutes } from '@nextrush/class';

// Types
export type {
    BuiltRoute,
    ControllersOptions,
    DiscoveryOptions,
    DiscoveryResult,
    RegisteredController,
    ResolvedOptions
} from '@nextrush/class';

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
} from '@nextrush/class';

// Re-export commonly used items from dependencies (for back-compat)
export {
    Body,
    Controller,
    Ctx,
    Catch,
    Delete,
    Get,
    Header,
    Module,
    Param,
    Patch,
    Post,
    Put,
    Query,
    UseFilter,
    UseGuard,
    UseInterceptor
} from '@nextrush/class';
export type { ExceptionFilter, GuardContext, GuardFn, Interceptor, ModuleOptions, ModuleProvider, ModuleProviderConfig, OnInit, OnShutdown } from '@nextrush/class';
export { getModuleMetadata, isModule, isOnInit, isOnShutdown } from '@nextrush/class';
export {
    Repository,
    Service,
    container,
    createContainer,
    inject,
    type Container
} from '@nextrush/di';
