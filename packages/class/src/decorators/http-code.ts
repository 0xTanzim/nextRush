/**
 * @nextrush/decorators - @HttpCode Decorator
 *
 * Sets the HTTP status code returned when a controller method resolves with a
 * value. Lives in its own module because `routes.ts` is already at the
 * file-size ceiling.
 */

import { getOwnMetadata, defineMetadata } from '../reflection/reflection.js';
import { DECORATOR_METADATA_KEYS } from '../types.js';

/**
 * Set the HTTP status code for the response when the decorated method returns.
 *
 * Takes precedence over the route decorator's `statusCode` option (e.g.
 * `@Post('/x', { statusCode: 200 })`) when both are present. Does not affect
 * responses produced by a thrown `HttpError` (those keep the error's status)
 * or by `@Redirect` (the redirect status wins).
 *
 * @param statusCode - HTTP status code to apply (e.g. 201, 202, 204)
 *
 * @example
 * ```typescript
 * @Controller('/users')
 * class UserController {
 *   @Post()
 *   @HttpCode(201)
 *   create(@Body() data: CreateUserDto) {
 *     return this.users.create(data); // → 201 Created
 *   }
 * }
 * ```
 */
export function HttpCode(statusCode: number): MethodDecorator {
  return function httpCodeDecorator(
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const methodKey = String(propertyKey);

    const existing: Map<string, number> =
      getOwnMetadata(DECORATOR_METADATA_KEYS.HTTP_CODE, target.constructor) ?? new Map();

    existing.set(methodKey, statusCode);

    defineMetadata(DECORATOR_METADATA_KEYS.HTTP_CODE, existing, target.constructor);

    return descriptor;
  };
}
