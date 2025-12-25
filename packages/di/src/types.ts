/**
 * @nextrush/di - Types
 *
 * Type definitions for the dependency injection container.
 */

/**
 * Token used to identify a dependency in the container.
 * Can be a class constructor, string, or symbol.
 */
export type Token<T = unknown> = Constructor<T> | string | symbol;

/**
 * Constructor type for class-based tokens.
 */
export type Constructor<T = unknown> = new (...args: unknown[]) => T;

/**
 * Provider that uses a class constructor.
 */
export interface ClassProvider<T> {
  useClass: Constructor<T>;
}

/**
 * Provider that uses a factory function.
 */
export interface FactoryProvider<T> {
  useFactory: (container: ContainerInterface) => T;
}

/**
 * Provider that uses a constant value.
 */
export interface ValueProvider<T> {
  useValue: T;
}

/**
 * Union of all provider types.
 */
export type Provider<T> = ClassProvider<T> | FactoryProvider<T> | ValueProvider<T>;

/**
 * Lifecycle scope for registered services.
 */
export type Scope = 'singleton' | 'transient';

/**
 * Options for service registration.
 */
export interface ServiceOptions {
  scope?: Scope;
}

/**
 * Container interface for dependency injection operations.
 */
export interface ContainerInterface {
  /**
   * Register a dependency with the container.
   */
  register<T>(token: Token<T>, provider: Provider<T>): void;

  /**
   * Resolve a dependency from the container.
   */
  resolve<T>(token: Token<T>): T;

  /**
   * Resolve all dependencies registered under a token.
   */
  resolveAll<T>(token: Token<T>): T[];

  /**
   * Check if a token is registered.
   */
  isRegistered<T>(token: Token<T>): boolean;

  /**
   * Clear all registered instances (useful for testing).
   */
  clearInstances(): void;

  /**
   * Reset the container completely (useful for testing).
   */
  reset(): void;

  /**
   * Create a child container with isolated scope.
   */
  createChild(): ContainerInterface;
}

/**
 * Metadata key constants.
 */
export const METADATA_KEYS = {
  SERVICE_TYPE: 'di:type',
  SERVICE_SCOPE: 'di:scope',
  INJECT_TOKEN: 'di:inject',
  PARAM_TYPES: 'design:paramtypes',
} as const;

/**
 * Service types for metadata.
 */
export type ServiceType = 'service' | 'repository' | 'controller';
