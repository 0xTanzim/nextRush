/**
 * Plugin Registry - manages internal plugins with dynamic loading
 * Implements the simplified plugin system with start/stop lifecycle hooks
 */

import {
  InternalPlugin,
  IPluginRegistry,
  MinimalApplication,
} from '../interfaces';

/**
 * Plugin Registry Implementation
 * Manages plugin registration, lifecycle, and dynamic loading
 */
export class PluginRegistry implements IPluginRegistry {
  /**
   * Registered plugins map
   * @private
   */
  private plugins = new Map<string, InternalPlugin>();

  /**
   * Application reference
   * @private
   */
  private app?: MinimalApplication;

  /**
   * Registry initialization status
   * @private
   */
  private isInitialized: boolean = false;

  /**
   * Create a new plugin registry
   */
  constructor() {
    this.log('info', 'Plugin Registry initialized');
  }

  /**
   * Initialize the plugin registry with application reference
   * @param app - Application instance
   */
  public initialize(app: MinimalApplication): void {
    this.app = app;
    this.isInitialized = true;
    this.log('info', 'Plugin Registry bound to application');
  }

  /**
   * Register a plugin
   * @param plugin - Plugin to register
   * @throws Error if plugin name already exists
   */
  public register(plugin: InternalPlugin): void {
    if (!plugin || !plugin.name) {
      throw new Error('Plugin must have a name');
    }

    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered`);
    }

    this.plugins.set(plugin.name, plugin);
    this.log('info', `Plugin '${plugin.name}' registered`);

    // Auto-install if registry is already initialized
    if (this.isInitialized && this.app) {
      this.installPlugin(plugin).catch((error) => {
        this.log(
          'error',
          `Failed to auto-install plugin '${plugin.name}':`,
          error
        );
      });
    }
  }

  /**
   * Unregister a plugin
   * @param name - Plugin name
   * @returns Promise that resolves when plugin is unregistered
   */
  public async unregister(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      this.log('warn', `Plugin '${name}' not found for unregistration`);
      return false;
    }

    try {
      // Stop plugin if running
      if (plugin.stop) {
        await plugin.stop();
        this.log('info', `Plugin '${name}' stopped`);
      }

      // Uninstall plugin if method exists
      if (plugin.uninstall && this.app) {
        await plugin.uninstall(this.app);
        this.log('info', `Plugin '${name}' uninstalled`);
      }

      this.plugins.delete(name);
      this.log('info', `Plugin '${name}' unregistered`);
      return true;
    } catch (error) {
      this.log('error', `Error unregistering plugin '${name}':`, error);
      throw error;
    }
  }

  /**
   * Get all registered plugins
   * @returns Array of all registered plugins
   */
  public getAll(): InternalPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Check if plugin is registered
   * @param name - Plugin name
   * @returns True if plugin is registered
   */
  public isRegistered(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Start all plugins
   * @returns Promise that resolves when all plugins are started
   */
  public async start(): Promise<void> {
    return this.startAll();
  }

  /**
   * Stop all plugins
   * @returns Promise that resolves when all plugins are stopped
   */
  public async stop(): Promise<void> {
    return this.stopAll();
  }

  /**
   * Set application reference
   * @param app - Application instance
   */
  public setApp(app: MinimalApplication): void {
    this.initialize(app);
  }

  /**
   * Get registered plugin by name
   * @param name - Plugin name
   * @returns Plugin instance or undefined
   */
  public get(name: string): InternalPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Install all registered plugins
   * @returns Promise that resolves when all plugins are installed
   */
  public async installAll(): Promise<void> {
    if (!this.app) {
      throw new Error('Plugin Registry not initialized with application');
    }

    this.log('info', `Installing ${this.plugins.size} plugins...`);

    for (const [name, plugin] of this.plugins) {
      try {
        await this.installPlugin(plugin);
        this.log('info', `✓ Plugin '${name}' installed`);
      } catch (error) {
        this.log('error', `✗ Failed to install plugin '${name}':`, error);
        throw error;
      }
    }

    this.log('info', '✓ All plugins installed successfully');
  }

  /**
   * Start all plugins
   * @returns Promise that resolves when all plugins are started
   */
  public async startAll(): Promise<void> {
    this.log('info', `Starting ${this.plugins.size} plugins...`);

    for (const [name, plugin] of this.plugins) {
      try {
        if (plugin.start) {
          await plugin.start();
          this.log('info', `✓ Plugin '${name}' started`);
        }
      } catch (error) {
        this.log('error', `✗ Failed to start plugin '${name}':`, error);
        throw error;
      }
    }

    this.log('info', '✓ All plugins started successfully');
  }

  /**
   * Stop all plugins
   * @returns Promise that resolves when all plugins are stopped
   */
  public async stopAll(): Promise<void> {
    this.log('info', `Stopping ${this.plugins.size} plugins...`);

    // Stop plugins in reverse registration order
    const pluginArray = Array.from(this.plugins.entries()).reverse();

    for (const [name, plugin] of pluginArray) {
      try {
        if (plugin.stop) {
          await plugin.stop();
          this.log('info', `✓ Plugin '${name}' stopped`);
        }
      } catch (error) {
        this.log('error', `✗ Failed to stop plugin '${name}':`, error);
        // Continue stopping other plugins even if one fails
      }
    }

    this.log('info', '✓ All plugins stopped');
  }

  /**
   * List all registered plugins
   * @returns Array of registered plugins
   */
  public list(): InternalPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin statistics
   * @returns Plugin statistics
   */
  public getStats(): PluginStats {
    const plugins = Array.from(this.plugins.values());

    return {
      total: plugins.length,
      registered: plugins.map((p) => p.name),
      withStartMethod: plugins.filter((p) => !!p.start).length,
      withStopMethod: plugins.filter((p) => !!p.stop).length,
      withUninstallMethod: plugins.filter((p) => !!p.uninstall).length,
    };
  }

  /**
   * Check if a plugin is registered
   * @param name - Plugin name
   * @returns True if plugin is registered
   */
  public has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Enable a plugin
   * @param name - Plugin name
   * @returns Promise that resolves when plugin is enabled
   */
  public async enable(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin '${name}' not found`);
    }

    if (!this.app) {
      throw new Error('Plugin Registry not initialized with application');
    }

    try {
      await this.installPlugin(plugin);
      if (plugin.start) {
        await plugin.start();
      }
      this.log('info', `Plugin '${name}' enabled`);
    } catch (error) {
      this.log('error', `Failed to enable plugin '${name}':`, error);
      throw error;
    }
  }

  /**
   * Disable a plugin
   * @param name - Plugin name
   * @returns Promise that resolves when plugin is disabled
   */
  public async disable(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin '${name}' not found`);
    }

    try {
      if (plugin.stop) {
        await plugin.stop();
      }

      if (plugin.uninstall && this.app) {
        await plugin.uninstall(this.app);
      }

      this.log('info', `Plugin '${name}' disabled`);
    } catch (error) {
      this.log('error', `Failed to disable plugin '${name}':`, error);
      throw error;
    }
  }

  /**
   * Clear all plugins (for testing)
   * @internal
   */
  public clear(): void {
    this.plugins.clear();
    this.log('info', 'All plugins cleared');
  }

  /**
   * Install a single plugin
   * @param plugin - Plugin to install
   * @private
   */
  private async installPlugin(plugin: InternalPlugin): Promise<void> {
    if (!this.app) {
      throw new Error('Application not available for plugin installation');
    }

    try {
      if (plugin.install) {
        await plugin.install(this.app);
      }
    } catch (error) {
      throw new Error(`Failed to install plugin '${plugin.name}': ${error}`);
    }
  }

  /**
   * Log with plugin registry prefix
   * @param level - Log level
   * @param message - Log message
   * @param meta - Optional metadata
   * @private
   */
  private log(
    level: 'info' | 'warn' | 'error',
    message: string,
    meta?: any
  ): void {
    const prefix = '[PluginRegistry]';
    switch (level) {
      case 'info':
        console.log(prefix, message, meta || '');
        break;
      case 'warn':
        console.warn(prefix, message, meta || '');
        break;
      case 'error':
        console.error(prefix, message, meta || '');
        break;
    }
  }
}

/**
 * Plugin statistics interface
 */
export interface PluginStats {
  total: number;
  registered: string[];
  withStartMethod: number;
  withStopMethod: number;
  withUninstallMethod: number;
}

/**
 * Create a new plugin registry instance
 * @returns New plugin registry
 */
export function createPluginRegistry(): PluginRegistry {
  return new PluginRegistry();
}
