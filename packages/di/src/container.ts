/**
 * @nextrush/di - Container
 *
 * Lightweight wrapper around tsyringe with enhanced error handling.
 */

import type { DependencyContainer, InjectionToken } from 'tsyringe';
import { container as tsyContainer, Lifecycle } from 'tsyringe';

import type {
    Constructor,
    Container,
    FactoryProvider,
    Provider,
    RegisterOptions,
    Token,
} from './types.js';

import {
    CircularDependencyError,
    DependencyResolutionError,
    InvalidProviderError,
} from './errors.js';

import { getServiceScope } from './decorators.js';

/**
 * Get a human-readable name for a token.
 */
function getTokenName(token: Token): string {
  if (typeof token === 'string') return token;
  if (typeof token === 'symbol') return token.toString();
  if (typeof token === 'function') return token.name || 'Anonymous';
  return String(token);
}

/**
 * Check if a provider uses a class constructor.
 */
function isClassProvider<T>(provider: Provider<T>): provider is { useClass: Constructor<T> } {
  return 'useClass' in provider && typeof provider.useClass === 'function';
}

/**
 * Check if a provider uses a value.
 */
function isValueProvider<T>(provider: Provider<T>): provider is { useValue: T } {
  return 'useValue' in provider;
}

/**
 * Check if a provider uses a factory.
 */
function isFactoryProvider<T>(provider: Provider<T>): provider is FactoryProvider<T> {
  return 'useFactory' in provider && typeof provider.useFactory === 'function';
}

/**
 * Create a container wrapper with enhanced error handling.
 *
 * @param sharedState - Cycle-detection state to reuse instead of starting fresh.
 *   Passed by `createChild()` so a child container's resolutions are checked
 *   against the SAME resolutionStack/guardedTokens as its parent — cycle
 *   detection is a property of the underlying tsyringe registration graph
 *   (which a child inherits/delegates to via createChildContainer), not of
 *   which wrapper object happens to be calling resolve(). Without sharing this,
 *   a token registered on the parent but resolved through a child would guard
 *   against the wrong (child's, empty) Set while the interceptor — registered
 *   on the parent's tsyInstance at register() time — pushes onto the parent's
 *   Set, leaking state the child's own snapshot/restore never touches.
 */
