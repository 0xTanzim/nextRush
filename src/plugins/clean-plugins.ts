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

export { MiddlewarePlugin } from './middleware/middleware.plugin';
export { RouterPlugin } from './router/router.plugin';
export { ProfessionalStaticPlugin as StaticFilesPlugin } from './static-files/static-files.plugin';
export { TemplatePlugin } from './template/template.plugin';
export { WebSocketPlugin } from './websocket/websocket.plugin';
export { AuthPlugin } from './auth/auth.plugin';
export { MetricsPlugin } from './metrics/metrics.plugin';
export { CorsPlugin } from './cors/cors.plugin';
export { RateLimiterPlugin } from './rate-limiter/rate-limiter.plugin';
export { BodyParserPlugin } from './body-parser/body-parser.plugin';
export { ValidationPlugin } from './middleware/validation.plugin';
export { EventDrivenPlugin } from './core/event-driven.plugin';

// ============================================================================
// 🎯 PLUGIN CREATION HELPER
// ============================================================================

import type { PluginRegistry } from './core/base-plugin';
import { MiddlewarePlugin } from './middleware/middleware.plugin';
import { RouterPlugin } from './router/router.plugin';
import { ProfessionalStaticPlugin as StaticFilesPlugin } from './static-files/static-files.plugin';
import { TemplatePlugin } from './template/template.plugin';
import { WebSocketPlugin } from './websocket/websocket.plugin';
import { AuthPlugin } from './auth/auth.plugin';
import { MetricsPlugin } from './metrics/metrics.plugin';
import { CorsPlugin } from './cors/cors.plugin';
import { RateLimiterPlugin } from './rate-limiter/rate-limiter.plugin';
import { BodyParserPlugin } from './body-parser/body-parser.plugin';
import { ValidationPlugin } from './middleware/validation.plugin';
import { EventDrivenPlugin } from './core/event-driven.plugin';

/**
 * Create all core plugins for NextRush
 */
export function createCorePlugins(registry: PluginRegistry) {
  return [
    new RouterPlugin(registry), // Core routing capabilities
    new StaticFilesPlugin(registry), // Static file serving
    new MiddlewarePlugin(registry), // Middleware support
    new WebSocketPlugin(registry), // WebSocket support
    new TemplatePlugin(registry), // Template engine plugin
    new AuthPlugin(registry), // Authentication & authorization
    new MetricsPlugin(registry), // Metrics & monitoring
    new CorsPlugin(registry), // CORS support
    new RateLimiterPlugin(registry), // Rate limiting
    new BodyParserPlugin(registry), // Body parsing
    new ValidationPlugin(registry), // Input validation & XSS protection
    new EventDrivenPlugin(registry), // Event-driven architecture
  ];
}

/**
 * Plugin names for reference
 */
export const PLUGIN_NAMES = {
  ROUTER: 'Router',
  STATIC_FILES: 'StaticFiles',
  MIDDLEWARE: 'Middleware',
  WEBSOCKET: 'WebSocket',
  TEMPLATE: 'Template',
  VALIDATION: 'Validation',
  BODY_PARSER: 'BodyParser',
  EVENT_DRIVEN: 'EventDriven',
  RATE_LIMITER: 'RateLimiter',
  CORS: 'CORS',
  AUTH: 'Auth',
  METRICS: 'Metrics',
  API_DOCS: 'ApiDocumentation',
} as const;
