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
import { Router } from './routing/router';
import type { RouterOptions } from './types/routing';

/**
 * Create a new NextRush application with full type safety
 */
export function createApp(options: ApplicationOptions = {}): Application {
  return new Application(options);
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
export { StaticFilesPlugin, type ProfessionalStaticOptions } from './plugins';

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
  HealthStatus,
  MetricsOptions,
  RequestMetrics,
  SystemMetrics,
} from './plugins/metrics/metrics.plugin';

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
