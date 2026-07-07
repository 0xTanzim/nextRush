/**
 * @nextrush/controllers
 *
 * Controller registrar for NextRush — automatic discovery, DI integration,
 * and route registration for decorator-based controllers.
 *
 * @packageDocumentation
 */

// Registration
export { registerControllers, registerController } from './registrar.js';

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
    Delete,
    Get,
    Header,
    Param,
    Patch,
    Post,
    Put,
    Query,
    UseGuard
} from '@nextrush/decorators';
export type { GuardContext, GuardFn } from '@nextrush/decorators';
export {
    Repository,
    Service,
    container,
    createContainer,
    inject,
    type Container
} from '@nextrush/di';
