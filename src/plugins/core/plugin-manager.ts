/**
 * 🏗️ Plugin Manager - Enterprise Plugin Management System
 * Manages plugin lifecycle, dependencies, and composition
 */

import {
  Plugin,
  PluginContext,
  PluginConfig,
  PluginLogger,
  PluginRegistry,
  PluginState,
  PluginError,
  HealthStatus
} from './plugin.interface';
import { Application } from '../../core/app/application';
import { EventEmitter } from 'events';

/**
 * Plugin manager configuration
 */
export interface PluginManagerConfig {
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxStartupTime: number; // milliseconds
  validateDependencies: boolean;
  autoStart: boolean;
}

/**
 * Plugin registration info
 */
interface PluginRegistration {
  plugin: Plugin;
  config: PluginConfig;
  dependencies: string[];
  dependents: Set<string>;
}

/**
 * Enterprise Plugin Manager
 * Handles plugin lifecycle, dependency resolution, and composition
 */
export class PluginManager extends EventEmitter implements PluginRegistry {
  private readonly registrations = new Map<string, PluginRegistration>();
  private readonly logger: PluginLogger;
  private readonly app: Application;
  private readonly config: PluginManagerConfig;
  private isStarted = false;

  constructor(app: Application, config: Partial<PluginManagerConfig> = {}) {
    super();
    this.app = app;
    this.config = {
      enableLogging: true,
      logLevel: 'info',
      maxStartupTime: 30000,
      validateDependencies: true,
      autoStart: true,
      ...config
    };
    this.logger = new ConsolePluginLogger(this.config.logLevel);
  }

  /**
   * Register a plugin with the manager
   */
  public async register(
    plugin: Plugin,
    config: Partial<PluginConfig> = {}
  ): Promise<void> {
    const pluginName = plugin.metadata.name;

    // Validate plugin
    this.validatePlugin(plugin);

    // Check for duplicates
    if (this.registrations.has(pluginName)) {
      throw new PluginError(`Plugin ${pluginName} is already registered`);
    }

    // Prepare plugin config
    const pluginConfig: PluginConfig = {
      enabled: true,
      options: {},
      ...config
    };

    // Validate plugin config
    const validation = plugin.validateConfig?.(pluginConfig);
    if (validation && !validation.isValid) {
      throw new PluginError(
        `Plugin ${pluginName} configuration is invalid: ${validation.errors.join(', ')}`
      );
    }

    // Register plugin
    const registration: PluginRegistration = {
      plugin,
      config: pluginConfig,
      dependencies: plugin.metadata.dependencies || [],
      dependents: new Set()
    };

    this.registrations.set(pluginName, registration);

    // Update dependency graph
    this.updateDependencyGraph(pluginName);

    this.logger.info(`Plugin ${pluginName} registered`);
    this.emit('plugin:registered', { pluginName, plugin });

    // Auto-install if enabled
    if (pluginConfig.enabled) {
      await this.install(pluginName);

      // Auto-start if manager is already started
      if (this.isStarted && this.config.autoStart) {
        await this.start(pluginName);
      }
    }
  }

  /**
   * Install a plugin (run install lifecycle)
   */
  public async install(pluginName: string): Promise<void> {
    const registration = this.getRegistration(pluginName);
    const { plugin } = registration;

    if (plugin.state !== PluginState.UNINSTALLED) {
      return; // Already installed
    }

    // Check dependencies
    if (this.config.validateDependencies) {
      await this.validateDependencies(pluginName);
    }

    // Create plugin context
    const context = this.createPluginContext(registration);

    try {
      await plugin.install(context);
      this.logger.info(`Plugin ${pluginName} installed successfully`);
      this.emit('plugin:installed', { pluginName, plugin });
    } catch (error) {
      this.logger.error(`Plugin ${pluginName} installation failed:`, error);
      this.emit('plugin:error', { pluginName, plugin, error });
      throw new PluginError(`Plugin ${pluginName} installation failed`, pluginName, error as Error);
    }
  }

