/**
 * 🔌 BasePlugin - Core Plugin Implementation
 *
 * According to copilot instructions, all features must be implemented as plugins
 * inheriting from BasePlugin under src/plugins/
 */

import { Application } from '../../core/app/application';

/**
 * Plugin Registry interface for event system
 */
export interface PluginRegistry {
  emit(event: string, ...args: any[]): void;
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
}

/**
 * Base Plugin class that all NextRush plugins must inherit from
 * Follows the copilot instructions for unified plugin architecture
 */
export abstract class BasePlugin {
  abstract name: string;
  protected registry: PluginRegistry;

  constructor(registry: PluginRegistry) {
    this.registry = registry;
  }

  /**
   * Install the plugin into the application
   * This is where plugins register their capabilities (app.get, app.use, etc.)
   */
  abstract install(app: Application): void;

  /**
   * Start the plugin - activate its functionality
   */
  abstract start(): void;

  /**
   * Stop the plugin - deactivate its functionality
   */
  abstract stop(): void;

  /**
   * Emit events to other plugins
   */
  protected emit(event: string, ...args: any[]): void {
    this.registry.emit(event, ...args);
  }

  /**
   * Listen to events from other plugins
   */
  protected on(event: string, listener: (...args: any[]) => void): void {
    this.registry.on(event, listener);
  }

  /**
   * Remove event listener
   */
  protected off(event: string, listener: (...args: any[]) => void): void {
    this.registry.off(event, listener);
  }
}
