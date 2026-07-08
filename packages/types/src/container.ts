/**
 * @nextrush/types - Dependency Injection contract
 *
 * The container contract shared by `@nextrush/di` (implementation),
 * `@nextrush/core` (each app owns one), and consumers. Lives here (the lowest
 * package) so any layer can reference the contract without depending on `di`.
 *
 * @packageDocumentation
 */

/** Constructor type for class-based tokens. */
export type Constructor<T = unknown> = new (...args: unknown[]) => T;

/** Token used to identify a dependency — a class, string, or symbol. */
export type Token<T = unknown> = Constructor<T> | string | symbol;

/** Provider that uses a class constructor. */
export interface ClassProvider<T> {
  useClass: Constructor<T>;
}

/** Provider that uses a factory function (optionally with injected deps). */
export interface FactoryProvider<T> {
  useFactory: (...args: unknown[]) => T | Promise<T>;
  inject?: Token[];
}

/** Provider that uses a constant value. */
export interface ValueProvider<T> {
  useValue: T;
}

/** Union of all provider kinds. */
export type Provider<T> = ClassProvider<T> | FactoryProvider<T> | ValueProvider<T>;

/**
 * Lifecycle scope for registered services.
 *
 * - `'singleton'` — one shared instance for the process lifetime.
 * - `'transient'` — a fresh instance on every resolve.
 * - `'request'` — one instance per request, shared within that request. Backed
 *   by a per-request child container; see RFC-NEXTRUSH-REQUEST-SCOPE.
 */
export type Scope = 'singleton' | 'transient' | 'request';

/** Options for service registration. */
export interface ServiceOptions {
  scope?: Scope;
}

/** Registration options for `Container.register()`. */
export interface RegisterOptions {
  /** Lifecycle scope — defaults to 'transient' if not specified. */
  scope?: Scope;
}

/**
 * Dependency injection container contract.
 *
 * Each NextRush {@link Application} may own one (per-app, not a global
 * singleton). `@nextrush/di` provides the implementation.
 */
export interface Container {
  /** Register a dependency. */
  register<T>(token: Token<T>, provider: Provider<T>, options?: RegisterOptions): void;
  /** Resolve a dependency synchronously. */
  resolve<T>(token: Token<T>): T;
  /** Resolve a dependency that may have been registered with an async factory. */
  resolveAsync<T>(token: Token<T>): Promise<T>;
  /** Bootstrap all factory providers (awaits async factories, caches results). */
  bootstrap(): Promise<void>;
  /** Resolve all dependencies registered under a token. */
  resolveAll<T>(token: Token<T>): T[];
  /** Check if a token is registered. */
  isRegistered<T>(token: Token<T>): boolean;
  /** Clear all registered instances (testing). */
  clearInstances(): void;
  /** Reset the container completely (testing). */
  reset(): void;
  /** Create a child container with isolated scope. */
  createChild(): Container;
}