  /**
   * Start a plugin (run start lifecycle)
   */
  public async start(pluginName: string): Promise<void> {
    const registration = this.getRegistration(pluginName);
    const { plugin } = registration;

    if (plugin.state !== PluginState.INSTALLED) {
      if (plugin.state === PluginState.UNINSTALLED) {
        await this.install(pluginName);
      } else {
        return; // Already started or in error state
      }
    }

    // Start dependencies first
    for (const depName of registration.dependencies) {
      await this.start(depName);
    }

    const context = this.createPluginContext(registration);

    try {
      await this.withTimeout(
        plugin.start(context),
        this.config.maxStartupTime,
        `Plugin ${pluginName} start timeout`
      );
      
      this.logger.info(`Plugin ${pluginName} started successfully`);
      this.emit('plugin:started', { pluginName, plugin });
    } catch (error) {
      this.logger.error(`Plugin ${pluginName} start failed:`, error);
      this.emit('plugin:error', { pluginName, plugin, error });
      throw new PluginError(`Plugin ${pluginName} start failed`, pluginName, error as Error);
    }
  }

  /**
   * Stop a plugin (run stop lifecycle)
   */
  public async stop(pluginName: string): Promise<void> {
    const registration = this.getRegistration(pluginName);
    const { plugin } = registration;

    if (plugin.state !== PluginState.STARTED) {
      return; // Not started
    }

    // Stop dependents first
    for (const dependentName of registration.dependents) {
      await this.stop(dependentName);
    }

    const context = this.createPluginContext(registration);

    try {
      await plugin.stop(context);
      this.logger.info(`Plugin ${pluginName} stopped successfully`);
      this.emit('plugin:stopped', { pluginName, plugin });
    } catch (error) {
      this.logger.error(`Plugin ${pluginName} stop failed:`, error);
      this.emit('plugin:error', { pluginName, plugin, error });
      throw new PluginError(`Plugin ${pluginName} stop failed`, pluginName, error as Error);
    }
  }

  /**
   * Uninstall a plugin (run uninstall lifecycle)
   */
  public async uninstall(pluginName: string): Promise<void> {
    const registration = this.getRegistration(pluginName);
    const { plugin } = registration;

    // Stop first if running
    if (plugin.state === PluginState.STARTED) {
      await this.stop(pluginName);
    }

    if (plugin.state === PluginState.UNINSTALLED) {
      return; // Already uninstalled
    }

    const context = this.createPluginContext(registration);

    try {
      await plugin.uninstall(context);
      this.logger.info(`Plugin ${pluginName} uninstalled successfully`);
      this.emit('plugin:uninstalled', { pluginName, plugin });
    } catch (error) {
      this.logger.error(`Plugin ${pluginName} uninstall failed:`, error);
      this.emit('plugin:error', { pluginName, plugin, error });
      throw new PluginError(`Plugin ${pluginName} uninstall failed`, pluginName, error as Error);
    }
  }

  /**
   * Start all registered plugins
   */
  public async startAll(): Promise<void> {
    this.isStarted = true;
    
    // Sort plugins by priority (higher priority first)
    const sortedPlugins = Array.from(this.registrations.entries())
      .filter(([, reg]) => reg.config.enabled)
      .sort(([, a], [, b]) => b.plugin.metadata.priority - a.plugin.metadata.priority);

    // Start plugins in dependency order
    const startOrder = this.resolveDependencyOrder(sortedPlugins.map(([name]) => name));
    
    for (const pluginName of startOrder) {
      await this.start(pluginName);
    }

    this.logger.info('All plugins started successfully');
    this.emit('manager:started');
  }

  /**
   * Stop all plugins
   */
  public async stopAll(): Promise<void> {
    const activePlugins = Array.from(this.registrations.keys())
      .filter(name => this.get(name)?.state === PluginState.STARTED);

    // Stop in reverse dependency order
    const stopOrder = this.resolveDependencyOrder(activePlugins).reverse();

    for (const pluginName of stopOrder) {
      try {
        await this.stop(pluginName);
      } catch (error) {
        this.logger.error(`Failed to stop plugin ${pluginName}:`, error);
      }
    }

    this.isStarted = false;
    this.logger.info('All plugins stopped');
    this.emit('manager:stopped');
  }

