/**
 * @nextrush/decorators - Module Decorator
 *
 * `@Module` records a feature's composition — its imported modules, controllers,
 * providers, and exports — as reflect-metadata. It is a grouping/composition
 * unit; the `@nextrush/controllers` `registerModule` registrar reads this
 * metadata to wire the whole module graph in one call.
 *
 * This layer stores metadata only. Provider registration, route building, and
 * (future) encapsulation live in the controllers layer — see
 * RFC-NEXTRUSH-MODULES.
 */

import { markInjectable } from '@nextrush/di';
import { defineMetadata, getOwnMetadata, hasOwnMetadata } from '../reflection/reflection.js';
import { DECORATOR_METADATA_KEYS } from '../metadata/metadata-keys.js';
import type { ModuleMetadata, ModuleOptions } from './module-types.js';

/**
 * Marks a class as a NextRush module.
 *
 * @param options - The module's imports, controllers, providers, and exports.
 * @returns Class decorator
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [BillingModule],
 *   controllers: [UserController],
 *   providers: [UserService, { provide: 'CONFIG', useValue: cfg }],
 *   exports: [UserService],
 * })
 * class UserModule {}
 * ```
 */
export function Module(options: ModuleOptions = {}): ClassDecorator {
  return function moduleDecorator<TFunction extends Function>(target: TFunction): TFunction {
    const metadata: ModuleMetadata = {
      imports: [...(options.imports ?? [])],
      controllers: [...(options.controllers ?? [])],
      providers: [...(options.providers ?? [])],
      exports: [...(options.exports ?? [])],
    };

    defineMetadata(DECORATOR_METADATA_KEYS.MODULE, metadata, target);

    // Mark injectable for symmetry with @Controller so a module class can itself
    // participate in DI graph walks without special-casing.
    markInjectable(target as unknown as new (...args: unknown[]) => unknown);

    return target;
  };
}

/**
 * Check if a class carries `@Module` metadata.
 */
export function isModule(target: Function): boolean {
  return hasOwnMetadata(DECORATOR_METADATA_KEYS.MODULE, target);
}

/**
 * Read a module's metadata. Returns a defensive copy (fresh arrays) so callers
 * cannot mutate the stored record. Returns `undefined` when `target` is not a
 * module.
 */
export function getModuleMetadata(target: Function): ModuleMetadata | undefined {
  const meta: ModuleMetadata | undefined = getOwnMetadata(
    DECORATOR_METADATA_KEYS.MODULE,
    target
  );

  if (!meta) {
    return undefined;
  }

  return {
    imports: [...meta.imports],
    controllers: [...meta.controllers],
    providers: [...meta.providers],
    exports: [...meta.exports],
  };
}
