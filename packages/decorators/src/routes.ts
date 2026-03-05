/**
 * @nextrush/decorators - Route Decorators
 *
 * HTTP method decorators for controller methods.
 * Uses legacy decorators for compatibility with parameter decorators.
 */

import 'reflect-metadata';
import type {
  RedirectMetadata,
  ResponseHeaderMetadata,
  RouteMetadata,
  RouteMethods,
  RouteOptions,
} from './types.js';
import { DECORATOR_METADATA_KEYS } from './types.js';

/**
 * Create a route decorator for a specific HTTP method.
 */
function createRouteDecorator(method: RouteMethods) {
  return function routeDecoratorFactory(
    pathOrOptions?: string | RouteOptions,
    options?: RouteOptions
  ): MethodDecorator {
    return function routeDecorator(
      target: object,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor
    ): PropertyDescriptor {
      const { path, routeOptions } = normalizeRouteInput(pathOrOptions, options);

      const metadata: RouteMetadata = {
        method,
        path,
        methodName: propertyKey,
        propertyKey,
        middleware: routeOptions?.middleware,
        statusCode: routeOptions?.statusCode,
        description: routeOptions?.description,
        deprecated: routeOptions?.deprecated,
      };

      const existingRoutes: RouteMetadata[] =
        Reflect.getOwnMetadata(DECORATOR_METADATA_KEYS.ROUTES, target.constructor) ?? [];

      Reflect.defineMetadata(
        DECORATOR_METADATA_KEYS.ROUTES,
        [...existingRoutes, metadata],
        target.constructor
      );

      return descriptor;
    };
  };
}

/**
 * Normalize route decorator input to path and options.
 */
function normalizeRouteInput(
  pathOrOptions?: string | RouteOptions,
  options?: RouteOptions
): { path: string; routeOptions?: RouteOptions } {
  if (typeof pathOrOptions === 'string') {
    return { path: normalizePath(pathOrOptions), routeOptions: options };
  }

  if (pathOrOptions && typeof pathOrOptions === 'object') {
    const path = pathOrOptions.path ? normalizePath(pathOrOptions.path) : '/';
    return { path, routeOptions: pathOrOptions };
  }

  return { path: '/', routeOptions: options };
}

/**
 * Normalize path to ensure proper format.
 */
function normalizePath(path: string): string {
  let normalized = path.trim();

  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  return normalized;
}

/**
 * @Get decorator - Marks a method as handling HTTP GET requests.
 *
 * @example
 * ```typescript
 * @Controller('/users')
 * class UserController {
 *   @Get()
 *   findAll() { }
 *
 *   @Get('/:id')
 *   findOne(@Param('id') id: string) { }
 *
 *   @Get('/search', { description: 'Search users' })
 *   search(@Query('q') query: string) { }
 * }
 * ```
 */
export const Get = createRouteDecorator('GET');

/**
 * @Post decorator - Marks a method as handling HTTP POST requests.
 *
 * @example
 * ```typescript
 * @Controller('/users')
 * class UserController {
 *   @Post()
 *   create(@Body() data: CreateUserDto) { }
 *
 *   @Post('/bulk', { statusCode: 201 })
 *   createMany(@Body() users: CreateUserDto[]) { }
 * }
 * ```
 */
export const Post = createRouteDecorator('POST');

/**
 * @Put decorator - Marks a method as handling HTTP PUT requests.
 *
 * @example
 * ```typescript
 * @Controller('/users')
 * class UserController {
 *   @Put('/:id')
 *   update(@Param('id') id: string, @Body() data: UpdateUserDto) { }
 * }
 * ```
 */
export const Put = createRouteDecorator('PUT');

/**
 * @Delete decorator - Marks a method as handling HTTP DELETE requests.
 *
 * @example
 * ```typescript
 * @Controller('/users')
 * class UserController {
 *   @Delete('/:id')
 *   remove(@Param('id') id: string) { }
 * }
 * ```
 */
export const Delete = createRouteDecorator('DELETE');

/**
 * @Patch decorator - Marks a method as handling HTTP PATCH requests.
 *
 * @example
 * ```typescript
 * @Controller('/users')
 * class UserController {
 *   @Patch('/:id')
 *   partialUpdate(@Param('id') id: string, @Body() data: Partial<User>) { }
 * }
 * ```
 */
export const Patch = createRouteDecorator('PATCH');

/**
 * @Head decorator - Marks a method as handling HTTP HEAD requests.
 *
 * @example
 * ```typescript
 * @Controller('/files')
 * class FileController {
 *   @Head('/:id')
 *   checkExists(@Param('id') id: string) { }
 * }
 * ```
 */
export const Head = createRouteDecorator('HEAD');

/**
 * @Options decorator - Marks a method as handling HTTP OPTIONS requests.
 *
 * @example
 * ```typescript
 * @Controller('/api')
 * class ApiController {
 *   @Options()
 *   cors() { }
 * }
 * ```
 */
export const Options = createRouteDecorator('OPTIONS');

/**
 * @All decorator - Marks a method as handling all HTTP methods.
 * This creates multiple route entries for the same handler.
 *
 * @example
 * ```typescript
 * @Controller('/proxy')
 * class ProxyController {
 *   @All('/*')
 *   handle(@Ctx() ctx: Context) { }
 * }
 * ```
 */
export function All(
  pathOrOptions?: string | RouteOptions,
  options?: RouteOptions
): MethodDecorator {
  return function allDecorator(
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const methods: RouteMethods[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

    for (const method of methods) {
      createRouteDecorator(method)(pathOrOptions, options)(target, propertyKey, descriptor);
    }

    return descriptor;
  };
}

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
      Reflect.getOwnMetadata(DECORATOR_METADATA_KEYS.RESPONSE_HEADERS, target.constructor) ??
      new Map();

    const headers = existing.get(methodKey) ?? [];
    headers.push({ name, value });
    existing.set(methodKey, headers);

    Reflect.defineMetadata(DECORATOR_METADATA_KEYS.RESPONSE_HEADERS, existing, target.constructor);

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
      Reflect.getOwnMetadata(DECORATOR_METADATA_KEYS.REDIRECT, target.constructor) ?? new Map();

    existing.set(methodKey, { url, statusCode });

    Reflect.defineMetadata(DECORATOR_METADATA_KEYS.REDIRECT, existing, target.constructor);

    return descriptor;
  };
}
