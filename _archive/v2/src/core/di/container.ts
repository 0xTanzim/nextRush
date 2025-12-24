/**
 * NextRush DI Container Implementation
 *
 * High-performance dependency injection container with:
 * - Zero external dependencies
 * - Type-safe service registration and resolution
 * - Singleton and transient lifecycles
 * - Circular dependency detection
 *
 * @packageDocumentation
 */

import { CircularDependencyDetector } from './circular-detector';
import type {
  ContainerStats,
  DIContainer,
  InternalStats,
  ServiceDescriptor,
} from './types';
import { ServiceLifetime } from './types';

// Re-export types for backward compatibility
export { ServiceLifetime } from './types';
export type { ContainerStats, DIContainer, ServiceDescriptor } from './types';

/**
 * High-performance DI Container implementation
 *
 * @example
 * ```typescript
 * const container = new NextRushContainer();
 *
 * // Register a singleton service
 * container.singleton('config', () => ({ port: 3000 }));
 *
 * // Register with dependencies
 * container.singleton('logger', (config) => new Logger(config), ['config']);
 *
 * // Resolve services
 * const logger = container.resolve('logger');
 * ```
 */
export class NextRushContainer implements DIContainer {
  private services = new Map<string | symbol, ServiceDescriptor>();
  private singletonInstances = new Map<string | symbol, unknown>();
  private circularDetector = new CircularDependencyDetector();
  private stats: InternalStats = {
    resolutions: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  /**
   * Register a service with the container
   */
  register<T>(descriptor: ServiceDescriptor<T>): void {
    if (this.services.has(descriptor.token)) {
      throw new Error(
        `Service with token '${String(descriptor.token)}' is already registered`
      );
    }

    this.services.set(descriptor.token, descriptor);
  }

  /**
   * Register a singleton service
   */
  singleton<T>(
    token: string | symbol,
    factory: (...args: any[]) => T,
    dependencies: (string | symbol)[] = []
  ): void {
    this.register({
      token,
      factory,
      lifetime: ServiceLifetime.SINGLETON,
      dependencies,
    });
  }

  /**
   * Register a transient service
   */
  transient<T>(
    token: string | symbol,
    factory: (...args: any[]) => T,
    dependencies: (string | symbol)[] = []
  ): void {
    this.register({
      token,
      factory,
      lifetime: ServiceLifetime.TRANSIENT,
      dependencies,
    });
  }

  /**
   * Resolve a service from the container
   */
  resolve<T>(token: string | symbol): T {
    this.stats.resolutions++;

    const descriptor = this.services.get(token);
    if (!descriptor) {
      throw new Error(
        `Service with token '${String(token)}' is not registered`
      );
    }

    // Check for singleton instance
    if (descriptor.lifetime === ServiceLifetime.SINGLETON) {
      if (this.singletonInstances.has(token)) {
        this.stats.cacheHits++;
        return this.singletonInstances.get(token) as T;
      }
      this.stats.cacheMisses++;
    }

    // Resolve with circular dependency detection
    this.circularDetector.enterResolution(token);

    try {
      // Resolve dependencies
      const resolvedDependencies = (descriptor.dependencies ?? []).map(dep =>
        this.resolve(dep)
      );

      // Create instance
      const instance = descriptor.factory(...resolvedDependencies);

      // Cache singleton
      if (descriptor.lifetime === ServiceLifetime.SINGLETON) {
        this.singletonInstances.set(token, instance);
      }

      return instance as T;
    } finally {
      this.circularDetector.exitResolution();
    }
  }

  /**
   * Check if a service is registered
   */
  isRegistered(token: string | symbol): boolean {
    return this.services.has(token);
  }

  /**
   * Clear all services and instances
   */
  clear(): void {
    this.services.clear();
    this.singletonInstances.clear();
    this.circularDetector.reset();
    this.stats = {
      resolutions: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  /**
   * Get container statistics
   */
  getStats(): ContainerStats {
    const total = this.stats.cacheHits + this.stats.cacheMisses;
    return {
      totalServices: this.services.size,
      singletonInstances: this.singletonInstances.size,
      resolutions: this.stats.resolutions,
      cacheHitRate: total === 0 ? 0 : this.stats.cacheHits / total,
    };
  }

  /**
   * Advanced: Register a class constructor with automatic dependency injection
   */
  registerClass<T>(
    token: string | symbol,
    constructor: new (...args: any[]) => T,
    lifetime: ServiceLifetime = ServiceLifetime.SINGLETON,
    dependencies: (string | symbol)[] = []
  ): void {
    this.register({
      token,
      factory: (...args: any[]) => new constructor(...args),
      lifetime,
      dependencies,
    });
  }

  /**
   * Advanced: Register a value directly (useful for configuration)
   */
  registerValue<T>(token: string | symbol, value: T): void {
    this.register({
      token,
      factory: () => value,
      lifetime: ServiceLifetime.SINGLETON,
      dependencies: [],
    });
  }
}

// Re-export service tokens from tokens.ts
export { createToken, SERVICE_TOKENS } from './tokens';
export type { ServiceToken } from './tokens';

/**
 * Create a new DI container instance
 */
export function createContainer(): DIContainer {
  return new NextRushContainer();
}

/**
 * Default global container instance
 */
export const globalContainer = createContainer();
