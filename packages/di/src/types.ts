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
 *
 * Without `inject`: factory receives the container.
 * With `inject`: factory receives resolved dependencies in order.
 *
 * @example Without inject
 * ```typescript
 * container.register('DB', {
 *   useFactory: (c) => new Database(c.resolve(ConfigService).dbUrl),
 * });
 * ```
 *
 * @example With inject
 * ```typescript
 * container.register('DB', {
 *   useFactory: (config: ConfigService) => new Database(config.dbUrl),
 *   inject: [ConfigService],
 * });
 * ```
 *
 * @example Async factory (auto-resolved by bootstrap)
 * ```typescript
 * container.register('DB', {
 *   useFactory: async (config: ConfigService) => {
 *     const db = new Database(config.dbUrl);
 *     await db.connect();
 *     return db;
 *   },
 *   inject: [ConfigService],
 * });
 * // Controllers plugin calls bootstrap() automatically.
 * // For functional mode: await container.bootstrap()
 * ```
 */
export interface FactoryProvider<T> {
  useFactory: (...args: unknown[]) => T | Promise<T>;
  inject?: Token[];
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
   *
   * @param token - The token to register
   * @param provider - The provider (class, value, or factory)
   * @param options - Optional registration options
   */
  register<T>(token: Token<T>, provider: Provider<T>, options?: RegisterOptions): void;

  /**
   * Resolve a dependency from the container (synchronous).
   */
  resolve<T>(token: Token<T>): T;

  /**
   * Resolve a dependency that may have been registered with an async factory.
   * Awaits the result if the factory returns a Promise.
   *
   * Prefer `bootstrap()` over calling this for each async provider.
   */
  resolveAsync<T>(token: Token<T>): Promise<T>;

  /**
   * Bootstrap all factory providers.
   *
   * Resolves every factory-registered provider, awaiting any Promises,
   * and caches results for synchronous access via `resolve()`.
   *
   * Called automatically by the controllers plugin during `install()`.
   * For functional mode, call once before handling requests.
   *
   * @example
   * ```typescript
   * container.register('DB', {
   *   useFactory: async () => { const db = new Database(); await db.connect(); return db; },
   * });
   * await container.bootstrap(); // All async providers resolved
   * container.resolve('DB');     // Works synchronously now
   * ```
   */
  bootstrap(): Promise<void>;

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
  CONFIG_PREFIX: 'di:config:prefix',
  OPTIONAL_PARAMS: 'di:optional',
} as const;

/**
 * Options for @Config decorator.
 */
export interface ConfigOptions {
  /**
   * Environment variable prefix.
   *
   * When set, the configuration class can be used with prefix-based env loading.
   *
   * @example
   * ```typescript
   * @Config({ prefix: 'DB' })
   * class DatabaseConfig {
   *   readonly host = 'localhost';  // reads DB_HOST
   *   readonly port = 5432;         // reads DB_PORT
   * }
   * ```
   */
  prefix?: string;
}

/**
 * Service types for metadata.
 */
export type ServiceType = 'service' | 'repository' | 'controller' | 'config';

/**
 * Registration options for container.register().
 */
export interface RegisterOptions {
  /** Lifecycle scope — defaults to 'transient' if not specified */
  scope?: Scope;
}
