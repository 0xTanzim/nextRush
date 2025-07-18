/**
 * 🔌 Simple Plugin Registry - NextRush Framework
 *
 * Simple event system for plugin communication.
 */

import { Application } from '../../core/app/application';
import { BasePlugin, PluginRegistry } from './base-plugin';

/**
 * Simple Plugin Registry implementation
 */
export class SimplePluginRegistry implements PluginRegistry {
  private plugins = new Map<string, BasePlugin>();
  private listeners = new Map<string, Array<(...args: any[]) => void>>();

  /**
   * Register a plugin
   */
  register(plugin: BasePlugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Install all plugins into the application
   */
  installAll(app: Application): void {
    Array.from(this.plugins.values()).forEach((plugin) => {
      try {
        console.log(`🔌 Installing ${plugin.name} plugin...`);
        plugin.install(app);
        console.log(`✅ ${plugin.name} plugin installed successfully`);
      } catch (error) {
        console.error(`❌ Failed to install ${plugin.name} plugin:`, error);
      }
    });
  }

  /**
   * Start all plugins
   */
  startAll(): void {
    Array.from(this.plugins.values()).forEach((plugin) => {
      try {
        console.log(`🚀 Starting ${plugin.name} plugin...`);
        plugin.start();
      } catch (error) {
        console.error(`❌ Failed to start ${plugin.name} plugin:`, error);
      }
    });
  }

  /**
   * Stop all plugins
   */
  stopAll(): void {
    Array.from(this.plugins.values()).forEach((plugin) => {
      plugin.stop();
    });
  }

  /**
   * Emit an event
   */
  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((listener) => listener(...args));
    }
  }

  /**
   * Listen to an event
   */
  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: (...args: any[]) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  /**
   * Get all plugins
   */
  getPlugins(): BasePlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin by name
   */
  getPlugin(name: string): BasePlugin | undefined {
    return this.plugins.get(name);
  }
}