  /**
   * Get health status of all plugins
   */
  public getHealth(): Record<string, HealthStatus> {
    const health: Record<string, HealthStatus> = {};
    
    for (const [name, registration] of this.registrations) {
      health[name] = registration.plugin.getHealth?.() || {
        status: 'healthy',
        checks: []
      };
    }

    return health;
  }

  // PluginRegistry implementation
  public get(name: string): Plugin | undefined {
    return this.registrations.get(name)?.plugin;
  }

  public has(name: string): boolean {
    return this.registrations.has(name);
  }

  public getAll(): Plugin[] {
    return Array.from(this.registrations.values()).map(reg => reg.plugin);
  }

  public getDependents(pluginName: string): Plugin[] {
    const registration = this.registrations.get(pluginName);
    if (!registration) return [];

    return Array.from(registration.dependents)
      .map(name => this.get(name))
      .filter((plugin): plugin is Plugin => plugin !== undefined);
  }

  public getDependencies(pluginName: string): Plugin[] {
    const registration = this.registrations.get(pluginName);
    if (!registration) return [];

    return registration.dependencies
      .map(name => this.get(name))
      .filter((plugin): plugin is Plugin => plugin !== undefined);
  }

  // Private methods
  private validatePlugin(plugin: Plugin): void {
    if (!plugin.metadata?.name) {
      throw new PluginError('Plugin must have a name');
    }
    
    if (!plugin.metadata.version) {
      throw new PluginError('Plugin must have a version');
    }

    if (typeof plugin.install !== 'function') {
      throw new PluginError('Plugin must implement install method');
    }
  }

  private getRegistration(pluginName: string): PluginRegistration {
    const registration = this.registrations.get(pluginName);
    if (!registration) {
      throw new PluginError(`Plugin ${pluginName} is not registered`);
    }
    return registration;
  }

  private createPluginContext(registration: PluginRegistration): PluginContext {
    return {
      app: this.app,
      config: registration.config,
      logger: this.logger,
      registry: this
    };
  }

  private updateDependencyGraph(pluginName: string): void {
    const registration = this.registrations.get(pluginName)!;
    
    // Update dependents for each dependency
    for (const depName of registration.dependencies) {
      const depRegistration = this.registrations.get(depName);
      if (depRegistration) {
        depRegistration.dependents.add(pluginName);
      }
    }
  }

  private async validateDependencies(pluginName: string): Promise<void> {
    const registration = this.getRegistration(pluginName);
    
    for (const depName of registration.dependencies) {
      const depPlugin = this.get(depName);
      if (!depPlugin) {
        throw new PluginError(
          `Plugin ${pluginName} depends on ${depName} which is not registered`
        );
      }
      
      if (depPlugin.state === PluginState.UNINSTALLED) {
        await this.install(depName);
      }
    }
  }

  private resolveDependencyOrder(pluginNames: string[]): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];

    const visit = (name: string): void => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new PluginError(`Circular dependency detected involving ${name}`);
      }

      visiting.add(name);
      const registration = this.registrations.get(name);
      if (registration) {
        for (const depName of registration.dependencies) {
          if (pluginNames.includes(depName)) {
            visit(depName);
          }
        }
      }
      visiting.delete(name);
      visited.add(name);
      result.push(name);
    };

    for (const name of pluginNames) {
      visit(name);
    }

    return result;
  }

  private async withTimeout<T>(
    promise: Promise<T> | T,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T> {
    if (!(promise instanceof Promise)) {
      return promise;
    }

    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
      })
    ]);
  }
}

/**
 * Console-based plugin logger implementation
 */
class ConsolePluginLogger implements PluginLogger {
  constructor(private readonly level: 'debug' | 'info' | 'warn' | 'error') {}

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(`[PLUGIN DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(`[PLUGIN INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[PLUGIN WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(`[PLUGIN ERROR] ${message}`, ...args);
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }
}
