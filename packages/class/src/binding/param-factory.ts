/**
 * @nextrush/class - Parameter decorator factory helpers
 *
 * Shared machinery behind the standard parameter decorators: the source-specific
 * decorator factory, input normalization, and the read-append-write of parameter
 * metadata (all reflect-metadata access routed through reflection.ts). Extracted
 * from param-decorators.ts so that file stays focused on the decorator surface.
 */

import type { ParamMetadata, ParamSource, TransformFn } from '../types.js';
import { DECORATOR_METADATA_KEYS } from '../types.js';
import { defineMetadata, getOwnMetadata } from '../reflection/reflection.js';

/**
 * Create a parameter decorator for a specific source.
 */
export function createParamDecorator<
  TOptions extends { transform?: TransformFn; required?: boolean; defaultValue?: unknown },
>(source: ParamSource, defaultRequired: boolean) {
  return function paramDecoratorFactory(
    nameOrOptions?: string | TOptions,
    options?: TOptions
  ): ParameterDecorator {
    return function paramDecorator(
      target: object,
      propertyKey: string | symbol | undefined,
      parameterIndex: number
    ): void {
      if (propertyKey === undefined) {
        throw new Error(
          `Parameter decorator @${source.charAt(0).toUpperCase() + source.slice(1)} can only be used on method parameters, not constructor parameters.`
        );
      }

      const { name, paramOptions } = normalizeParamInput(nameOrOptions, options, source);

      const metadata: ParamMetadata = {
        source,
        index: parameterIndex,
        name,
        required: paramOptions?.required ?? defaultRequired,
        defaultValue: paramOptions?.defaultValue,
        transform: paramOptions?.transform,
      };

      pushParamMetadata(target, propertyKey, metadata);
    };
  };
}

/**
 * Normalize parameter decorator input.
 */
function normalizeParamInput<TOptions>(
  nameOrOptions: string | TOptions | undefined,
  options: TOptions | undefined,
  source: ParamSource
): { name?: string; paramOptions?: TOptions } {
  if (typeof nameOrOptions === 'string') {
    return { name: nameOrOptions, paramOptions: options };
  }

  if (nameOrOptions && typeof nameOrOptions === 'object') {
    return { paramOptions: nameOrOptions };
  }

  if (source === 'body' || source === 'ctx' || source === 'req' || source === 'res') {
    return { paramOptions: options };
  }

  return { paramOptions: options };
}

/**
 * Append parameter metadata for a method onto its controller class.
 *
 * Uses `getOwnMetadata` so a subclass never inherits a parent's parameter map.
 * Shared by every parameter decorator to avoid duplicating the read-append-write
 * dance against reflect-metadata.
 */
export function pushParamMetadata(
  target: object,
  propertyKey: string | symbol,
  metadata: ParamMetadata
): void {
  const methodKey = `${String(propertyKey)}`;

  const existingParams: Map<string, ParamMetadata[]> =
    getOwnMetadata<Map<string, ParamMetadata[]>>(DECORATOR_METADATA_KEYS.PARAMS, target.constructor) ?? new Map();

  const methodParams = existingParams.get(methodKey) ?? [];
  methodParams.push(metadata);
  existingParams.set(methodKey, methodParams);

  defineMetadata(DECORATOR_METADATA_KEYS.PARAMS, existingParams, target.constructor);
}
