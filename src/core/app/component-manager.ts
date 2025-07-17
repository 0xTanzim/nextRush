/**
 * Component Manager - manages component lifecycle and dependencies
 * Implements the composition-based architecture pattern
 */

import { MinimalApplication, InternalPlugin } from '../interfaces';

/**
 * Component Manager Implementation
 * Manages component registration, lifecycle, and dependencies
 */
export class ComponentManager {
  /**
   * Registered components map
   * @private
   */
  private components = new Map<string, InternalPlugin>();

  /**
   * Application reference
   * @private
   */
  private app?: MinimalApplication;

  /**
   * Manager initialization status
   * @private
   */
  private isInitialized: boolean = false;

  /**
   * Create a new component manager
   */
  constructor() {
    this.log('info', 'Component Manager initialized');
  }

  /**
   * Initialize the component manager with application reference
   * @param app - Application instance
   */
  public initialize(app: MinimalApplication): void {
    this.app = app;
    this.isInitialized = true;
    this.log('info', 'Component Manager bound to application');
  }

  /**
   * Register a component
   * @param component - Component to register
   * @throws Error if component name already exists
   */
  public register(component: InternalPlugin): void {
    if (!component || !component.name) {
      throw new Error('Component must have a name');
    }

    if (this.components.has(component.name)) {
      throw new Error(`Component '${component.name}' is already registered`);
    }

    this.components.set(component.name, component);
    this.log('info', `Component '${component.name}' registered`);

    // Auto-install if manager is already initialized
    if (this.isInitialized && this.app) {
      this.installComponent(component);
    }
  }

  /**
   * Get registered component by name
   * @param name - Component name
   * @returns Component instance or undefined
   */
  public get(name: string): InternalPlugin | undefined {
    return this.components.get(name);
  }

  /**
   * Unregister a component
   * @param name - Component name
   * @returns True if component was removed
   */
  public unregister(name: string): boolean {
    const component = this.components.get(name);
    if (!component) {
      return false;
    }

    // Stop component if running
    if (component.stop) {
      const stopResult = component.stop();
      if (stopResult instanceof Promise) {
        stopResult.catch((error: any) => {
          this.log('error', `Error stopping component '${name}':`, error);
        });
      }
    }

    this.components.delete(name);
    this.log('info', `Component '${name}' unregistered`);
    return true;
  }

  /**
   * Install all registered components
   * @returns Promise that resolves when all components are installed
   */
  public async installAll(): Promise<void> {
    if (!this.app) {
      throw new Error('Component Manager not initialized with application');
    }

    this.log('info', `Installing ${this.components.size} components...`);

    for (const [name, component] of this.components) {
      try {
        await this.installComponent(component);
        this.log('info', `✓ Component '${name}' installed`);
      } catch (error) {
        this.log('error', `✗ Failed to install component '${name}':`, error);
        throw error;
      }
    }

    this.log('info', '✓ All components installed successfully');
  }

  /**
   * Start all components
   * @returns Promise that resolves when all components are started
   */
  public async startAll(): Promise<void> {
    this.log('info', `Starting ${this.components.size} components...`);

    for (const [name, component] of this.components) {
      try {
        if (component.start) {
          await component.start();
          this.log('info', `✓ Component '${name}' started`);
        }
      } catch (error) {
        this.log('error', `✗ Failed to start component '${name}':`, error);
        throw error;
      }
    }

    this.log('info', '✓ All components started successfully');
  }

  /**
   * Stop all components
   * @returns Promise that resolves when all components are stopped
   */
  public async stopAll(): Promise<void> {
    this.log('info', `Stopping ${this.components.size} components...`);

    // Stop components in reverse order
    const componentArray = Array.from(this.components.entries()).reverse();

    for (const [name, component] of componentArray) {
      try {
        if (component.stop) {
          await component.stop();
          this.log('info', `✓ Component '${name}' stopped`);
        }
      } catch (error) {
        this.log('error', `✗ Failed to stop component '${name}':`, error);
        // Continue stopping other components even if one fails
      }
    }

    this.log('info', '✓ All components stopped');
  }

  /**
   * List all registered components
   * @returns Array of registered components
   */
  public list(): InternalPlugin[] {
    return Array.from(this.components.values());
  }

  /**
   * Get component statistics
   * @returns Component statistics
   */
  public getStats(): ComponentStats {
    const components = Array.from(this.components.values());

    return {
      total: components.length,
      registered: components.map((c) => c.name),
      withStartMethod: components.filter((c) => !!c.start).length,
      withStopMethod: components.filter((c) => !!c.stop).length,
    };
  }

  /**
   * Check if a component is registered
   * @param name - Component name
   * @returns True if component is registered
   */
  public has(name: string): boolean {
    return this.components.has(name);
  }

  /**
   * Clear all components (for testing)
   * @internal
   */
  public clear(): void {
    this.components.clear();
    this.log('info', 'All components cleared');
  }

  /**
   * Install a single component
   * @param component - Component to install
   * @private
   */
  private async installComponent(component: InternalPlugin): Promise<void> {
    if (!this.app) {
      throw new Error('Application not available for component installation');
    }

    try {
      if (component.install) {
        await component.install(this.app);
      }
    } catch (error) {
      throw new Error(
        `Failed to install component '${component.name}': ${error}`
      );
    }
  }

  /**
   * Log with component manager prefix
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
    const prefix = '[ComponentManager]';
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
 * Component statistics interface
 */
export interface ComponentStats {
  total: number;
  registered: string[];
  withStartMethod: number;
  withStopMethod: number;
}

/**
 * Create a new component manager instance
 * @returns New component manager
 */
export function createComponentManager(): ComponentManager {
  return new ComponentManager();
}
