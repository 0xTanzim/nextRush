/**
 * @nextrush/class - Custom Parameter Decorator Factory
 *
 * User-defined parameter extractors for custom injection patterns.
 */

import type {
  CustomParamExtractor,
  ParamMetadata,
  TransformFn,
} from '../types.js';
import { DECORATOR_METADATA_KEYS } from '../types.js';
import { getOwnMetadata, defineMetadata } from '../reflection/reflection.js';

/**
 * Append parameter metadata for a method onto its controller class.
 *
 * Uses `getOwnMetadata` so a subclass never inherits a parent's parameter map.
 * Shared by every parameter decorator to avoid duplicating the read-append-write
 * dance against reflect-metadata.
 */
function pushParamMetadata(
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

/**
 * Create a custom parameter decorator with a user-defined extraction function.
 *
 * The extractor receives the request context and returns the value to inject
 * into the handler parameter. Supports both sync and async extractors.
 *
 * @param extractor - Function that extracts the parameter value from context
 * @param options - Optional transform and required settings
 *
 * @example
 * ```typescript
 * // Extract the authenticated user from state
 * const CurrentUser = createCustomParamDecorator(
 *   (ctx) => ctx.state.user
 * );
 *
 * // Extract a specific cookie
 * const Cookie = (name: string) => createCustomParamDecorator(
 *   (ctx) => ctx.get('cookie')?.split(';')
 *     .find(c => c.trim().startsWith(name + '='))
 *     ?.split('=')[1]
 * );
 *
 * @Controller('/users')
 * class UserController {
 *   @Get('/me')
 *   getProfile(@CurrentUser user: User) {
 *     return user;
 *   }
 * }
 * ```
 */
export function createCustomParamDecorator(
  extractor: CustomParamExtractor,
  options?: { transform?: TransformFn; required?: boolean }
): ParameterDecorator {
  return function customParamDecorator(
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void {
    if (propertyKey === undefined) {
      throw new Error(
        'Custom parameter decorator can only be used on method parameters, not constructor parameters.'
      );
    }

    const metadata: ParamMetadata = {
      source: 'custom',
      index: parameterIndex,
      required: options?.required ?? false,
      transform: options?.transform,
      customExtractor: extractor,
    };

    pushParamMetadata(target, propertyKey, metadata);
  };
}
