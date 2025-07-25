/**
 * 🔌 NextRush Plugins - Enhanced Plugin System
 *
 * Following copilot instructions - all features implemented as plugins
 * inheriting from BasePlugin. Includes new enhanced features.
 */

// ============================================================================
// 🎯 CORE PLUGIN SYSTEM
// ============================================================================

export { BasePlugin } from './core/base-plugin';
export type { PluginRegistry } from './core/base-plugin';

// Event-driven architecture
export { EventDrivenPlugin } from './core/event-driven.plugin';

// ============================================================================
// 🎯 ENHANCED PLUGIN IMPLEMENTATIONS
// ============================================================================

// Core plugins
export { BodyParserPlugin } from './body-parser/body-parser-v2.plugin';
export { LoggerPlugin } from './logger/logger.plugin';
export { MiddlewarePlugin } from './middleware/middleware.plugin';
export { ValidationPlugin } from './middleware/validation.plugin';
export { RouterPlugin } from './router/router.plugin';
export { StaticFilesPlugin } from './static-files/static-files.plugin';
export { WebSocketPlugin } from './websocket/websocket.plugin';

export { AuthPlugin } from './auth/auth.plugin';
export { CorsPlugin } from './cors/cors.plugin';
export { MetricsPlugin } from './metrics/metrics.plugin';
export { RateLimiterPlugin } from './rate-limiter/rate-limiter.plugin';

// Enhanced types
export type {
  SanitizationOptions,
  ValidationResult,
  ValidationRule,
  ValidationSchema,
} from './middleware/validation.plugin';

export type {
  StaticOptions as EnhancedStaticOptions,
  StaticOptions,
} from './static-files/types';

// 🚀 NEW PLUGIN TYPES
export type {
  RateLimiterData,
  RateLimiterOptions,
  RateLimiterStore,
} from './rate-limiter/rate-limiter.plugin';

export type { CorsOptions } from './cors/cors.plugin';

export type {
  JwtOptions,
  Permission,
  Role,
  SessionOptions,
  User,
} from './auth/auth.plugin';

export type {
  CustomMetric,
  HealthCheckFunction,
  HealthCheckResult,
  HealthStatus,
  MetricsOptions,
  MetricValue,
  RequestMetrics,
  SystemMetrics,
} from './metrics/interfaces';

// Presets and helpers

export { CommonRoles } from './auth/auth.plugin';
export { CorsPresets } from './cors/cors.plugin';

// ============================================================================
// 🎯 PLUGIN CREATION HELPER
// ============================================================================

import { AuthPlugin } from './auth/auth.plugin';
import { BodyParserPlugin } from './body-parser/body-parser-v2.plugin';
import type { PluginRegistry } from './core/base-plugin';
import { EventDrivenPlugin } from './core/event-driven.plugin';
import { CorsPlugin } from './cors/cors.plugin';
import { MetricsPlugin } from './metrics/metrics.plugin';
import { MiddlewarePlugin } from './middleware/middleware.plugin';
import { ValidationPlugin } from './middleware/validation.plugin';
import { RateLimiterPlugin } from './rate-limiter/rate-limiter.plugin';
import { RouterPlugin } from './router/router.plugin';
import { StaticFilesPlugin } from './static-files/static-files.plugin';
import { WebSocketPlugin } from './websocket/websocket.plugin';

/**
 * Create all core plugins for NextRush
 */
export function createCorePlugins(registry: PluginRegistry) {
  return [
    new RouterPlugin(registry),
    new StaticFilesPlugin(registry),
    new MiddlewarePlugin(registry),
    new ValidationPlugin(registry),
    new EventDrivenPlugin(registry),
    new BodyParserPlugin(registry),
    new WebSocketPlugin(registry),
  ];
}

/**
 * Create all enhanced plugins for NextRush (including new features)
 */
export function createEnhancedPlugins(registry: PluginRegistry) {
  return [
    ...createCorePlugins(registry),
    new RateLimiterPlugin(registry),
    new CorsPlugin(registry),
    new AuthPlugin(registry),
    new MetricsPlugin(registry),
  ];
}

/**
 * Plugin names for reference
 */
export const PLUGIN_NAMES = {
  ROUTER: 'Router',
  STATIC_FILES: 'StaticFiles',
  MIDDLEWARE: 'Middleware',
  VALIDATION: 'Validation',
  BODY_PARSER: 'BodyParser',
  WEBSOCKET: 'WebSocket',
  EVENT_DRIVEN: 'EventDriven',
  // New feature plugins
  RATE_LIMITER: 'RateLimiter',
  CORS: 'CORS',
  AUTH: 'Auth',
  METRICS: 'Metrics',
  API_DOCS: 'ApiDocumentation',
} as const;
