/**
 * 🔌 Plugin System Exports - Enterprise Plugin Architecture
 * Clean, organized exports for the NextRush plugin system
 */

import type { Plugin, PluginOptions } from '../core/interfaces';
import { RouterComponent } from '../components/router/router.component';
import { WebSocketComponent } from '../components/websocket/websocket.component';
import { StaticFilesComponent } from '../components/static-files/static-files.component';
import { TemplateComponent } from '../components/template/template.component';

/**
 * Core plugin identifiers
 */
export const CORE_PLUGIN_IDS = {
  ROUTER: 'core:router',
  WEBSOCKET: 'core:websocket',
  STATIC_FILES: 'core:static-files',
  TEMPLATE: 'core:template'
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
      enabled: options.enabledPlugins?.includes(CORE_PLUGIN_IDS.ROUTER) ?? true
    },

    // WebSocket Plugin
    {
      id: CORE_PLUGIN_IDS.WEBSOCKET,
      name: 'WebSocket',
      version: '1.0.0',
      component: new WebSocketComponent(),
      dependencies: [],
      enabled: options.enabledPlugins?.includes(CORE_PLUGIN_IDS.WEBSOCKET) ?? true
    },

    // Static Files Plugin
    {
      id: CORE_PLUGIN_IDS.STATIC_FILES,
      name: 'Static Files',
      version: '1.0.0',
      component: new StaticFilesComponent(),
      dependencies: [],
      enabled: options.enabledPlugins?.includes(CORE_PLUGIN_IDS.STATIC_FILES) ?? true
    },

    // Template Plugin
    {
      id: CORE_PLUGIN_IDS.TEMPLATE,
      name: 'Template',
      version: '1.0.0',
      component: new TemplateComponent(),
      dependencies: [],
      enabled: options.enabledPlugins?.includes(CORE_PLUGIN_IDS.TEMPLATE) ?? true
    }
  ];
}

// Core Plugin System - Types
export type {
  Plugin,
  PluginContext,
  PluginConfig,
  PluginLogger,
  PluginRegistry,
  PluginMetadata,
  ValidationResult,
  HealthStatus,
  HealthCheck
} from './core/plugin.interface';

// Core Plugin System - Classes and Enums
export {
  PluginState,
  PluginError,
  BasePlugin
} from './core/plugin.interface';

export {
  PluginManager
} from './core/plugin-manager';

export type {
  PluginManagerConfig
} from './core/plugin-manager';

// Specialized Plugin Types
export type {
  RouterPlugin as RouterPluginInterface,
  MiddlewarePlugin,
  WebSocketPlugin as WebSocketPluginInterface,
  StaticFilesPlugin as StaticFilesPluginInterface,
  TemplatePlugin as TemplatePluginInterface,
  RouteDefinition,
  RouteOptions,
  RouteMatch,
  WebSocketRouteDefinition,
  StaticMountDefinition,
  StaticMountOptions,
  TemplateEngineOptions,
  TemplateHelper
} from './types/specialized-plugins';

// Specialized Plugin Base Classes
export {
  BaseRouterPlugin,
  BaseMiddlewarePlugin,
  BaseWebSocketPlugin,
  BaseStaticFilesPlugin,
  BaseTemplatePlugin
} from './types/specialized-plugins';

// Concrete Plugin Implementations
export { RouterPlugin } from './implementations/router.plugin';
export { WebSocketPlugin } from './implementations/websocket.plugin';
export { StaticFilesPlugin } from './implementations/static-files.plugin';
export { TemplatePlugin } from './implementations/template.plugin';
