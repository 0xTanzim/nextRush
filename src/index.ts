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
 * - 🔌 UNIFIED PLUGIN ARCHITECTURE following copilot instructions
 * - All features implemented as plugins inheriting from BasePlugin
 * - Components architecture ELIMINATED per copilot instructions
 */

// ============================================================================
// 🎯 MAIN APPLICATION EXPORT
// ============================================================================

export { Application } from './core/app/application';
export type {
  ApplicationOptions,
  RouteDefinition,
  StaticOptions,
} from './core/app/application';

// ============================================================================
// 🎯 CREATE APP FACTORY FUNCTION
// ============================================================================

import { Application, ApplicationOptions } from './core/app/application';
import { Router } from './routing/router';
import type { RouterOptions } from './types/routing';

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

/**
 * Create a new router instance
 */
export function createRouter(options?: RouterOptions): Router {
  return new Router(options);
}

// ============================================================================
// 🎯 MIDDLEWARE EXPORTS - EXPRESS-LIKE DX
// ============================================================================

// Middleware composition functions
export {
  compose,
  group,
  named,
  unless,
  when,
} from './plugins/middleware/composition';

// ============================================================================
// 🎯 TYPE EXPORTS - COMPREHENSIVE TYPE SYSTEM
// ============================================================================

// Express-style types (familiar API)
export type {
  ExpressHandler,
  ExpressMiddleware,
  NextRushRequest,
  NextRushResponse,
} from './types/express';

// Context-style types
export type {
  HttpMethod,
  MiddlewareHandler,
  Path,
  RequestContext,
  Route,
  RouteHandler,
} from './types/routing';

// HTTP types
export type { ParsedRequest, ParsedResponse } from './types/http';

// ============================================================================
// 🎯 COMPONENT EXPORTS
// ============================================================================

export { BaseComponent } from './core/app/base-component';

// Component types
export type { Lifecycle } from './core/types/interfaces';

// ============================================================================
// 🎯 ERROR HANDLING EXPORTS
// ============================================================================

export {
  InternalServerError,
  MethodNotAllowedError,
  NextRushError,
  NotFoundError,
  ValidationError,
} from './errors/custom-errors';
export { ErrorHandler } from './errors/error-handler';

// ============================================================================
// 🎯 MIDDLEWARE EXPORTS
// ============================================================================

// Built-in middleware functions
export {
  compression,
  cors,
  helmet,
  logger,
  rateLimit,
  requestId,
  requestTimer,
} from './plugins/middleware/built-in';

// Middleware presets
export {
  apiPreset,
  developmentPreset,
  fullFeaturedPreset,
  getPreset,
  minimalPreset,
  productionPreset,
  securityPreset,
} from './plugins/middleware/presets';

// Default export for convenience
export default Application;
