/**
 * @nextrush/controllers
 *
 * Controller plugin for NextRush - automatic discovery, DI integration,
 * and route registration for decorator-based controllers.
 *
 * @packageDocumentation
 */

// Plugin
export { ControllersPlugin, controllersPlugin, registerController } from './plugin.js';

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
    ControllersPluginOptions,
    ControllersPluginState,
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
    Query
} from '@nextrush/decorators';
export {
    Repository,
    Service,
    container,
    createContainer,
    inject,
    type ContainerInterface
} from '@nextrush/di';
