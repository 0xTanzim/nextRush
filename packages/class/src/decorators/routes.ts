/**
 * @nextrush/decorators - Route Decorators
 *
 * HTTP method decorators for controller methods.
 * Uses legacy decorators for compatibility with parameter decorators.
 */

import { getOwnMetadata, defineMetadata } from '../reflection/reflection.js';
import { normalizePath } from '../path-utils.js';
import type { RouteMetadata, RouteMethods, RouteOptions } from '../types.js';
import { DECORATOR_METADATA_KEYS } from '../types.js';

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
        getOwnMetadata(DECORATOR_METADATA_KEYS.ROUTES, target.constructor) ?? [];

      defineMetadata(
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
 * Registers a single any-method route entry (T016) — matched by every
 * standard HTTP method via the router's own `Router.all()`/`GroupRouter.all()`
 * ANY-method registration, rather than one explicit RouteMetadata entry per
 * enumerated method. `getRoutes()`/route introspection sees one row for an
 * `@All()` route, consistent with how it was actually authored.
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
export const All = createRouteDecorator('ALL');
