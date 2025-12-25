/**
 * @nextrush/di - Decorators
 *
 * Injectable decorators for marking classes as DI-managed services.
 * Uses legacy TypeScript decorators for maximum compatibility with tsyringe.
 */

import 'reflect-metadata';
import {
    delay as tsyDelay,
    inject as tsyInject,
    injectable as tsyInjectable,
    singleton as tsySingleton,
} from 'tsyringe';

import { METADATA_KEYS, type Constructor, type Scope, type ServiceOptions } from './types.js';

/**
 * Mark a class as injectable service.
 *
 * Services are singletons by default - one instance shared across the application.
 *
 * @param options - Optional configuration for the service
 *
 * @example
 * ```typescript
 * @Service()
 * export class UserService {
 *   async findAll() {
 *     return [{ id: 1, name: 'Alice' }];
 *   }
 * }
 *
 * // With transient scope (new instance each time)
 * @Service({ scope: 'transient' })
 * export class RequestLogger {
 *   constructor() {
 *     this.timestamp = Date.now();
 *   }
 * }
 * ```
 */
export function Service(options: ServiceOptions = {}): ClassDecorator {
  const scope: Scope = options.scope ?? 'singleton';

  return function <TFunction extends Function>(target: TFunction): TFunction | void {
    // Store metadata for smart discovery
    Reflect.defineMetadata(METADATA_KEYS.SERVICE_TYPE, 'service', target);
    Reflect.defineMetadata(METADATA_KEYS.SERVICE_SCOPE, scope, target);

    // Apply tsyringe decorator based on scope
    if (scope === 'singleton') {
      tsySingleton()(target as unknown as Constructor);
    } else {
      tsyInjectable()(target as unknown as Constructor);
    }
  };
}

/**
 * Mark a class as a repository (data access layer).
 *
 * Semantically identical to @Service(), but indicates the class is for data access.
 * Repositories are singletons by default.
 *
 * @param options - Optional configuration for the repository
 *
 * @example
 * ```typescript
 * @Repository()
 * export class UserRepository {
 *   async findById(id: string) {
 *     return db.users.findUnique({ where: { id } });
 *   }
 * }
 * ```
 */
export function Repository(options: ServiceOptions = {}): ClassDecorator {
  const scope: Scope = options.scope ?? 'singleton';

  return function <TFunction extends Function>(target: TFunction): TFunction | void {
    Reflect.defineMetadata(METADATA_KEYS.SERVICE_TYPE, 'repository', target);
    Reflect.defineMetadata(METADATA_KEYS.SERVICE_SCOPE, scope, target);

    if (scope === 'singleton') {
      tsySingleton()(target as unknown as Constructor);
    } else {
      tsyInjectable()(target as unknown as Constructor);
    }
  };
}

/**
 * Explicitly inject a dependency by token.
 *
 * Use this when:
 * - Injecting an interface (TypeScript can't infer interface types at runtime)
 * - Using string or symbol tokens
 * - The automatic type inference doesn't work
 *
 * @param token - The token to inject (class, string, or symbol)
 *
 * @example
 * ```typescript
 * @Service()
 * export class UserService {
 *   constructor(
 *     // Inject by interface token
 *     @inject('IUserRepository') private repo: IUserRepository,
 *
 *     // Inject by string token
 *     @inject('DATABASE_URL') private dbUrl: string
 *   ) {}
 * }
 * ```
 */
export function inject(token: unknown): ParameterDecorator {
  return tsyInject(token as never);
}

/**
 * Make a class auto-injectable.
 *
 * Allows instantiation with `new` while still supporting auto-injection.
 * Dependencies are optional - if not provided, they're resolved from the container.
 *
 * @example
 * ```typescript
 * @AutoInjectable()
 * export class FeatureService {
 *   constructor(private logger?: Logger) {}
 * }
 *
 * // Can instantiate with new - logger is auto-injected
 * const service = new FeatureService();
 *
 * // Or provide manually
 * const service2 = new FeatureService(customLogger);
 * ```
 */
export function AutoInjectable(): ClassDecorator {
  return function <TFunction extends Function>(target: TFunction): TFunction | void {
    Reflect.defineMetadata(METADATA_KEYS.SERVICE_TYPE, 'service', target);
    // Note: tsyringe's autoInjectable is imported separately if needed
    tsyInjectable()(target as unknown as Constructor);
  };
}

/**
 * Delay resolution of a dependency.
 *
 * Use this to break circular dependencies by lazily resolving the dependency.
 *
 * @param token - Factory function returning the class to inject
 *
 * @example
 * ```typescript
 * @Service()
 * class UserService {
 *   constructor(
 *     @inject(delay(() => OrderService)) private orderService: OrderService
 *   ) {}
 * }
 *
 * @Service()
 * class OrderService {
 *   constructor(
 *     @inject(delay(() => UserService)) private userService: UserService
 *   ) {}
 * }
 * ```
 */
export function delay<T>(tokenFactory: () => new (...args: unknown[]) => T): unknown {
  return tsyDelay(tokenFactory);
}

/**
 * Check if a class has DI metadata (is decorated with @Service or @Repository).
 *
 * @param target - The class to check
 * @returns True if the class has DI metadata
 */
export function hasServiceMetadata(target: Function): boolean {
  return Reflect.hasMetadata(METADATA_KEYS.SERVICE_TYPE, target);
}

/**
 * Get the service type from a decorated class.
 *
 * @param target - The class to check
 * @returns The service type ('service' | 'repository') or undefined
 */
export function getServiceType(target: Function): string | undefined {
  return Reflect.getMetadata(METADATA_KEYS.SERVICE_TYPE, target);
}

/**
 * Get the scope from a decorated class.
 *
 * @param target - The class to check
 * @returns The scope ('singleton' | 'transient') or undefined
 */
export function getServiceScope(target: Function): Scope | undefined {
  return Reflect.getMetadata(METADATA_KEYS.SERVICE_SCOPE, target);
}
