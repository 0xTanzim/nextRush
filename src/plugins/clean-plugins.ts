/**
 * 🔌 NextRush Plugins - Clean Plugin System
 *
 * Following copilot instructions - all features implemented as plugins
 * inheriting from BasePlugin. Eliminates components architecture.
 */

// ============================================================================
// 🎯 CORE PLUGIN SYSTEM
// ============================================================================

export { BasePlugin } from './core/base-plugin';
export type { PluginRegistry } from './core/base-plugin';

// ============================================================================
// 🎯 PLUGIN IMPLEMENTATIONS
// ============================================================================

export { AuthPlugin } from './auth/auth.plugin';
export { BodyParserPlugin } from './body-parser/body-parser-v2.plugin';
export { EventDrivenPlugin } from './core/event-driven.plugin';
export { CorsPlugin } from './cors/cors.plugin';
export { LoggerPlugin } from './logger/logger.plugin';
export { MetricsPlugin } from './metrics/metrics.plugin';
export { MiddlewarePlugin } from './middleware/middleware.plugin';
export { ValidationPlugin } from './middleware/validation.plugin';
export { RateLimiterPlugin } from './rate-limiter/rate-limiter.plugin';
export { RouterPlugin } from './router/router.plugin';
export { StaticFilesPlugin } from './static-files/static-files.plugin';
export { TemplatePlugin } from './template/template.plugin';
export { WebSocketPlugin } from './websocket/websocket.plugin';

// ============================================================================
// 🎯 PLUGIN CREATION HELPER
// ============================================================================

import { AuthPlugin } from './auth/auth.plugin';
import { BodyParserPlugin } from './body-parser/body-parser-v2.plugin';
import type { PluginRegistry } from './core/base-plugin';
import { EventDrivenPlugin } from './core/event-driven.plugin';
import { CorsPlugin } from './cors/cors.plugin';
import { LoggerPlugin } from './logger/logger.plugin';
import { MetricsPlugin } from './metrics/metrics.plugin';
import { MiddlewarePlugin } from './middleware/middleware.plugin';
import { ValidationPlugin } from './middleware/validation.plugin';
import { RateLimiterPlugin } from './rate-limiter/rate-limiter.plugin';
import { RouterPlugin } from './router/router.plugin';
import { StaticFilesPlugin } from './static-files/static-files.plugin';
import { TemplatePlugin } from './template/template.plugin';
import { WebSocketPlugin } from './websocket/websocket.plugin';

/**
 * Create all core plugins for NextRush
 */
export function createCorePlugins(registry: PluginRegistry) {
  return [
    new RouterPlugin(registry), // Core routing capabilities
    new MiddlewarePlugin(registry), // Middleware support
    new BodyParserPlugin(registry), // Body parsing
    new StaticFilesPlugin(registry), // Static file serving
    new LoggerPlugin(registry), // Logging system
    new MetricsPlugin(registry), // Metrics & monitoring
    new ValidationPlugin(registry), // Input validation & XSS protection
    new TemplatePlugin(registry), // Template engine plugin
    new WebSocketPlugin(registry), // WebSocket support
    new AuthPlugin(registry), // Authentication & authorization
    new CorsPlugin(registry), // CORS support
    new RateLimiterPlugin(registry), // Rate limiting
    new EventDrivenPlugin(registry), // Event-driven architecture
  ];
}

/**
 * Plugin names for reference
 */
export const PLUGIN_NAMES = {
  ROUTER: 'Router',
  MIDDLEWARE: 'Middleware',
  BODY_PARSER: 'BodyParser',
  STATIC_FILES: 'StaticFiles',
  LOGGER: 'Logger',
  METRICS: 'Metrics',
  VALIDATION: 'Validation',
  TEMPLATE: 'Template',
  WEBSOCKET: 'WebSocket',
  AUTH: 'Auth',
  CORS: 'CORS',
  RATE_LIMITER: 'RateLimiter',
  EVENT_DRIVEN: 'EventDriven',
  API_DOCS: 'ApiDocumentation',
} as const;