function createContainerWrapper(
  tsyInstance: DependencyContainer,
  sharedState?: {
    resolutionStack: Set<string>;
    factoryTokens: Set<Token>;
    bootstrappedValues: Map<Token, unknown>;
    guardedTokens: Set<Token>;
  }
): Container {
  const resolutionStack = sharedState?.resolutionStack ?? new Set<string>();
  const factoryTokens = sharedState?.factoryTokens ?? new Set<Token>();
  const bootstrappedValues = sharedState?.bootstrappedValues ?? new Map<Token, unknown>();
  // Tokens with a beforeResolution/afterResolution guard already wired (see
  // registerCycleGuard below) — prevents double-registering the interceptor pair
  // on repeated register() calls for the same token, which would double-push/pop
  // resolutionStack and desync the count.
  const guardedTokens = sharedState?.guardedTokens ?? new Set<Token>();

  /**
   * Makes the fast Set-based cycle guard apply to tsyringe's OWN internal
   * constructor-injection recursion, not just the wrapper.resolve() re-entry path
   * factory providers already use.
   *
   * useClass providers never call back into wrapper.resolve() — tsyringe resolves
   * the whole constructor graph itself (construct() -> resolveParams() ->
   * resolve(), recursively), so resolutionStack's checks at the top of
   * wrapper.resolve() never fire for this path. tsyringe's beforeResolution/
   * afterResolution interceptors DO fire on every one of those internal recursive
   * resolve() calls (dependency-container.js executePreResolutionInterceptor is
   * called from inside resolve() itself), so wiring the same resolutionStack Set
   * through them closes the gap: a cycle is now caught on the next recursive call,
   * not after tens of thousands of stack frames.
   */
  function registerCycleGuard(token: Token, tsyToken: InjectionToken): void {
    if (guardedTokens.has(token)) return;
    guardedTokens.add(token);

    const tokenName = getTokenName(token);
    tsyInstance.beforeResolution(
      tsyToken,
      () => {
        if (resolutionStack.has(tokenName)) {
          const cycle = [...resolutionStack, tokenName];
          throw new CircularDependencyError(cycle);
        }
        resolutionStack.add(tokenName);
      },
      { frequency: 'Always' }
    );
    tsyInstance.afterResolution(
      tsyToken,
      () => {
        resolutionStack.delete(tokenName);
      },
      { frequency: 'Always' }
    );
  }

  const wrapper: Container = {
    register<T>(token: Token<T>, provider: Provider<T>, options?: RegisterOptions): void {
      const tokenName = getTokenName(token);
      const tsyToken = token as InjectionToken<T>;

      // Invalidate bootstrap cache if re-registering
      bootstrappedValues.delete(token);

      if (isClassProvider(provider)) {
        // Scope defaults are unified on 'singleton'. An explicit `options.scope` wins;
        // otherwise the class's declared `di:scope` metadata is the single source of
        // truth (getServiceScope defaults undecorated classes to 'singleton').
        const scope = options?.scope ?? getServiceScope(provider.useClass);
        if (scope === 'singleton') {
          tsyInstance.registerSingleton(tsyToken, provider.useClass);
        } else if (scope === 'request') {
          // Request scope → tsyringe ContainerScoped: one instance per container.
          // A per-request child (`createChild()`) constructs its own instance and
          // shares it within that request; singletons stay on the parent. See
          // RFC-NEXTRUSH-REQUEST-SCOPE.
          tsyInstance.register(
            tsyToken,
            { useClass: provider.useClass },
            { lifecycle: Lifecycle.ContainerScoped }
          );
        } else {
          tsyInstance.register(tsyToken, { useClass: provider.useClass });
        }
        registerCycleGuard(token, tsyToken);
      } else if (isValueProvider(provider)) {
        tsyInstance.register(tsyToken, { useValue: provider.useValue });
      } else if (isFactoryProvider(provider)) {
        const { inject: injectTokens } = provider;
        factoryTokens.add(token);

        if (injectTokens && injectTokens.length > 0) {
          tsyInstance.register(tsyToken, {
            useFactory: () => {
              const deps = injectTokens.map((depToken) => wrapper.resolve(depToken));
              const hasAsyncDep = deps.some((d) => d instanceof Promise);
              if (hasAsyncDep) {
                return Promise.all(deps).then((resolved) => provider.useFactory(...resolved));
              }
              return provider.useFactory(...deps);
            },
          });
        } else {
          tsyInstance.register(tsyToken, {
            useFactory: () => provider.useFactory(wrapper),
          });
        }
      } else {
        throw new InvalidProviderError(tokenName);
      }
    },

    resolve<T>(token: Token<T>): T {
      // Return bootstrapped value if available (async factory already resolved)
      if (bootstrappedValues.has(token)) {
        return bootstrappedValues.get(token) as T;
      }

      const tokenName = getTokenName(token);
      const tsyToken = token as InjectionToken<T>;
      // useClass tokens are guarded by the beforeResolution/afterResolution pair
      // (registerCycleGuard) instead — that pair fires on every one of tsyringe's
      // internal recursive resolve() calls too, not just this outer one, so it owns
      // the push/pop for those tokens. Pushing here AS WELL would double-count the
      // outermost call (this resolve() entry) against the interceptor's own push,
      // producing a false-positive cycle on the very first, non-recursive resolution.
      //
      // Note: a class decorated with tsyringe's own @singleton()/@injectable()
      // (which is what @Service()/@Repository()/@Config() call directly — see
      // service-decorators.ts) is registered with tsyringe WITHOUT ever going
      // through wrapper.register(), so guardedTokens never gets it added and this
      // is correctly false for that case; it falls through to the manual push/pop
      // guard below instead, same as it did before the interceptor guard existed.
      const guardedByInterceptor = guardedTokens.has(token);

      // Snapshot BEFORE either guard path pushes anything, so finally's restore
      // below undoes exactly what THIS call added — regardless of which of the two
      // paths (interceptor-owned or manual) did the pushing.
      const stackSnapshot = [...resolutionStack];

      // Detect circular dependencies (O(1) lookup with Set) — only for tokens the
      // interceptor pair does not already own (value providers, tokens with no
      // registered class, resolveAll-only tokens, and any token registered via
      // tsyringe's own decorators rather than wrapper.register()).
      if (!guardedByInterceptor) {
        if (resolutionStack.has(tokenName)) {
          const cycle = [...resolutionStack, tokenName];
          throw new CircularDependencyError(cycle);
        }
        resolutionStack.add(tokenName);
      }

      // On any exit (success OR failure, at any nesting depth) restore
      // resolutionStack to exactly its pre-call contents — afterResolution only
      // fires on a SUCCESSFUL resolve(), so a cycle/failure several constructor-
      // injection frames deep would otherwise leave every frame between the failure
      // and this call's entry stuck in resolutionStack forever, misreporting every
      // later resolve() of those tokens as a false-positive cycle. Restoring the
      // snapshot on the way out — rather than trusting each frame's own pop to have
      // run — is correct regardless of how many guarded frames recursed underneath,
      // since only one top-level call is ever in flight at a time (single JS thread).

      try {
        return tsyInstance.resolve<T>(tsyToken);
      } catch (error) {
        // Re-throw our own errors as-is
        if (error instanceof CircularDependencyError) {
          throw error;
        }

        const message = error instanceof Error ? error.message.toLowerCase() : '';

        // Missing / unregistered dependency → resolution error. This MUST be checked
        // before any "Cannot inject" heuristic below: tsyringe wraps a missing
        // *constructor* dependency in a message containing BOTH "Cannot inject the
        // dependency" AND "unregistered dependency token", so checking "Cannot inject"
        // first would misreport a genuine missing dep as a circular dependency.
        if (
          error instanceof Error &&
          (message.includes('not registered') ||
            message.includes('cannot resolve') ||
            message.includes('unregistered'))
        ) {
          throw new DependencyResolutionError([...resolutionStack], tokenName);
        }

        // True cycle signals, in order of confidence:
        //  (a) tsyringe recursion blew the JS stack (RangeError / "maximum call stack");
        //  (b) the message explicitly names a circular/cyclic dependency;
        //  (c) a nested "Cannot inject the dependency" chain with NO missing-token signal
        //      (the missing-token case was already handled above) — tsyringe's shape for a
        //      cycle where every participant IS registered.
        const isStackOverflow =
          (error instanceof RangeError && error.message.includes('Maximum call stack')) ||
          message.includes('maximum call stack');
        if (
          isStackOverflow ||
          message.includes('circular') ||
          message.includes('cyclic') ||
          message.includes('cannot inject the dependency')
        ) {
          const cycle = [...resolutionStack, tokenName];
          throw new CircularDependencyError(cycle);
        }

        throw error;
      } finally {
        resolutionStack.clear();
        for (const name of stackSnapshot) resolutionStack.add(name);
      }
    },

    async resolveAsync<T>(token: Token<T>): Promise<T> {
      if (bootstrappedValues.has(token)) {
        return bootstrappedValues.get(token) as T;
      }
      const result = wrapper.resolve<T | Promise<T>>(token);
      return await result;
    },

    async bootstrap(): Promise<void> {
      // Re-runnable by design: the global container can be shared across multiple apps
      // / registration cycles in one process (createApp + registerControllers reuse), so
      // bootstrap() must stay idempotent AND keep processing factories registered after
      // an earlier bootstrap(). We therefore DO NOT clear factoryTokens — already
      // bootstrapped factories are skipped via the bootstrappedValues cache, and any
      // factory whose cache was dropped (clearInstances) or registered later is
      // (re-)resolved on the next call. Iterate a snapshot so a factory that registers
      // another factory during resolution cannot mutate the set mid-iteration.
      for (const token of [...factoryTokens]) {
        if (bootstrappedValues.has(token)) continue;
        const result = wrapper.resolve<unknown>(token);
        const value = result instanceof Promise ? await result : result;
        bootstrappedValues.set(token, value);
      }
    },

    resolveAll<T>(token: Token<T>): T[] {
      const tsyToken = token as InjectionToken<T>;
      try {
        return tsyInstance.resolveAll<T>(tsyToken);
      } catch (error: unknown) {
        // Only swallow "unregistered" errors — token genuinely has no registrations
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('unregistered')) {
          return [];
        }
        throw error;
      }
    },

    isRegistered<T>(token: Token<T>): boolean {
      const tsyToken = token as InjectionToken<T>;
      return tsyInstance.isRegistered(tsyToken);
    },

    clearInstances(): void {
      tsyInstance.clearInstances();
      bootstrappedValues.clear();
    },

    reset(): void {
      tsyInstance.reset();
      bootstrappedValues.clear();
      factoryTokens.clear();
      resolutionStack.clear();
      guardedTokens.clear();
    },

    createChild(): Container {
      const childTsy = tsyInstance.createChildContainer();
      return createContainerWrapper(childTsy, {
        resolutionStack,
        factoryTokens,
        bootstrappedValues,
        guardedTokens,
      });
    },
  };

  return wrapper;
}

/**
 * The global DI container instance.
 *
 * Use this for registering and resolving dependencies throughout your application.
 *
 * @example
 * ```typescript
 * // Register a service
 * container.register(UserService, { useClass: UserService });
 *
 * // Resolve a service
 * const userService = container.resolve(UserService);
 *
 * // Register with value
 * container.register('CONFIG', { useValue: { port: 8080 } });
 * ```
 */
export const container: Container = createContainerWrapper(tsyContainer);

/**
 * Create a new isolated container.
 *
 * Useful for testing or creating scoped containers.
 * Note: Creates a child container from the global tsyringe container.
 * For truly isolated containers, reset the child before use.
 *
 * @example
 * ```typescript
 * const testContainer = createContainer();
 * testContainer.register(UserService, { useClass: MockUserService });
 * ```
 */
export function createContainer(): Container {
  const childTsy = tsyContainer.createChildContainer();
  childTsy.reset();
  return createContainerWrapper(childTsy);
}
