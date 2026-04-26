/**
 * @nextrush/decorators - Guard Decorators
 *
 * Guards are functions or classes that determine if a request should be handled.
 * They run BEFORE the route handler and can prevent execution.
 *
 * Use guards for:
 * - Authentication checks
 * - Authorization/permission checks
 * - Rate limiting
 * - Feature flags
 */

import 'reflect-metadata';
import type { Guard, GuardMetadata } from './types.js';
import { DECORATOR_METADATA_KEYS, isGuardClass } from './types.js';

/**
 * Apply guards to a controller or route.
 *
 * Guards run in order and must all pass for the request to proceed.
 * If any guard returns false or throws, the request is rejected.
 *
 * Supports both function-based and class-based guards:
 * - Function guards: Simple functions that receive GuardContext
 * - Class guards: Classes implementing CanActivate interface (resolved from DI)
 *
 * @param guards - Guard functions or classes to apply
 *
 * @example Controller-level guard (applies to all routes)
 * ```typescript
 * @UseGuard(AuthGuard)
 * @Controller('/users')
 * class UserController {
 *   @Get()
 *   findAll() { }  // Protected by AuthGuard
 * }
 * ```
 *
 * @example Route-level guard (applies to specific route)
 * ```typescript
 * @Controller('/users')
 * class UserController {
 *   @Get()
 *   findAll() { }  // Public
 *
 *   @UseGuard(AdminGuard)
 *   @Delete('/:id')
 *   remove(@Param('id') id: string) { }  // Admin only
 * }
 * ```
 *
 * @example Multiple guards (all must pass)
 * ```typescript
 * @UseGuard(AuthGuard, RoleGuard('admin'), RateLimitGuard)
 * @Controller('/admin')
 * class AdminController { }
 * ```
 *
 * @example Function-based guard
 * ```typescript
 * const AuthGuard: GuardFn = async (ctx) => {
 *   const token = ctx.get('authorization');
 *   if (!token) return false;  // Reject
 *
 *   const user = await verifyToken(token);
 *   ctx.state.user = user;  // Attach user to context
 *   return true;  // Allow
 * };
 * ```
 *
 * @example Guard factory for dynamic configuration
 * ```typescript
 * const RoleGuard = (role: string): GuardFn => async (ctx) => {
 *   return ctx.state.user?.role === role;
 * };
 * ```
 *
 * @example Class-based guard with DI
 * ```typescript
 * import { Service } from '@nextrush/di';
 * import type { CanActivate, GuardContext } from '@nextrush/decorators';
 *
 * @Service()
 * class AuthGuard implements CanActivate {
 *   constructor(private authService: AuthService) {}
 *
 *   async canActivate(ctx: GuardContext): Promise<boolean> {
 *     const token = ctx.get('authorization');
 *     if (!token) return false;
 *
 *     const user = await this.authService.verify(token);
 *     ctx.state.user = user;
 *     return Boolean(user);
 *   }
 * }
 *
 * // Usage - class guard is resolved from DI container
 * @UseGuard(AuthGuard)
 * @Controller('/protected')
 * class ProtectedController { }
 * ```
 */
export function UseGuard(...guards: Guard[]): ClassDecorator & MethodDecorator {
  return function guardDecorator(
    target: object | Function,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor
  ): void {
    if (propertyKey !== undefined && descriptor !== undefined) {
      // Method decorator - store on method
      const existingGuards: GuardMetadata[] =
        Reflect.getMetadata(DECORATOR_METADATA_KEYS.GUARDS, target.constructor, propertyKey) ?? [];

      const metadata: GuardMetadata = {
        guards,
        target: 'method',
        methodName: propertyKey,
      };

      Reflect.defineMetadata(
        DECORATOR_METADATA_KEYS.GUARDS,
        [...existingGuards, metadata],
        target.constructor,
        propertyKey
      );
    } else {
      // Class decorator - store on class
      const existingGuards: GuardMetadata[] =
        Reflect.getMetadata(DECORATOR_METADATA_KEYS.GUARDS, target) ?? [];

      const metadata: GuardMetadata = {
        guards,
        target: 'class',
      };

      Reflect.defineMetadata(DECORATOR_METADATA_KEYS.GUARDS, [...existingGuards, metadata], target);
    }
  };
}

/**
 * Get all guards for a controller class.
 *
 * Guards are returned in bottom-to-top decorator application order,
 * matching TypeScript's native decorator execution semantics.
 *
 * @param target - Controller class
 * @returns Array of guards (functions or class constructors)
 */
export function getClassGuards(target: Function): Guard[] {
  const metadata: GuardMetadata[] =
    Reflect.getMetadata(DECORATOR_METADATA_KEYS.GUARDS, target) ?? [];
  return metadata.flatMap((m) => m.guards);
}

/**
 * Get guards for a specific method.
 *
 * Guards are returned in bottom-to-top decorator application order.
 *
 * @param target - Controller class
 * @param methodName - Method name
 * @returns Array of guards (functions or class constructors)
 */
export function getMethodGuards(target: Function, methodName: string | symbol): Guard[] {
  const metadata: GuardMetadata[] =
    Reflect.getMetadata(DECORATOR_METADATA_KEYS.GUARDS, target, methodName) ?? [];
  return metadata.flatMap((m) => m.guards);
}

/**
 * Get all guards for a route (class + method guards combined).
 *
 * Class guards run first, then method guards.
 *
 * @param target - Controller class
 * @param methodName - Method name
 * @returns Array of guards in execution order
 */
export function getAllGuards(target: Function, methodName: string | symbol): Guard[] {
  const classGuards = getClassGuards(target);
  const methodGuards = getMethodGuards(target, methodName);
  return [...classGuards, ...methodGuards];
}

// Re-export type guard for use in controllers plugin
export { isGuardClass };
