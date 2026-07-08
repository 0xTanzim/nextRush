/**
 * @nextrush/decorators - Response Decorators
 *
 * Method decorators that shape the HTTP response: @SetHeader attaches response
 * headers and @Redirect declares a redirect. Stored as reflect-metadata read by
 * the controllers handler builder.
 */

import { getOwnMetadata, defineMetadata } from '../reflection/reflection.js';
import type { RedirectMetadata, ResponseHeaderMetadata } from '../types.js';
import { DECORATOR_METADATA_KEYS } from '../types.js';

/**
 * Set a response header on the decorated method.
 *
 * Multiple `@SetHeader()` decorators can be stacked on the same method.
 *
 * @param name  - Header name (e.g., 'Cache-Control')
 * @param value - Header value (e.g., 'no-cache')
 *
 * @example
 * ```typescript
 * @Controller('/files')
 * class FileController {
 *   @Get('/:id')
 *   @SetHeader('Cache-Control', 'max-age=3600')
 *   @SetHeader('X-Custom', 'value')
 *   getFile(@Param('id') id: string) {
 *     return { id };
 *   }
 * }
 * ```
 */
export function SetHeader(name: string, value: string): MethodDecorator {
  return function setHeaderDecorator(
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const methodKey = String(propertyKey);

    const existing: Map<string, ResponseHeaderMetadata[]> =
      getOwnMetadata(DECORATOR_METADATA_KEYS.RESPONSE_HEADERS, target.constructor) ??
      new Map();

    const headers = existing.get(methodKey) ?? [];
    headers.push({ name, value });
    existing.set(methodKey, headers);

    defineMetadata(DECORATOR_METADATA_KEYS.RESPONSE_HEADERS, existing, target.constructor);

    return descriptor;
  };
}

/**
 * Redirect the response when the decorated method is called.
 *
 * If the method returns a string, it overrides the decorator's URL.
 * If the method returns an object with `url` and/or `statusCode`, those override as well.
 *
 * @param url        - Default redirect URL
 * @param statusCode - HTTP status code (default: 302)
 *
 * @example
 * ```typescript
 * @Controller('/legacy')
 * class LegacyController {
 *   @Get('/old-page')
 *   @Redirect('/new-page', 301)
 *   redirectOld() {
 *     // Optional: return a string to override the URL
 *   }
 *
 *   @Get('/dynamic')
 *   @Redirect('/fallback')
 *   dynamicRedirect() {
 *     // Return a string to redirect elsewhere
 *     return '/actual-destination';
 *   }
 * }
 * ```
 */
export function Redirect(url: string, statusCode = 302): MethodDecorator {
  return function redirectDecorator(
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const methodKey = String(propertyKey);

    const existing: Map<string, RedirectMetadata> =
      getOwnMetadata(DECORATOR_METADATA_KEYS.REDIRECT, target.constructor) ?? new Map();

    existing.set(methodKey, { url, statusCode });

    defineMetadata(DECORATOR_METADATA_KEYS.REDIRECT, existing, target.constructor);

    return descriptor;
  };
}
