/**
 * 🏗️ Core Plugin Interface - Enterprise Plugin Architecture
 * Defines strict contracts for all NextRush plugins
 */

import { Application } from '../../core/app/application';

/**
 * Plugin lifecycle states
 */
export enum PluginState {
  UNINSTALLED = 'uninstalled',
  INSTALLED = 'installed',
  STARTED = 'started',
  STOPPED = 'stopped',
  ERROR = 'error',
}

/**
 * Plugin metadata interface
 */
export interface PluginMetadata {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author?: string;
  readonly dependencies?: string[];
  readonly category: 'core' | 'middleware' | 'extension' | 'integration';
  readonly priority: number; // 1-100, higher = loads first
}

/**
 * Plugin configuration interface
 */
export interface PluginConfig {
  readonly enabled: boolean;
  readonly options: Record<string, unknown>;
}

/**
 * Plugin context - runtime information
 */
export interface PluginContext {
  readonly app: Application;
  readonly config: PluginConfig;
  readonly logger: PluginLogger;
  readonly registry: PluginRegistry;
}

/**
 * Plugin logger interface
 */
export interface PluginLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Plugin registry interface
 */
export interface PluginRegistry {
  get(name: string): Plugin | undefined;
  has(name: string): boolean;
  getAll(): Plugin[];
  getDependents(pluginName: string): Plugin[];
  getDependencies(pluginName: string): Plugin[];
}

/**
 * Core Plugin Interface - All plugins must implement this
 */
export interface Plugin {
  /**
   * Plugin metadata - static information
   */
  readonly metadata: PluginMetadata;

  /**
   * Current plugin state
   */
  readonly state: PluginState;

  /**
   * Install the plugin into the application
   * This is where the plugin registers its capabilities
   */
  install(context: PluginContext): Promise<void> | void;

  /**
   * Start the plugin - activate its functionality
   * Called after all plugins are installed
   */
  start(context: PluginContext): Promise<void> | void;

  /**
   * Stop the plugin - deactivate its functionality
   * Called during graceful shutdown
   */
  stop(context: PluginContext): Promise<void> | void;

  /**
   * Uninstall the plugin - clean up all resources
   * Called when plugin is being removed
   */
  uninstall(context: PluginContext): Promise<void> | void;

  /**
   * Validate plugin configuration
   */
  validateConfig?(config: PluginConfig): ValidationResult;

  /**
   * Get plugin health status
   */
  getHealth?(): HealthStatus;
}

/**
 * Base abstract plugin implementation
 */
export abstract class BasePlugin implements Plugin {
  public state: PluginState = PluginState.UNINSTALLED;
  protected context?: PluginContext | undefined;

  public abstract readonly metadata: PluginMetadata;

  public async install(context: PluginContext): Promise<void> {
    this.context = context;
    this.state = PluginState.INSTALLED;
    context.logger.info(`Plugin ${this.metadata.name} installed`);

    await this.onInstall(context);
  }

  public async start(context: PluginContext): Promise<void> {
    if (this.state !== PluginState.INSTALLED) {
      throw new PluginError(
        `Cannot start plugin ${this.metadata.name} in state ${this.state}`
      );
    }

    this.state = PluginState.STARTED;
    context.logger.info(`Plugin ${this.metadata.name} started`);

    await this.onStart(context);
  }

  public async stop(context: PluginContext): Promise<void> {
    if (this.state !== PluginState.STARTED) {
      return; // Already stopped or not started
    }

    this.state = PluginState.STOPPED;
    context.logger.info(`Plugin ${this.metadata.name} stopped`);

    await this.onStop(context);
  }

  public async uninstall(context: PluginContext): Promise<void> {
    this.state = PluginState.UNINSTALLED;
    context.logger.info(`Plugin ${this.metadata.name} uninstalled`);

    await this.onUninstall(context);
    this.context = undefined;
  }

  /**
   * Plugin-specific installation logic
   */
  protected abstract onInstall(context: PluginContext): Promise<void> | void;

  /**
   * Plugin-specific start logic
   */
  protected abstract onStart(context: PluginContext): Promise<void> | void;

  /**
   * Plugin-specific stop logic
   */
  protected abstract onStop(context: PluginContext): Promise<void> | void;

  /**
   * Plugin-specific uninstall logic
   */
  protected abstract onUninstall(context: PluginContext): Promise<void> | void;

  /**
   * Get current context (throws if not installed)
   */
  public getContext(): PluginContext {
    if (!this.context) {
      throw new PluginError(`Plugin ${this.metadata.name} is not installed`);
    }
    return this.context;
  }

  public validateConfig(config: PluginConfig): ValidationResult {
    // Default validation - plugins can override
    return { isValid: true, errors: [] };
  }

  public getHealth(): HealthStatus {
    return {
      status: this.state === PluginState.STARTED ? 'healthy' : 'unhealthy',
      checks: [
        {
          name: 'state',
          status: this.state === PluginState.STARTED ? 'pass' : 'fail',
          details: { currentState: this.state },
        },
      ],
    };
  }
}

/**
 * Plugin validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Plugin health status
 */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  details?: Record<string, unknown>;
}

/**
 * Plugin-specific error class
 */
export class PluginError extends Error {
  constructor(
    message: string,
    public readonly pluginName?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PluginError';
  }
}
