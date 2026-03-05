/**
 * @nextrush/di - Container
 *
 * Lightweight wrapper around tsyringe with enhanced error handling.
 */

import 'reflect-metadata';
import type { DependencyContainer, InjectionToken } from 'tsyringe';
import { container as tsyContainer } from 'tsyringe';

import type {
  Constructor,
  ContainerInterface,
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
 */
function createContainerWrapper(tsyInstance: DependencyContainer): ContainerInterface {
  const resolutionStack = new Set<string>();
  const factoryTokens = new Set<Token>();
  const bootstrappedValues = new Map<Token, unknown>();

  const wrapper: ContainerInterface = {
    register<T>(token: Token<T>, provider: Provider<T>, options?: RegisterOptions): void {
      const tokenName = getTokenName(token);
      const tsyToken = token as InjectionToken<T>;

      // Invalidate bootstrap cache if re-registering
      bootstrappedValues.delete(token);

      if (isClassProvider(provider)) {
        if (options?.scope === 'singleton') {
          tsyInstance.registerSingleton(tsyToken, provider.useClass);
        } else {
          tsyInstance.register(tsyToken, { useClass: provider.useClass });
        }
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

      // Detect circular dependencies (O(1) lookup with Set)
      if (resolutionStack.has(tokenName)) {
        const cycle = [...resolutionStack, tokenName];
        throw new CircularDependencyError(cycle);
      }

      resolutionStack.add(tokenName);

      try {
        const instance = tsyInstance.resolve<T>(tsyToken);
        resolutionStack.delete(tokenName);
        return instance;
      } catch (error) {
        resolutionStack.delete(tokenName);

        // Re-throw our own errors as-is
        if (error instanceof CircularDependencyError) {
          throw error;
        }

        // Detect tsyringe-internal circular dependencies (stack overflow)
        if (error instanceof RangeError && error.message.includes('Maximum call stack')) {
          const cycle = [...resolutionStack, tokenName];
          throw new CircularDependencyError(cycle);
        }

        // Detect tsyringe "Cannot inject" errors (typically circular deps)
        if (error instanceof Error && error.message.includes('Cannot inject the dependency')) {
          const cycle = [...resolutionStack, tokenName];
          throw new CircularDependencyError(cycle);
        }

        // Enhance error message for missing registrations
        if (error instanceof Error) {
          const message = error.message.toLowerCase();

          if (
            message.includes('not registered') ||
            message.includes('cannot resolve') ||
            message.includes('unregistered dependency')
          ) {
            throw new DependencyResolutionError([...resolutionStack], tokenName);
          }
        }

        throw error;
      }
    },

    async resolveAsync<T>(token: Token<T>): Promise<T> {
      if (bootstrappedValues.has(token)) {
        return bootstrappedValues.get(token) as T;
      }
      const result = wrapper.resolve<T | Promise<T>>(token);
      return result instanceof Promise ? result : result;
    },

    async bootstrap(): Promise<void> {
      for (const token of factoryTokens) {
        if (bootstrappedValues.has(token)) continue;
        const result = wrapper.resolve<unknown>(token);
        const value = result instanceof Promise ? await result : result;
        bootstrappedValues.set(token, value);
      }
      factoryTokens.clear();
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
    },

    createChild(): ContainerInterface {
      const childTsy = tsyInstance.createChildContainer();
      return createContainerWrapper(childTsy);
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
 * container.register('CONFIG', { useValue: { port: 3000 } });
 * ```
 */
export const container: ContainerInterface = createContainerWrapper(tsyContainer);

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
export function createContainer(): ContainerInterface {
  const childTsy = tsyContainer.createChildContainer();
  childTsy.reset();
  return createContainerWrapper(childTsy);
}
