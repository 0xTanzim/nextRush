/**
 * @nextrush/controllers
 *
 * Controller registrar for NextRush — automatic discovery, DI integration,
 * and route registration for decorator-based controllers.
 *
 * @packageDocumentation
 */

// Canonical reflect-metadata load for the package. Decorator metadata (route,
// param, and DI reflection) depends on this side-effect import being evaluated
// before any decorated class is defined; keeping it at the entry point avoids
// scattering the same import across internal modules.
import 'reflect-metadata';

// Registration
export { registerControllers } from './registrar.js';

// Discovery
export {
    discoverControllers,
    getControllersFromResults,
    getErrorsFromResults
} from './discovery.js';

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
} from './types.js';

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
    ParameterInjectionError,
    RouteRegistrationError
} from './errors.js';

// Re-export commonly used items from dependencies
export {
    Body,
    Controller,
    Ctx,
    Catch,
    Delete,
    Get,
    Header,
    Param,
    Patch,
    Post,
    Put,
    Query,
    UseFilter,
    UseGuard,
    UseInterceptor
} from '@nextrush/decorators';
export type { ExceptionFilter, GuardContext, GuardFn, Interceptor } from '@nextrush/decorators';
export {
    Repository,
    Service,
    container,
    createContainer,
    inject,
    type Container
} from '@nextrush/di';
