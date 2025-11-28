/**
 * Type definitions for NextRush v2 Dependency Injection System
 *
 * @packageDocumentation
 */

/**
 * Service lifecycle options
 */
export enum ServiceLifetime {
  /** New instance created on each resolution */
  TRANSIENT = 'transient',
  /** Single instance shared across all resolutions */
  SINGLETON = 'singleton',
  /** Instance created once per request scope */
  SCOPED = 'scoped',
}

/**
 * Service descriptor for registration
 */
export interface ServiceDescriptor<T = unknown> {
  /** Service identifier token */
  token: string | symbol;
  /** Factory function to create the service */
  factory: (...args: unknown[]) => T;
  /** Service lifetime */
  lifetime: ServiceLifetime;
  /** Dependencies to inject into factory */
  dependencies?: (string | symbol)[];
}

/**
 * Container interface for dependency injection
 */
export interface DIContainer {
  /** Register a service with the container */
  register<T>(descriptor: ServiceDescriptor<T>): void;

  /** Register a singleton service */
  singleton<T>(
    token: string | symbol,
    factory: (...args: unknown[]) => T,
    dependencies?: (string | symbol)[]
  ): void;

  /** Register a transient service */
  transient<T>(
    token: string | symbol,
    factory: (...args: unknown[]) => T,
    dependencies?: (string | symbol)[]
  ): void;

  /** Resolve a service from the container */
  resolve<T>(token: string | symbol): T;

  /** Check if a service is registered */
  isRegistered(token: string | symbol): boolean;

  /** Clear all services */
  clear(): void;

  /** Get container statistics */
  getStats(): ContainerStats;
}

/**
 * Container statistics for monitoring
 */
export interface ContainerStats {
  /** Total number of registered services */
  totalServices: number;
  /** Number of singleton instances created */
  singletonInstances: number;
  /** Number of resolutions performed */
  resolutions: number;
  /** Cache hit rate for singletons */
  cacheHitRate: number;
}

/**
 * Internal statistics tracking
 */
export interface InternalStats {
  resolutions: number;
  cacheHits: number;
  cacheMisses: number;
}
