import type { CanActivate, GuardContext, GuardFn } from '@nextrush/decorators';
import { Service } from '@nextrush/di';

/**
 * Simple function guard — checks for Authorization header.
 */
export const AuthGuard: GuardFn = (ctx: GuardContext): boolean => {
  const auth = ctx.get('authorization');
  return Boolean(auth);
};

/**
 * Token for role configuration injection.
 */
export const REQUIRED_ROLE = Symbol('REQUIRED_ROLE');

/**
 * Class-based guard with DI — checks for admin role.
 * Demonstrates class guards resolved from the DI container.
 */
@Service()
export class AdminGuard implements CanActivate {
  canActivate(ctx: GuardContext): boolean {
    const auth = ctx.get('authorization');
    // Simple check: "Bearer admin-token" grants admin access
    return auth === 'Bearer admin-token';
  }
}
