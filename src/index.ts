/**
 * 🚀 NextRush Framework - Modern Express.js Alternative
 * 
 * Entry point for the NextRush framework with complete type safety,
 * smart routing, proper overloads, and zero 'any' usage.
 * 
 * Features:
 * - Full HTTP method overloads for middleware combinations
 * - Smart routing with createRoute functionality  
 * - Express.js compatibility with enhanced type safety
 * - Plugin-based architecture for extensibility
 */

// ============================================================================
// 🎯 MAIN APPLICATION EXPORT
// ============================================================================

export { Application } from './core/app/application';
export type { ApplicationOptions, RouteDefinition, StaticOptions } from './core/app/application';

// ============================================================================
// 🎯 CREATE APP FACTORY FUNCTION
// ============================================================================

import { Application, ApplicationOptions } from './core/app/application';

/**
 * Create a new NextRush application with full type safety
 */
export function createApp(options: ApplicationOptions = {}): Application {
  return new Application(options);
}

// ============================================================================
// 🎯 ROUTER EXPORTS
// ============================================================================

export { Router } from './routing/router';
export type { RouterOptions } from './types/routing';
import { Router } from './routing/router';
import type { RouterOptions } from './types/routing';

/**
 * Create a new router instance
 */
export function createRouter(options?: RouterOptions): Router {
  return new Router(options);
}

// ============================================================================
// 🎯 TYPE EXPORTS - COMPREHENSIVE TYPE SYSTEM
// ============================================================================

// Express-style types (familiar API)
export type {
  NextRushRequest,
  NextRushResponse,
  ExpressHandler,
  ExpressMiddleware
} from './types/express';

// Context-style types
export type {
  RequestContext,
  RouteHandler,
  MiddlewareHandler,
  HttpMethod,
  Path,
  Route
} from './types/routing';

// HTTP types
export type {
  ParsedRequest,
  ParsedResponse
} from './types/http';

// ============================================================================
// 🎯 COMPONENT EXPORTS
// ============================================================================

export { BaseComponent } from './core/app/base-component';

// Component types
export type { Lifecycle } from './core/types/interfaces';

// ============================================================================
// 🎯 ERROR HANDLING EXPORTS
// ============================================================================

export { ErrorHandler } from './errors/error-handler';
export {
  NextRushError,
  NotFoundError,
  MethodNotAllowedError,
  ValidationError,
  InternalServerError
} from './errors/custom-errors';

// ============================================================================
// 🎯 UTILITY EXPORTS
// ============================================================================

export { compose, pipe, curry, debounce, throttle } from './utils/built-in';

// ============================================================================
// 🎯 MIDDLEWARE EXPORTS  
// ============================================================================

// Middleware utilities
export { composeMiddleware } from './utils/compose';

// Default export for convenience
export default Application;
