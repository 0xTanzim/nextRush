/**
 * @nextrush/di - Service Decorators
 *
 * Decorators that mark classes as DI-managed services and write their metadata.
 */

import { singleton as tsySingleton, injectable as tsyInjectable } from 'tsyringe';
import { METADATA_KEYS, type Constructor, type Scope, type ServiceOptions } from './types.js';

/** Decorator-compatible constructor type. Uses `never[]` so any class is structurally assignable. */
type DecoratorTarget = new (...args: never[]) => unknown;

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
export function Service(options: ServiceOptions = {}) {
  const scope: Scope = options.scope ?? 'singleton';

  return (target: DecoratorTarget): void => {
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
export function Repository(options: ServiceOptions = {}) {
  const scope: Scope = options.scope ?? 'singleton';

  return (target: DecoratorTarget): void => {
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
 * Mark a class as a configuration holder.
 *
 * Configuration classes are always singletons and serve as centralized
 * configuration containers for your application. Similar to Spring Boot's
 * `@Configuration` / `@ConfigurationProperties`.
 *
 * @param options - Optional configuration (e.g., env prefix)
 *
 * @example
 * ```typescript
 * // Simple configuration class
 * @Config()
 * export class AppConfig {
 *   readonly port = Number(process.env.PORT ?? 8080);
 *   readonly host = process.env.HOST ?? 'localhost';
 * }
 *
 * // With env prefix — documents that this config reads DB_* vars
 * @Config({ prefix: 'DB' })
 * export class DatabaseConfig {
 *   readonly host = process.env.DB_HOST ?? 'localhost';
 *   readonly port = Number(process.env.DB_PORT ?? 5432);
 *   readonly name = process.env.DB_NAME ?? 'mydb';
 * }
 *
 * // Inject into services
 * @Service()
 * export class UserService {
 *   constructor(private config: DatabaseConfig) {}
 *
 *   getConnectionString() {
 *     return `postgres://${this.config.host}:${this.config.port}/${this.config.name}`;
 *   }
 * }
 * ```
 */
export function Config(options: import('./types.js').ConfigOptions = {}) {
  return (target: DecoratorTarget): void => {
    Reflect.defineMetadata(METADATA_KEYS.SERVICE_TYPE, 'config', target);
    Reflect.defineMetadata(METADATA_KEYS.SERVICE_SCOPE, 'singleton', target);

    if (options.prefix) {
      Reflect.defineMetadata(METADATA_KEYS.CONFIG_PREFIX, options.prefix, target);
    }

    // Configuration classes are always singletons
    tsySingleton()(target as unknown as Constructor);
  };
}
