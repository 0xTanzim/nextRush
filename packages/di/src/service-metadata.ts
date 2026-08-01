/**
 * @nextrush/di - Service Metadata Readers
 *
 * Functions to read service metadata written by decorators.
 */

import { METADATA_KEYS, type Scope } from './types.js';

/**
 * Check if a class has DI metadata (is decorated with @Service or @Repository).
 *
 * @param target - The class to check
 * @returns True if the class has DI metadata
 */
export function hasServiceMetadata(target: object): boolean {
  return Reflect.hasMetadata(METADATA_KEYS.SERVICE_TYPE, target);
}

/**
 * Get the service type from a decorated class.
 *
 * @param target - The class to check
 * @returns The service type ('service' | 'repository') or undefined
 */
export function getServiceType(target: object): string | undefined {
  return Reflect.getMetadata(METADATA_KEYS.SERVICE_TYPE, target) as string | undefined;
}

/**
 * Get the declared scope of a class — the single source of truth for service scope.
 *
 * Scope defaults are unified on `'singleton'`: `@Service()`, `@Repository()`, and
 * `@Config()` all declare `singleton` unless `{ scope: 'transient' }` is passed, and an
 * undecorated class (no `di:scope` metadata) is treated as `singleton` too. The
 * low-level {@link Container.register} reads this value so a class's declared scope —
 * not the call site — decides singleton vs transient.
 *
 * @param target - The class to check
 * @returns The declared scope (`'singleton'` | `'transient'`); `'singleton'` when undeclared
 */
export function getServiceScope(target: object): Scope {
  return (Reflect.getMetadata(METADATA_KEYS.SERVICE_SCOPE, target) as Scope | undefined) ??
    'singleton';
}

/**
 * Get the config prefix from a @Config-decorated class.
 *
 * @param target - The class to check
 * @returns The prefix string or undefined
 */
export function getConfigPrefix(target: object): string | undefined {
  return Reflect.getMetadata(METADATA_KEYS.CONFIG_PREFIX, target) as string | undefined;
}
