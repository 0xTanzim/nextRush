/**
 * @nextrush/decorators - Service Lifecycle Hook Type Definitions
 *
 * Two duck-typed behavioral interfaces — `OnInit` and `OnShutdown` — that a
 * `@Service`/`@Repository`/`@Config` (or any DI-managed instance) may implement
 * to participate in the application lifecycle. There is intentionally **no
 * decorator**: a service opts in purely by declaring the method, and the
 * controllers registrar detects it by presence via the guards below.
 *
 * Unlike {@link isGuardClass} (which inspects a class *constructor*'s prototype),
 * these guards operate on resolved *instances*, because the registrar has
 * already resolved each service from the container before deciding whether it
 * takes part in the lifecycle.
 *
 * @see `@nextrush/controllers` `registerControllers` — bridges these hooks into
 *   `app.ready()` (calls `onInit`) and `app.close()` (calls `onShutdown`).
 */

/**
 * Implemented by a service that needs to run initialization logic once, when the
 * application boots (`app.ready()`), after all controllers and their service
 * graph have been registered and resolved.
 *
 * `onInit` runs in dependency order — a service's dependencies initialize before
 * the service that depends on them (a reverse-BFS approximation of the graph).
 * An async `onInit` is awaited, so boot does not complete until every hook has
 * settled. Registration must happen before `serve()`/`ready()`.
 *
 * @example
 * ```typescript
 * import { Service } from '@nextrush/di';
 * import type { OnInit } from 'nextrush/class';
 *
 * @Service()
 * class Database implements OnInit {
 *   async onInit(): Promise<void> {
 *     await this.pool.connect();
 *   }
 * }
 * ```
 */
export interface OnInit {
  onInit(): void | Promise<void>;
}

/**
 * Implemented by a service that needs to release resources when the application
 * shuts down (`app.close()`).
 *
 * `onShutdown` runs in the **reverse** of the `onInit` order (dependents tear
 * down before their dependencies), and an async `onShutdown` is awaited.
 *
 * @example
 * ```typescript
 * import { Service } from '@nextrush/di';
 * import type { OnShutdown } from 'nextrush/class';
 *
 * @Service()
 * class Database implements OnShutdown {
 *   async onShutdown(): Promise<void> {
 *     await this.pool.end();
 *   }
 * }
 * ```
 */
export interface OnShutdown {
  onShutdown(): void | Promise<void>;
}

/**
 * Narrow an arbitrary value to {@link OnInit} by detecting a callable `onInit`
 * member. Traverses the prototype chain, so both object literals and class
 * instances are detected. Returns `false` for `null`, non-objects, and values
 * whose `onInit` is not a function.
 */
export function isOnInit(value: unknown): value is OnInit {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { onInit?: unknown }).onInit === 'function'
  );
}

/**
 * Narrow an arbitrary value to {@link OnShutdown} by detecting a callable
 * `onShutdown` member. Same semantics as {@link isOnInit}.
 */
export function isOnShutdown(value: unknown): value is OnShutdown {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { onShutdown?: unknown }).onShutdown === 'function'
  );
}
