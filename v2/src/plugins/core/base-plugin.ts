/**
 * Base plugin class for NextRush v2
 *
 * @packageDocumentation
 */

import type { Application } from '@/core/app/application';
import { PluginError } from '@/errors/custom-errors';
import type {
  Middleware,
  NextRushRequest,
  NextRushResponse,
} from '@/types/http';

/**
 * Plugin interface
 */
export interface Plugin {
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Plugin description */
  description?: string;
  /** Plugin author */
  author?: string;
  /** Plugin homepage */
  homepage?: string;
  /** Plugin license */
  license?: string;
  /** Plugin keywords */
  keywords?: string[];
  /** Install plugin on application */
  install(app: Application): void;
  /** Plugin initialization */
  init?(): void | Promise<void>;
  /** Plugin cleanup */
  cleanup?(): void | Promise<void>;
  /** Plugin configuration validation */
  validateConfig?(): boolean;
  /** Plugin health check */
  healthCheck?(): Promise<boolean>;
}

/**
 * Plugin options interface
 */
export interface PluginOptions {
  /** Enable/disable plugin */
  enabled?: boolean;
  /** Plugin configuration */
  config?: Record<string, unknown>;
  /** Plugin priority (lower = higher priority) */
  priority?: number;
  /** Plugin dependencies */
  dependencies?: string[];
  /** Plugin conflicts */
  conflicts?: string[];
}

/**
 * Plugin metadata interface
 */
export interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  license?: string;
  keywords?: string[];
  dependencies?: string[];
  conflicts?: string[];
}

/**
 * Base plugin class that all plugins should extend
 *
 * @example
 * ```typescript
 * import { BasePlugin } from 'nextrush-v2';
 * import type { Application } from 'nextrush-v2';
 *
 * export class MyPlugin extends BasePlugin {
 *   name = 'MyPlugin';
 *   version = '1.0.0';
 *   description = 'A custom plugin';
 *
 *   install(app: Application): void {
 *     // Plugin installation logic
 *     app.use((req, res, next) => {
 *       // Middleware logic
 *       next();
 *     });
 *   }
 *
 *   async init(): Promise<void> {
 *     // Plugin initialization
 *   }
 *
 *   async cleanup(): Promise<void> {
 *     // Plugin cleanup
 *   }
 * }
 * ```
 */
export abstract class BasePlugin implements Plugin {
  public abstract name: string;
  public abstract version: string;
  public abstract onInstall(app: Application): void;
  public description?: string;
  public author?: string;
  public homepage?: string;
  public license?: string;
  public keywords?: string[];
  public dependencies?: string[];
  public conflicts?: string[];

  protected app?: Application;
  protected config: Record<string, unknown> = {};
  protected isInitialized = false;
  protected isInstalled = false;

  /**
   * Install the plugin on an application
   */
  public install(app: Application): void {
    if (this.isInstalled) {
      throw new PluginError(
        `Plugin ${this.name} is already installed`,
        this.name,
        500
      );
    }

    this.app = app;
    this.isInstalled = true;

    // Validate configuration
    if (this.validateConfig && !this.validateConfig()) {
      throw new PluginError(
        `Invalid configuration for plugin ${this.name}`,
        this.name,
        500
      );
    }

    // Call the abstract install method
    this.onInstall(app);

    // Initialize if init method exists
    if ((this as any).init) {
      (this as any).init().catch((error: any) => {
        throw new PluginError(
          `Failed to initialize plugin ${this.name}: ${error.message}`,
          this.name,
          500
        );
      });
    }
  }

  /**
   * Abstract method that plugins must implement
   */

  /**
   * Get plugin metadata
   */
  public getMetadata(): PluginMetadata {
    return {
      name: this.name,
      version: this.version,
      description: this.description || '',
      author: this.author || '',
      homepage: this.homepage || '',
      license: this.license || '',
      keywords: this.keywords || [],
      dependencies: this.dependencies || [],
      conflicts: this.conflicts || [],
    };
  }

  /**
   * Set plugin configuration
   */
  public setConfig(config: Record<string, unknown>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get plugin configuration
   */
  public getConfig(): Record<string, unknown> {
    return { ...this.config };
  }

  /**
   * Get a specific configuration value
   */
  public getConfigValue<T>(key: string, defaultValue?: T): T | undefined {
    return (this.config[key] as T) ?? defaultValue;
  }

  /**
   * Check if plugin is installed
   */
  public isPluginInstalled(): boolean {
    return this.isInstalled;
  }

  /**
   * Check if plugin is initialized
   */
  public isPluginInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Register middleware with the application
   */
  protected registerMiddleware(middleware: Middleware): void {
    if (!this.app) {
      throw new PluginError(
        `Plugin ${this.name} is not installed`,
        this.name,
        500
      );
    }

    this.app.use(middleware as any);
  }

  /**
   * Log plugin message
   */
  protected log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }

  /**
   * Log plugin error
   */
  protected logError(message: string, error?: Error): void {
    console.error(`[${this.name}] ${message}`, error);
  }

  /**
   * Log plugin warning
   */
  protected logWarning(message: string): void {
    console.warn(`[${this.name}] ${message}`);
  }

  /**
   * Log plugin debug message
   */
  protected logDebug(message: string): void {
    if (this.getConfigValue('debug', false)) {
      console.debug(`[${this.name}] ${message}`);
    }
  }

  /**
   * Emit plugin event
   */
  protected emit(event: string, ...args: unknown[]): void {
    if (this.app && 'emit' in this.app) {
      (this.app as any).emit(`plugin:${this.name}:${event}`, ...args);
    }
  }

  /**
   * Create a middleware that wraps the plugin's functionality
   */
  protected createMiddleware(
    handler: (
      req: NextRushRequest,
      res: NextRushResponse,
      next: () => void
    ) => void
  ): Middleware {
    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      try {
        handler(req, res, next);
      } catch (error) {
        this.logError('Middleware error', error as Error);
        next();
      }
    };
  }

  /**
   * Create an async middleware that wraps the plugin's functionality
   */
  protected createAsyncMiddleware(
    handler: (
      req: NextRushRequest,
      res: NextRushResponse,
      next: () => void
    ) => Promise<void>
  ): Middleware {
    return async (
      req: NextRushRequest,
      res: NextRushResponse,
      next: () => void
    ) => {
      try {
        await handler(req, res, next);
      } catch (error) {
        this.logError('Async middleware error', error as Error);
        next();
      }
    };
  }

  /**
   * Validate plugin configuration
   */
  public validateConfig(): boolean {
    // Default implementation - plugins can override
    return true;
  }

  /**
   * Plugin health check
   */
  public async healthCheck(): Promise<boolean> {
    // Default implementation - plugins can override
    return this.isInstalled && this.isInitialized;
  }

  /**
   * Get plugin status
   */
  public getStatus(): Record<string, unknown> {
    return {
      name: this.name,
      version: this.version,
      installed: this.isInstalled,
      initialized: this.isInitialized,
      config: this.config,
    };
  }
}
