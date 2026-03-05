/**
 * @nextrush/di
 *
 * Lightweight dependency injection container for NextRush.
 *
 * Features:
 * - Constructor injection with automatic resolution
 * - Singleton and transient scopes
 * - Circular dependency detection
 * - Production-grade error messages
 * - Full TypeScript support
 *
 * @example
 * ```typescript
 * import { Service, Repository, container, inject } from '@nextrush/di';
 *
 * @Repository()
 * class UserRepository {
 *   findAll() {
 *     return [{ id: 1, name: 'Alice' }];
 *   }
 * }
 *
 * @Service()
 * class UserService {
 *   constructor(private repo: UserRepository) {}
 *
 *   getUsers() {
 *     return this.repo.findAll();
 *   }
 * }
 *
 * // Resolve with automatic dependency injection
 * const userService = container.resolve(UserService);
 * console.log(userService.getUsers());
 * ```
 *
 * @packageDocumentation
 */

// Re-export reflect-metadata for consumers
import 'reflect-metadata';

// Container
export { container, createContainer } from './container.js';

// Decorators
export {
  AutoInjectable,
  Config,
  Injectable,
  Optional,
  Repository,
  Service,
  delay,
  getConfigPrefix,
  getOptionalParams,
  getServiceScope,
  getServiceType,
  hasServiceMetadata,
  inject,
  isParameterOptional,
} from './decorators.js';

// Types
export type {
  ClassProvider,
  ConfigOptions,
  Constructor,
  ContainerInterface,
  FactoryProvider,
  Provider,
  RegisterOptions,
  Scope,
  ServiceOptions,
  Token,
  ValueProvider,
} from './types.js';

export { METADATA_KEYS } from './types.js';

// Errors
export {
  CircularDependencyError,
  ContainerDisposedError,
  DIError,
  DependencyResolutionError,
  InvalidProviderError,
  MissingDependencyError,
  TypeInferenceError,
} from './errors.js';
