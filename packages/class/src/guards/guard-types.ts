/**
 * @nextrush/class - Guard Type Definitions
 *
 * Types for the @UseGuard decorator: the guard context, function and
 * class-based guard contracts, and the stored guard metadata. Also home to the
 * generic Constructor primitive shared with exception-filter types.
 */

/**
 * Constructor type for class-based guards
 */
export type Constructor<T = unknown> = new (...args: unknown[]) => T;

/**
 * Minimal context interface for guards (avoids circular dependency)
 */
export interface GuardContext {
  readonly method: string;
  readonly path: string;
  readonly params: Record<string, string>;
  readonly query: Record<string, string | string[] | undefined>;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body: unknown;
  readonly state: Record<string, unknown>;
  get(name: string): string | undefined;
}

/**
 * Guard function type.
 *
 * Guards determine if a request should proceed to the handler.
 * Return true to allow, false to reject, or throw an error for custom handling.
 */
export type GuardFn = (ctx: GuardContext) => boolean | Promise<boolean>;

/**
 * Interface for class-based guards with dependency injection support.
 *
 * Implement this interface to create guards that can be:
 * - Resolved from the DI container
 * - Injected with dependencies
 * - Unit tested with mock dependencies
 *
 * @example
 * ```typescript
 * import { Service } from '@nextrush/di';
 * import type { CanActivate, GuardContext } from 'nextrush/class';
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
 * ```
 */
export interface CanActivate {
  canActivate(ctx: GuardContext): boolean | Promise<boolean>;
}

/**
 * Guard type that can be either a function or a class implementing CanActivate.
 * Used by @UseGuard decorator to accept both patterns.
 */
export type Guard = GuardFn | Constructor<CanActivate>;

/**
 * Guard metadata stored by @UseGuard decorator
 */
export interface GuardMetadata {
  /** Array of guards (can be functions or class constructors) */
  readonly guards: Guard[];

  /** Whether this is a class or method level guard */
  readonly target: 'class' | 'method';

  /** Method name (only for method-level guards) */
  readonly methodName?: string | symbol;
}
