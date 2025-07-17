/**
 * 🔌 Plugin System Exports - Enterprise Plugin Architecture
 * Clean, organized exports for the NextRush plugin system
 */

import { RouterComponent } from '../components/router/router.component';
import { StaticFilesComponent } from '../components/static-files/static-files.component';
import { TemplateComponent } from '../components/template/template.component';
import { WebSocketComponent } from '../components/websocket/websocket.component';
import type { Plugin, PluginOptions } from '../core/interfaces';

/**
 * Core plugin identifiers
 */
export const CORE_PLUGIN_IDS = {
  ROUTER: 'core:router',
  WEBSOCKET: 'core:websocket',
  STATIC_FILES: 'core:static-files',
  TEMPLATE: 'core:template',
} as const;

/**
 * Creates core plugins with proper lifecycle management
 */
export function createCorePlugins(options: PluginOptions = {}): Plugin[] {
  return [
    // Router Plugin
    {
      id: CORE_PLUGIN_IDS.ROUTER,
      name: 'Router',
      version: '1.0.0',
      component: new RouterComponent(),
      dependencies: [],
      enabled: options.enabledPlugins?.includes(CORE_PLUGIN_IDS.ROUTER) ?? true,
    },

    // WebSocket Plugin
    {
      id: CORE_PLUGIN_IDS.WEBSOCKET,
      name: 'WebSocket',
      version: '1.0.0',
      component: new WebSocketComponent(),
      dependencies: [],
      enabled:
        options.enabledPlugins?.includes(CORE_PLUGIN_IDS.WEBSOCKET) ?? true,
    },

    // Static Files Plugin
    {
      id: CORE_PLUGIN_IDS.STATIC_FILES,
      name: 'Static Files',
      version: '1.0.0',
      component: new StaticFilesComponent(),
      dependencies: [],
      enabled:
        options.enabledPlugins?.includes(CORE_PLUGIN_IDS.STATIC_FILES) ?? true,
    },

    // Template Plugin
    {
      id: CORE_PLUGIN_IDS.TEMPLATE,
      name: 'Template',
      version: '1.0.0',
      component: new TemplateComponent(),
      dependencies: [],
      enabled:
        options.enabledPlugins?.includes(CORE_PLUGIN_IDS.TEMPLATE) ?? true,
    },
  ];
}

// Core Plugin System - Types
export type {
  HealthCheck,
  HealthStatus,
  Plugin,
  PluginConfig,
  PluginContext,
  PluginLogger,
  PluginMetadata,
  PluginRegistry,
  ValidationResult,
} from './core/plugin.interface';

// Core Plugin System - Classes and Enums
export { BasePlugin, PluginError, PluginState } from './core/plugin.interface';

export { PluginManager } from './core/plugin-manager';

export type { PluginManagerConfig } from './core/plugin-manager';

// Specialized Plugin Types
export type {
  MiddlewarePlugin,
  RouteDefinition,
  RouteMatch,
  RouteOptions,
  RouterPlugin as RouterPluginInterface,
  StaticFilesPlugin as StaticFilesPluginInterface,
  StaticMountDefinition,
  StaticMountOptions,
  TemplateEngineOptions,
  TemplateHelper,
  TemplatePlugin as TemplatePluginInterface,
  WebSocketPlugin as WebSocketPluginInterface,
  WebSocketRouteDefinition,
} from './types/specialized-plugins';

// Specialized Plugin Base Classes
export {
  BaseMiddlewarePlugin,
  BaseRouterPlugin,
  BaseStaticFilesPlugin,
  BaseTemplatePlugin,
  BaseWebSocketPlugin,
} from './types/specialized-plugins';

// Concrete Plugin Implementations
export { RouterPlugin } from './implementations/router.plugin';
export { StaticFilesPlugin } from './implementations/static-files.plugin';
export { TemplatePlugin } from './implementations/template.plugin';
export { WebSocketPlugin } from './implementations/websocket.plugin';
