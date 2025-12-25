/**
 * @nextrush/decorators - Route Decorators
 *
 * HTTP method decorators for controller methods.
 * Uses legacy decorators for compatibility with parameter decorators.
 */

import 'reflect-metadata';
import type { RouteMetadata, RouteMethods, RouteOptions } from './types.js';
import { DECORATOR_METADATA_KEYS } from './types.js';

/**
 * Create a route decorator for a specific HTTP method.
 */
function createRouteDecorator(method: RouteMethods) {
  return function routeDecoratorFactory(pathOrOptions?: string | RouteOptions, options?: RouteOptions): MethodDecorator {
    return function routeDecorator(target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor {
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

      const existingRoutes: RouteMetadata[] = Reflect.getMetadata(DECORATOR_METADATA_KEYS.ROUTES, target.constructor) ?? [];

      Reflect.defineMetadata(DECORATOR_METADATA_KEYS.ROUTES, [...existingRoutes, metadata], target.constructor);

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
    return { path: '/', routeOptions: pathOrOptions };
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
export function All(pathOrOptions?: string | RouteOptions, options?: RouteOptions): MethodDecorator {
  return function allDecorator(target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor {
    const methods: RouteMethods[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

    for (const method of methods) {
      createRouteDecorator(method)(pathOrOptions, options)(target, propertyKey, descriptor);
    }

    return descriptor;
  };
}
