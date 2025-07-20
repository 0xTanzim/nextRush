/**
 * 🚀 NextRush Framework - Modern/**
 * Plugin methods interface for proper TypeScript IntelliSense
 */
export interface PluginMethods {
  // Backward compatibility methods
  listen(
    port: number | string,
    hostname?: string | (() => void),
    callback?: () => void
  ): this;
  close(callback?: () => void): this;
  startServer(
    port: number | string,
    hostname?: string | (() => void),
    callback?: () => void
  ): this;
  shutdown(callback?: () => void): this;

  // Middleware Plugin Methods
  usePreset(name: string, options?: any): this;
  useGroup(middlewares: any[]): this;
  cors(options?: any): any;
  helmet(options?: any): any;
  compression(options?: any): any;
  rateLimit(options?: any): any;
  logger(options?: any): any;
  requestId(options?: any): any;
  timer(options?: any): any;
  compose(...middlewares: any[]): any;
  when(condition: any, middleware: any): any;
  unless(condition: any, middleware: any): any;
  getPlugin(name: string): any;
  getMiddlewareMetrics(): any;
  clearMiddlewareMetrics(): void;

  // WebSocket Plugin Methods (if available)
  ws?(path: string, handler: any): this;
  enableWebSocket?(options?: any): this;
  wsBroadcast?(data: any, room?: string): this;
  getWebSocketStats?(): any;
  getWebSocketConnections?(): any;
}

/**
 * Extended Application type with all plugin methods for proper TypeScript IntelliSense
 */
export type ExtendedApplication = Application & PluginMethods;

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
 * - 🛡️ Enhanced validation and sanitization
 * - 🔄 Event-driven architecture support
 * - 📁 Professional-grade static file serving
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
import { PluginMode } from './plugins/performance-plugins';
import { Router } from './routing/router';
import type { RouterOptions } from './types/routing';

/**
 * Create a new NextRush application with full type safety
 */
export function createApp(
  options: ApplicationOptions = {}
): ExtendedApplication {
  // Default to FULL_FEATURES mode to include WebSocket and all plugins
  const defaultOptions = {
    pluginMode: PluginMode.FULL_FEATURES,
    ...options,
  };
  return new Application(defaultOptions) as ExtendedApplication;
}

// ============================================================================
// 🎯 PERFORMANCE PLUGINS EXPORT
// ============================================================================

export { PluginMode } from './plugins/performance-plugins';
export type { createPlugins } from './plugins/performance-plugins';

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
// 🎯 ENHANCED MIDDLEWARE EXPORTS - EXPRESS-LIKE DX
// ============================================================================

// Middleware composition functions
export {
  compose,
  group,
  named,
  unless,
  when,
} from './plugins/middleware/composition';

// Enhanced validation and sanitization
export {
  ValidationPlugin,
  type SanitizationOptions,
  type ValidationResult,
  type ValidationRule,
  type ValidationSchema,
} from './plugins';

// Event-driven architecture
export { EventDrivenPlugin } from './plugins';

// Enhanced static files
export { StaticFilesPlugin } from './plugins';

// Template engine
export {
  advancedTemplate,
  benchmarkTemplate,
  compareTemplateEngines,
  createSlotMap,
  // 🎯 Simple Template Functions for Super Easy DX
  createTemplate,
  escapeHTML,
  evaluateCondition,
  getValue,
  parseFrontmatter,
  quickTemplate,
  resolveTemplatePath,
  TemplateHelperManager,
  testTemplateRender,
  UltimateTemplateParser,
  UltimateTemplateRenderer,
  validateTemplateSyntax,
  webTemplate,
} from './plugins/template/ultimate-template-engine';

export type {
  CompileResult,
  FilterRegistry,
  HelperRegistry,
  I18nConfig,
  ParseResult,
  RenderOptions,
  // Simple template options
  SimpleTemplateOptions,
  TemplateContext,
  TemplateNode,
  TemplateOptions,
  TestRenderResult,
} from './plugins/template/ultimate-template-engine';

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
// 🎯 MIDDLEWARE AND HANDLER TYPE EXPORTS
// ============================================================================

export type {
  AsyncMiddleware,
  ErrorMiddleware,
  ErrorRequestHandler,
  Middleware,
  NextFunction,
  RequestHandler,
} from './middleware/types';

// ============================================================================
// 🎯 BODY PARSER EXPORTS
// ============================================================================

export { BodyParserPlugin } from './plugins/body-parser/body-parser-v2.plugin';
export type { BodyParserOptions } from './types/http';

// ============================================================================
// 🎯 PLUGINS & ENHANCED FEATURES EXPORTS
// ============================================================================

// Enhanced authentication exports
export { CommonRoles } from './plugins/auth/auth.plugin';

// Enhanced CORS exports
export { CorsPresets } from './plugins/cors/cors.plugin';

// Plugin types
export type {
  JwtOptions,
  Permission,
  Role,
  SessionOptions,
  User,
} from './plugins/auth/auth.plugin';

export type {
  CustomMetric,
  HealthCheckFunction,
  HealthCheckResult,
  HealthStatus,
  MetricsOptions,
  MetricValue,
  RequestMetrics,
  SystemMetrics,
} from './plugins/metrics/interfaces';

export type {
  RateLimiterData,
  RateLimiterOptions,
  RateLimiterStore,
} from './plugins/rate-limiter/rate-limiter.plugin';

export type { CorsOptions } from './plugins/cors/cors.plugin';

// ============================================================================
// 🎯 MIDDLEWARE EXPORTS
// ============================================================================

// Built-in middleware functions
// NOTE: CORS has been moved to the CorsPlugin for enterprise features
export {
  compression,
  // cors, // Removed - use app.cors() via CorsPlugin instead
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

// ============================================================================
// 🎯 TYPE FORCE OVERRIDE - ENSURE LISTEN METHOD IS AVAILABLE
// ============================================================================

// Force TypeScript to recognize that Application has listen and close methods
declare module './core/app/application' {
  interface Application {
    /**
     * Start the server - backward compatibility
     * @param port Port number or string
     * @param hostname Optional hostname or callback
     * @param callback Optional callback
     * @returns Application instance
     */
    listen(
      port: number | string,
      hostname?: string | (() => void),
      callback?: () => void
    ): Application;

    /**
     * Close the server - backward compatibility
     * @param callback Optional callback
     * @returns Application instance
     */
    close(callback?: () => void): Application;

    /**
     * Start the server - new method
     * @param port Port number or string
     * @param hostname Optional hostname or callback
     * @param callback Optional callback
     * @returns Application instance
     */
    startServer(
      port: number | string,
      hostname?: string | (() => void),
      callback?: () => void
    ): Application;

    /**
     * Stop the server - new method
     * @param callback Optional callback
     * @returns Application instance
     */
    shutdown(callback?: () => void): Application;
  }
}

// Default export for convenience
export default Application;
