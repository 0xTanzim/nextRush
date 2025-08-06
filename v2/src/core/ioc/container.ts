/**
 * IoC Container Configuration for NextRush v2
 * 
 * @packageDocumentation
 */

import 'reflect-metadata';
import { container, DependencyContainer, Lifecycle } from 'tsyringe';
import type { ApplicationOptions } from '@/types/http';
import type { Context } from '@/types/context';

/**
 * IoC Container Configuration
 * Manages dependency injection for the NextRush framework
 */
export class IoCContainer {
  private static instance: IoCContainer;
  private container: DependencyContainer;

  private constructor() {
    this.container = container.createChildContainer();
    this.registerCoreServices();
  }

  /**
   * Get singleton instance of IoC container
   */
  public static getInstance(): IoCContainer {
    if (!IoCContainer.instance) {
      IoCContainer.instance = new IoCContainer();
    }
    return IoCContainer.instance;
  }

  /**
   * Get the underlying tsyringe container
   */
  public getContainer(): DependencyContainer {
    return this.container;
  }

  /**
   * Register core services with the container
   */
  private registerCoreServices(): void {
    // Register services with appropriate lifecycle
    this.container.register('ApplicationOptions', {
      useValue: {},
    });

    this.container.register('ContextFactory', {
      useClass: require('../app/context-factory').ContextFactory,
    }, { lifecycle: Lifecycle.Singleton });

    this.container.register('RouterService', {
      useClass: require('../router/router-service').RouterService,
    }, { lifecycle: Lifecycle.Singleton });

    this.container.register('MiddlewareFactory', {
      useClass: require('../middleware/middleware-factory').MiddlewareFactory,
    }, { lifecycle: Lifecycle.Singleton });

    this.container.register('ConfigurationService', {
      useClass: require('../config/configuration-service').ConfigurationService,
    }, { lifecycle: Lifecycle.Singleton });
  }

  /**
   * Configure application options
   */
  public configure(options: ApplicationOptions): void {
    this.container.register('ApplicationOptions', {
      useValue: options,
    });
  }

  /**
   * Resolve a dependency from the container
   */
  public resolve<T>(token: string): T {
    return this.container.resolve<T>(token);
  }

  /**
   * Register a dependency with the container
   */
  public register<T>(token: string, implementation: any, options?: any): void {
    this.container.register(token, implementation, options);
  }

  /**
   * Clear the container (useful for testing)
   */
  public clear(): void {
    this.container.clearInstances();
  }
}

/**
 * Global container instance
 */
export const iocContainer = IoCContainer.getInstance();

/**
 * Helper function to resolve dependencies
 */
export function resolve<T>(token: string): T {
  return iocContainer.resolve<T>(token);
}

/**
 * Helper function to register dependencies
 */
export function register<T>(token: string, implementation: any, options?: any): void {
  iocContainer.register(token, implementation, options);
} 