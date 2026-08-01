/**
 * @nextrush/class - Module Type Definitions
 *
 * Metadata and options shapes for the @Module decorator. A module groups a
 * feature's imports, controllers, and providers behind one registration entry
 * point. `exports` is captured for future per-module encapsulation (see
 * RFC-NEXTRUSH-MODULES §5) and is not enforced today.
 */

import type { Constructor, Scope, Token } from '@nextrush/di';

/**
 * A provider config: register `provide` using one of `useClass` / `useValue` /
 * `useFactory`. Exactly one of the three `use*` forms should be set.
 *
 * - `useClass` — construct the given class (DI-injected).
 * - `useValue` — bind a constant value (scope is ignored).
 * - `useFactory` — call the factory; `inject` lists tokens resolved and passed
 *   to it as arguments (in order).
 *
 * `scope` defaults to `'singleton'` for class/factory providers.
 */
export interface ModuleProviderConfig {
  /** Token the provider is registered under (class, string, or symbol). */
  provide: Token;

  /** Construct this class to satisfy the token. */
  useClass?: Constructor;

  /** Bind this constant value to the token. */
  useValue?: unknown;

  /** Call this factory to produce the value. */
  useFactory?: (...args: unknown[]) => unknown;

  /** Tokens resolved and passed (in order) as arguments to `useFactory`. */
  inject?: Token[];

  /** Lifecycle scope. Defaults to `'singleton'` for class/factory providers. */
  scope?: Scope;
}

/**
 * A module provider is either a bare class constructor (registered with its
 * declared `@Service` scope, or `singleton` if undecorated) or a full provider
 * config.
 */
export type ModuleProvider = Function | ModuleProviderConfig;

/**
 * Options for the @Module decorator.
 */
export interface ModuleOptions {
  /** Other `@Module` classes this module composes. */
  imports?: Function[];

  /** `@Controller` classes owned by this module. */
  controllers?: Function[];

  /** Providers (services/values/factories) this module registers. */
  providers?: ModuleProvider[];

  /**
   * Providers this module makes visible to importers. Recorded now for future
   * per-module encapsulation; not enforced yet (see RFC-NEXTRUSH-MODULES §5).
   */
  exports?: Function[];
}

/**
 * Normalized module metadata stored by @Module. Every field is defaulted to an
 * empty array so readers never return `undefined` collections.
 */
export interface ModuleMetadata {
  readonly imports: Function[];
  readonly controllers: Function[];
  readonly providers: ModuleProvider[];
  readonly exports: Function[];
}
