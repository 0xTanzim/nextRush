/**
 * Base Component class - provides common functionality for all components
 * Based on old codebase patterns but modernized for new architecture
 */

import { 
  MinimalApplication, 
  InternalPlugin, 
  ComponentContext, 
  Logger, 
  EventEmitter 
} from './interfaces';

/**
 * Simple logger implementation for components
 */
class ComponentLogger implements Logger {
  constructor(private componentName: string) {}

  debug(message: string, ...args: any[]): void {
    console.debug(`[${this.componentName}] ${message}`, ...args);
  }

  info(message: string, ...args: any[]): void {
    console.info(`[${this.componentName}] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[${this.componentName}] ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[${this.componentName}] ${message}`, ...args);
  }
}

/**
 * Simple event emitter implementation for components
 */
class ComponentEventEmitter implements EventEmitter {
  private listeners = new Map<string, Set<(...args: any[]) => void>>();

  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }
}

/**
 * Base component class that all components should extend
 * Provides common functionality like logging, events, and lifecycle management
 */
export abstract class BaseComponent implements InternalPlugin {
  /**
   * Component name - must be implemented by subclasses
   */
  abstract readonly name: string;

  /**
   * Component version - optional
   */
  readonly version?: string;

  /**
   * Component dependencies - optional
   */
  readonly dependencies?: string[];

  /**
   * Application instance
   */
  protected app?: MinimalApplication;

  /**
   * Component logger
   */
  protected logger: Logger;

  /**
   * Component event emitter
   */
  protected events: EventEmitter;

  /**
   * Component configuration
   */
  protected config: Record<string, any> = {};

  /**
   * Component context
   */
  protected context?: ComponentContext;

  constructor(name?: string) {
    this.logger = new ComponentLogger(name || 'BaseComponent');
    this.events = new ComponentEventEmitter();
  }

  /**
   * Set the application instance
   */
  protected setApp(app: MinimalApplication): void {
    this.app = app;
    this.context = {
      app,
      logger: this.logger,
      events: this.events,
      config: this.config
    };
  }

  /**
   * Log a message with the specified level
   */
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    this.logger[level](message, ...args);
  }

  /**
   * Emit an event
   */
  protected emit(event: string, ...args: any[]): void {
    this.events.emit(event, ...args);
  }

  /**
   * Listen to an event
   */
  protected on(event: string, listener: (...args: any[]) => void): void {
    this.events.on(event, listener);
  }

  /**
   * Remove an event listener
   */
  protected off(event: string, listener: (...args: any[]) => void): void {
    this.events.off(event, listener);
  }

  /**
   * Get configuration value
   */
  protected getConfig<T = any>(key: string, defaultValue?: T): T {
    return this.config[key] ?? defaultValue;
  }

  /**
   * Set configuration value
   */
  protected setConfig(key: string, value: any): void {
    this.config[key] = value;
  }

  /**
   * Update configuration with object - made public for registry access
   */
  updateConfig(config: Record<string, any>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Install component into application - must be implemented by subclasses
   */
  abstract install(app: MinimalApplication): void | Promise<void>;

  /**
   * Start component - optional lifecycle method
   */
  async start(): Promise<void> {
    this.log('debug', `Starting component: ${this.name}`);
  }

  /**
   * Stop component - optional lifecycle method
   */
  async stop(): Promise<void> {
    this.log('debug', `Stopping component: ${this.name}`);
  }

  /**
   * Get component status
   */
  getStatus(): { name: string; version?: string | undefined; config: Record<string, any> } {
    return {
      name: this.name,
      version: this.version,
      config: { ...this.config }
    };
  }

  /**
   * Validate component configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    // Default implementation - can be overridden by subclasses
    return { valid: true, errors: [] };
  }

  /**
   * Create error with component context - made public for registry access
   */
  createError(message: string, phase: 'install' | 'start' | 'stop', originalError?: Error): Error {
    const error = new Error(`[${this.name}] ${message}`);
    (error as any).component = this.name;
    (error as any).phase = phase;
    (error as any).originalError = originalError;
    return error;
  }
}

/**
 * Factory function to create component instances
 */
export function createComponent<T extends BaseComponent>(
  ComponentClass: new () => T,
  config?: Record<string, any>
): T {
  const component = new ComponentClass();
  if (config) {
    component.updateConfig(config);
  }
  return component;
}

/**
 * Component registry for managing multiple components
 */
export class ComponentRegistry {
  private components = new Map<string, BaseComponent>();

  /**
   * Register a component
   */
  register(component: BaseComponent, config?: Record<string, any>): void {
    if (this.components.has(component.name)) {
      throw new Error(`Component ${component.name} is already registered`);
    }

    if (config) {
      component.updateConfig(config);
    }

    this.components.set(component.name, component);
  }

  /**
   * Unregister a component
   */
  unregister(name: string): boolean {
    return this.components.delete(name);
  }

  /**
   * Get a component by name
   */
  get(name: string): BaseComponent | undefined {
    return this.components.get(name);
  }

  /**
   * Get all registered components
   */
  getAll(): BaseComponent[] {
    return Array.from(this.components.values());
  }

  /**
   * Check if component is registered
   */
  isRegistered(name: string): boolean {
    return this.components.has(name);
  }

  /**
   * Start all components
   */
  async start(): Promise<void> {
    for (const component of this.components.values()) {
      try {
        await component.start();
      } catch (error) {
        console.error(`Failed to start component ${component.name}:`, error);
        throw component.createError('Failed to start', 'start', error as Error);
      }
    }
  }

  /**
   * Stop all components
   */
  async stop(): Promise<void> {
    const components = Array.from(this.components.values()).reverse();
    for (const component of components) {
      try {
        await component.stop();
      } catch (error) {
        console.error(`Failed to stop component ${component.name}:`, error);
      }
    }
  }

  /**
   * Get component count
   */
  size(): number {
    return this.components.size;
  }

  /**
   * Clear all components
   */
  clear(): void {
    this.components.clear();
  }
}
