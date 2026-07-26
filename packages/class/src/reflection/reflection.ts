/**
 * @nextrush/class - Reflection API Isolation
 *
 * Single point of contact for all Reflect.getMetadata, Reflect.defineMetadata,
 * and design:paramtypes reads. Isolates reflection plumbing from business logic.
 */

/**
 * Read the constructor parameter types emitted by TypeScript's `emitDecoratorMetadata`.
 * Returns an empty array if metadata is not present (e.g., under esbuild/tsx without
 * the metadata plugin).
 *
 * This is the ONLY place in the package that reads `design:paramtypes` directly.
 * All other code requests parameter types through this helper.
 *
 * @internal For cross-package DI use, re-export from index.ts as getConstructorParamTypes.
 */
export function getConstructorParamTypes(target: Function): unknown[] {
  const DESIGN_PARAMTYPES = 'design:paramtypes';
  return (Reflect.getMetadata(DESIGN_PARAMTYPES, target) as unknown[] | undefined) ?? [];
}

/**
 * Read metadata by key, supporting both own and inherited metadata.
 * Supports both 2-arg form (target only) and 3-arg form (target + propertyKey).
 * @internal Used by metadata readers.
 */
export function getMetadata<T>(
  key: string | symbol,
  target: object,
  propertyKey?: string | symbol
): T | undefined {
  if (propertyKey !== undefined) {
    return Reflect.getMetadata(key, target, propertyKey) as T | undefined;
  }
  return Reflect.getMetadata(key, target) as T | undefined;
}

/**
 * Read metadata only from the target's own properties, not inherited.
 * @internal Used by metadata writers to avoid parent-child collisions.
 */
export function getOwnMetadata<T>(key: string | symbol, target: object): T | undefined {
  return Reflect.getOwnMetadata(key, target) as T | undefined;
}

/**
 * Define metadata on a target, replacing any prior value at this key.
 * Supports both 3-arg form (target only) and 4-arg form (target + propertyKey).
 * @internal Used by all decorator metadata writes.
 */
export function defineMetadata(
  key: string | symbol,
  value: unknown,
  target: object,
  propertyKey?: string | symbol
): void {
  if (propertyKey !== undefined) {
    Reflect.defineMetadata(key, value, target, propertyKey);
  } else {
    Reflect.defineMetadata(key, value, target);
  }
}

/**
 * Read all metadata keys defined on a target.
 * @internal Used for exhaustive metadata enumeration.
 */
export function getMetadataKeys(target: object): (string | symbol)[] {
  return Reflect.getMetadataKeys(target);
}

/**
 * Check if metadata with a specific key exists on a target's own properties
 * (not inherited).
 * @internal Used by module and metadata checks.
 */
export function hasOwnMetadata(key: string | symbol, target: object): boolean {
  return Reflect.hasOwnMetadata(key, target);
}
