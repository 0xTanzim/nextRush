/**
 * @nextrush/di - Container
 *
 * Lightweight wrapper around tsyringe with enhanced error handling.
 */

import 'reflect-metadata';
import type {
    DependencyContainer,
    InjectionToken,
} from 'tsyringe';
import {
    container as tsyContainer,
} from 'tsyringe';

import type {
    Constructor,
    ContainerInterface,
    Provider,
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
function isFactoryProvider<T>(
  provider: Provider<T>
): provider is { useFactory: (c: ContainerInterface) => T } {
  return 'useFactory' in provider && typeof provider.useFactory === 'function';
}

/**
 * Create a container wrapper with enhanced error handling.
 */
function createContainerWrapper(tsyInstance: DependencyContainer): ContainerInterface {
  const resolutionStack: string[] = [];

  const wrapper: ContainerInterface = {
    register<T>(token: Token<T>, provider: Provider<T>): void {
      const tokenName = getTokenName(token);
      const tsyToken = token as InjectionToken<T>;

      if (isClassProvider(provider)) {
        tsyInstance.register(tsyToken, { useClass: provider.useClass });
      } else if (isValueProvider(provider)) {
        tsyInstance.register(tsyToken, { useValue: provider.useValue });
      } else if (isFactoryProvider(provider)) {
        tsyInstance.register(tsyToken, {
          useFactory: () => provider.useFactory(wrapper),
        });
      } else {
        throw new InvalidProviderError(tokenName);
      }
    },

    resolve<T>(token: Token<T>): T {
      const tokenName = getTokenName(token);
      const tsyToken = token as InjectionToken<T>;

      // Detect circular dependencies
      if (resolutionStack.includes(tokenName)) {
        const cycle = [...resolutionStack, tokenName];
        throw new CircularDependencyError(cycle);
      }

      resolutionStack.push(tokenName);

      try {
        const instance = tsyInstance.resolve<T>(tsyToken);
        resolutionStack.pop();
        return instance;
      } catch (error) {
        resolutionStack.pop();

        // Enhance error message
        if (error instanceof Error) {
          const message = error.message.toLowerCase();

          if (message.includes('not registered') || message.includes('cannot resolve')) {
            throw new DependencyResolutionError(
              resolutionStack.slice(),
              tokenName
            );
          }
        }

        throw error;
      }
    },

    resolveAll<T>(token: Token<T>): T[] {
      const tsyToken = token as InjectionToken<T>;
      try {
        return tsyInstance.resolveAll<T>(tsyToken);
      } catch {
        return [];
      }
    },

    isRegistered<T>(token: Token<T>): boolean {
      const tsyToken = token as InjectionToken<T>;
      return tsyInstance.isRegistered(tsyToken);
    },

    clearInstances(): void {
      tsyInstance.clearInstances();
    },

    reset(): void {
      tsyInstance.reset();
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
