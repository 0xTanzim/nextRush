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
export { StaticFilesPlugin } from './static-files/static-files.plugin';
export { WebSocketPlugin } from './websocket/websocket.plugin';

// ============================================================================
// 🎯 PLUGIN CREATION HELPER
// ============================================================================

import type { PluginRegistry } from './core/base-plugin';
import { MiddlewarePlugin } from './middleware/middleware.plugin';
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
    new WebSocketPlugin(registry),
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
} as const;
