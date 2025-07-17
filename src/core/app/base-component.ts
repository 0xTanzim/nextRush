/**
 * Abstract base class for components
 * Provides a foundation for extensible components with inheritance
 *
 * @abstract
 * @example
 * ```typescript
 * class RouterComponent extends BaseComponent {
 *   constructor() {
 *     super('Router');
 *   }
 *
 *   public install(app: MinimalApplication): void {
 *     app.get = this.get.bind(this);
 *     app.post = this.post.bind(this);
 *   }
 * }
 * ```
 */

import { InternalPlugin, Lifecycle, MinimalApplication } from '../interfaces';

/**
 * Abstract base class for all components
 * Enables OOP with inheritance for extensible component behavior
 */
export abstract class BaseComponent implements Lifecycle {
  /**
   * Unique component name
   * @readonly
   */
  public readonly name: string;

  /**
   * Component initialization status
   * @protected
   */
  protected isInitialized: boolean = false;

  /**
   * Component running status
   * @protected
   */
  protected isRunning: boolean = false;

  /**
   * Reference to the application instance
   * @protected
   */
  protected app?: MinimalApplication;

  /**
   * Create a new base component
   * @param name - Unique component name
   */
  constructor(name: string) {
    if (!name || typeof name !== 'string') {
      throw new Error('Component name must be a non-empty string');
    }
    this.name = name;
  }

  /**
   * Install component on application (abstract - must be implemented)
   * @param app - Minimal application instance
   * @abstract
   */
  public abstract install(app: MinimalApplication): void | Promise<void>;

  /**
   * Start component (optional override)
   * Called when application starts
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.warn(`Component '${this.name}' is already running`);
      return;
    }

    this.isRunning = true;
    console.log(`✓ Component '${this.name}' started`);
  }

  /**
   * Stop component (optional override)
   * Called when application stops
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn(`Component '${this.name}' is not running`);
      return;
    }

    this.isRunning = false;
    console.log(`✓ Component '${this.name}' stopped`);
  }

  /**
   * Check if component is initialized
   * @returns True if component is initialized
   */
  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Check if component is running
   * @returns True if component is running
   */
  public getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get component information
   * @returns Component information object
   */
  public getInfo(): ComponentInfo {
    return {
      name: this.name,
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      type: 'component',
    };
  }

  /**
   * Set application reference (called during installation)
   * @param app - Application instance
   * @protected
   */
  protected setApp(app: MinimalApplication): void {
    this.app = app;
    this.isInitialized = true;
  }

  /**
   * Ensure component is initialized
   * @throws Error if component is not initialized
   * @protected
   */
  protected ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(`Component '${this.name}' is not initialized`);
    }
  }

  /**
   * Ensure component is running
   * @throws Error if component is not running
   * @protected
   */
  protected ensureRunning(): void {
    this.ensureInitialized();
    if (!this.isRunning) {
      throw new Error(`Component '${this.name}' is not running`);
    }
  }

  /**
   * Log component message with name prefix
   * @param level - Log level
   * @param message - Log message
   * @param meta - Optional metadata
   * @protected
   */
  protected log(
    level: 'info' | 'warn' | 'error',
    message: string,
    meta?: any
  ): void {
    const prefix = `[${this.name}]`;
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
 * Component information interface
 */
export interface ComponentInfo {
  name: string;
  isInitialized: boolean;
  isRunning: boolean;
  type: 'component' | 'plugin';
}

/**
 * Abstract base class for plugins
 * Extends BaseComponent with plugin-specific features
 */
export abstract class BasePlugin
  extends BaseComponent
  implements InternalPlugin
{
  /**
   * Create a new base plugin
   * @param name - Unique plugin name
   * @param version - Plugin version
   * @param dependencies - Plugin dependencies
   */
  constructor(
    name: string, 
    public readonly version: string = '1.0.0', 
    public readonly dependencies: string[] = []
  ) {
    super(name);
  }

  /**
   * Uninstall plugin (optional override)
   * Called when plugin is removed
   * @param app - Minimal application instance
   */
  public async uninstall?(app: MinimalApplication): Promise<void> {
    // Suppress unused parameter warning
    void app;
    this.log('info', 'Plugin uninstalled');
  }

  /**
   * Get plugin information
   * @returns Plugin information object
   */
  public override getInfo(): ComponentInfo & {
    version: string;
    dependencies: string[];
  } {
    return {
      ...super.getInfo(),
      type: 'plugin',
      version: this.version,
      dependencies: this.dependencies,
    };
  }

  /**
   * Check if dependencies are satisfied
   * @param availableComponents - List of available component names
   * @returns True if all dependencies are satisfied
   */
  public checkDependencies(availableComponents: string[]): boolean {
    return this.dependencies.every((dep) => availableComponents.includes(dep));
  }
}

// Re-export types for convenience
export type {
  InternalPlugin,
  Lifecycle,
  MinimalApplication,
} from '../interfaces';
