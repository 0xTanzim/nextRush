/**
 * @nextrush/router - Route Groups
 *
 * A route group applies a shared path prefix and middleware to a set of routes
 * registered inside a callback. Extracted from `router.ts` (audit RT-3) and
 * given a real public type (audit RT-6): `router.group()` callbacks receive a
 * {@link RouteGroup}, not a mis-cast `Router`.
 *
 * @packageDocumentation
 */

import {
  HTTP_METHODS,
  type HttpMethod,
  type Middleware,
  type RouteHandler,
} from '@nextrush/types';
import { createRedirectHandler, type RedirectStatus } from './redirect';

/**
 * The subset of the parent router a group needs to register routes into.
 *
 * @remarks
 * Declared as an interface (rather than importing `Router`) so `group-router.ts`
 * and `router.ts` don't form an import cycle. `Router` satisfies it structurally
 * via its `_addGroupRoute` method.
 */
export interface GroupRouterHost {
  _addGroupRoute(
    method: HttpMethod,
    path: string,
    handlers: RouteHandler[],
    groupMiddleware: Middleware[]
  ): void;
}

/**
 * The object passed to a `router.group(prefix, callback)` callback.
 *
 * @remarks
 * Exposes only the route-registration surface that is valid inside a group —
 * intentionally NOT the full {@link Router} (no `mount`/`use`/`reset`), which is
 * why the previous `as unknown as Router` cast was a lie (audit RT-6).
 */
export interface RouteGroup {
  get(path: string, ...handlers: RouteHandler[]): this;
  post(path: string, ...handlers: RouteHandler[]): this;
  put(path: string, ...handlers: RouteHandler[]): this;
  delete(path: string, ...handlers: RouteHandler[]): this;
  patch(path: string, ...handlers: RouteHandler[]): this;
  head(path: string, ...handlers: RouteHandler[]): this;
  options(path: string, ...handlers: RouteHandler[]): this;
  all(path: string, ...handlers: RouteHandler[]): this;
  redirect(from: string, to: string, status?: RedirectStatus): this;
  group(
    prefix: string,
    middlewareOrCallback: Middleware[] | ((router: RouteGroup) => void),
    callback?: (router: RouteGroup) => void
  ): this;
}

/**
 * Collects routes under a shared prefix + middleware and forwards them to the
 * parent router. Implements {@link RouteGroup}.
 */
export class GroupRouter implements RouteGroup {
  private readonly parent: GroupRouterHost;
  private readonly prefix: string;
  private readonly middleware: Middleware[];

  constructor(parent: GroupRouterHost, prefix: string, middleware: Middleware[]) {
    this.parent = parent;
    this.prefix = prefix;
    this.middleware = middleware;
  }

  private fullPath(path: string): string {
    // Handle root path in group
    if (path === '/' || path === '') {
      return this.prefix;
    }
    // Combine prefix and path
    const cleanPrefix = this.prefix.endsWith('/') ? this.prefix.slice(0, -1) : this.prefix;
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return cleanPrefix + cleanPath;
  }

  get(path: string, ...handlers: RouteHandler[]): this {
    this.parent._addGroupRoute('GET', this.fullPath(path), handlers, this.middleware);
    return this;
  }

  post(path: string, ...handlers: RouteHandler[]): this {
    this.parent._addGroupRoute('POST', this.fullPath(path), handlers, this.middleware);
    return this;
  }

  put(path: string, ...handlers: RouteHandler[]): this {
    this.parent._addGroupRoute('PUT', this.fullPath(path), handlers, this.middleware);
    return this;
  }

  delete(path: string, ...handlers: RouteHandler[]): this {
    this.parent._addGroupRoute('DELETE', this.fullPath(path), handlers, this.middleware);
    return this;
  }

  patch(path: string, ...handlers: RouteHandler[]): this {
    this.parent._addGroupRoute('PATCH', this.fullPath(path), handlers, this.middleware);
    return this;
  }

  head(path: string, ...handlers: RouteHandler[]): this {
    this.parent._addGroupRoute('HEAD', this.fullPath(path), handlers, this.middleware);
    return this;
  }

  options(path: string, ...handlers: RouteHandler[]): this {
    this.parent._addGroupRoute('OPTIONS', this.fullPath(path), handlers, this.middleware);
    return this;
  }

  all(path: string, ...handlers: RouteHandler[]): this {
    for (const method of HTTP_METHODS) {
      this.parent._addGroupRoute(method, this.fullPath(path), handlers, this.middleware);
    }
    return this;
  }

  /**
   * Register a redirect within the group (uses the shared redirect handler,
   * audit RT-4 — no more naive replaceAll param substitution).
   */
  redirect(from: string, to: string, status: RedirectStatus = 301): this {
    const redirectHandler = createRedirectHandler(to, status);

    this.parent._addGroupRoute('GET', this.fullPath(from), [redirectHandler], this.middleware);
    this.parent._addGroupRoute('HEAD', this.fullPath(from), [redirectHandler], this.middleware);

    return this;
  }

  /**
   * Nested group support — combines this group's prefix + middleware with the
   * nested group's.
   */
  group(
    prefix: string,
    middlewareOrCallback: Middleware[] | ((router: RouteGroup) => void),
    callback?: (router: RouteGroup) => void
  ): this {
    let nestedMiddleware: Middleware[] = [];
    let cb: (router: RouteGroup) => void;

    if (Array.isArray(middlewareOrCallback)) {
      nestedMiddleware = middlewareOrCallback;
      if (!callback) {
        throw new Error('Callback function is required when providing middleware array');
      }
      cb = callback;
    } else {
      cb = middlewareOrCallback;
    }

    const nestedRouter = new GroupRouter(this.parent, this.fullPath(prefix), [
      ...this.middleware,
      ...nestedMiddleware,
    ]);

    cb(nestedRouter);

    return this;
  }
}
