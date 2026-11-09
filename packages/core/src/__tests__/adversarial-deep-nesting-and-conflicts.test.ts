/**
 * @nextrush/core - Adversarial Deep Nesting & Route Conflicts Verification
 *
 * Empirical challenger test suite verifying:
 * 1. Deep Nesting: Multi-prefix sub-routers nested across multiple levels in Application.
 * 2. Parameter Extraction & Wildcards: Parameter binding and path scoping across all mounted prefixes.
 * 3. Route Conflicts & Guards: Validation guards, false-conflict resistance, and prefix deduplication.
 */

import type { Context, Middleware } from '@nextrush/types';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Application, Routable } from '../application';
import { createApp } from '../application';
import { createPrefixMount } from '../route-mount';
import { createMockContext } from './_shared/create-mock-context';

interface NestedRouterDouble extends Routable {
  routes(): Middleware;
  mount(prefixes: string | readonly string[], child: Routable): this;
  get(path: string, handler: Middleware): this;
  matchesMountPrefix?(path: string, prefix: string): string | undefined;
}

function createNestedRouter(): NestedRouterDouble {
  const stack: Middleware[] = [];
  const routesMap = new Map<string, Middleware>();

  const router: NestedRouterDouble = {
    get(path: string, handler: Middleware) {
      routesMap.set(path, handler);
      return this;
    },
    mount(prefixes: string | readonly string[], child: Routable) {
      const prefixList = Array.isArray(prefixes) ? prefixes : [prefixes];
      const childRoutes = child.routes();
      for (const rawPrefix of prefixList) {
        let norm = rawPrefix.replace(/\/+/g, '/').replace(/\/+$/, '') || '/';
        if (!norm.startsWith('/')) norm = '/' + norm;
        if (norm === '/') {
          stack.push(childRoutes);
        } else {
          stack.push(createPrefixMount(norm, childRoutes, child.matchesMountPrefix?.bind(child)));
        }
      }
      return this;
    },
    routes(): Middleware {
      return async (ctx: Context, next?: () => Promise<void>) => {
        // First check directly registered routes
        const directHandler = routesMap.get(ctx.path);
        if (directHandler) {
          await directHandler(ctx, next ?? (async () => {}));
          return;
        }

        // Otherwise dispatch mounted sub-routers
        const dispatch = async (i: number): Promise<void> => {
          if (i < stack.length) {
            const mw = stack[i];
            if (mw) {
              await mw(ctx, () => dispatch(i + 1));
            }
          } else if (next) {
            await next();
          }
        };

        await dispatch(0);
      };
    },
    matchesMountPrefix(path: string, prefix: string): string | undefined {
      const normPrefix = prefix.replace(/\/+/g, '/').replace(/\/+$/, '') || '/';
      const normPath = path.replace(/\/+/g, '/');
      if (normPrefix === '/') return normPath;
      if (!normPath.startsWith(normPrefix)) return undefined;
      const len = normPrefix.length;
      if (len < normPath.length && normPath.charCodeAt(len) !== 0x2f) return undefined;
      return normPath.slice(len) || '/';
    },
  };

  return router;
}

describe('Empirical Challenger: Core Deep Nesting & Route Conflicts Verification', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp({ env: 'test' });
  });

  describe('1. Deep Nesting with Multi-Prefix Mounting in Application', () => {
    it('dispatches requests across 3-level deep hierarchy where all levels use multi-prefixes', async () => {
      // Level 3 (leaf)
      const leafRouter = createNestedRouter();
      const handlerCalls: string[] = [];

      leafRouter.get('/action', async (ctx) => {
        handlerCalls.push(ctx.path);
        ctx.json({ ok: true, scopedPath: ctx.path });
      });

      // Level 2 (child) - mounts leaf at 2 prefixes
      const childRouter = createNestedRouter();
      childRouter.mount(['/sub1', '/sub2'], leafRouter);

      // Level 1 (parent) - mounts child at 2 prefixes
      const parentRouter = createNestedRouter();
      parentRouter.mount(['/tenantA', '/tenantB'], childRouter);

      // Level 0 (app) - mounts parent at 2 prefixes
      app.route(['/api', '/v1'], parentRouter);

      const dispatch = app.callback();

      const topPrefixes = ['/api', '/v1'];
      const parentPrefixes = ['/tenantA', '/tenantB'];
      const childPrefixes = ['/sub1', '/sub2'];

      for (const top of topPrefixes) {
        for (const parent of parentPrefixes) {
          for (const child of childPrefixes) {
            const fullPath = `${top}${parent}${child}/action`;
            const ctx = createMockContext({ path: fullPath, url: fullPath });

            await dispatch(ctx);

            expect(ctx.json).toHaveBeenCalledWith({ ok: true, scopedPath: '/action' });
            // Path must be restored to original full path after dispatch completes
            expect(ctx.path).toBe(fullPath);
          }
        }
      }

      // Total 8 combinations dispatched
      expect(handlerCalls).toHaveLength(8);
      for (const call of handlerCalls) {
        expect(call).toBe('/action');
      }
    });

    it('restores original ctx.path across all nesting boundaries even when handler throws', async () => {
      const leaf = createNestedRouter();
      leaf.get('/crash', async () => {
        throw new Error('Explosion deep inside sub-router');
      });

      const child = createNestedRouter();
      child.mount(['/c1', '/c2'], leaf);

      const parent = createNestedRouter();
      parent.mount(['/p1', '/p2'], child);

      app.route(['/api', '/v1'], parent);

      const dispatch = app.callback();
      const fullPath = '/api/p1/c2/crash';
      const ctx = createMockContext({ path: fullPath, url: fullPath });

      // app.callback() catches error, writes default 500 response, and settles
      await dispatch(ctx);

      expect(ctx.status).toBe(500);

      // Crucial invariant: finally block must restore ctx.path back to fullPath even on error
      expect(ctx.path).toBe(fullPath);
    });

    it('allows downstream middleware after app.route to observe the restored full path', async () => {
      const sub = createNestedRouter();
      sub.get('/data', async (ctx, next) => {
        ctx.status = 200;
        await next();
      });

      app.route(['/api', '/v1'], sub);

      let observedPathInDownstream = '';
      app.use(async (ctx, next) => {
        observedPathInDownstream = ctx.path;
        await next();
      });

      const dispatch = app.callback();
      const ctx = createMockContext({ path: '/v1/data', url: '/v1/data' });

      await dispatch(ctx);

      expect(observedPathInDownstream).toBe('/v1/data');
      expect(ctx.path).toBe('/v1/data');
    });
  });

  describe('2. Parameter Extraction & Path Scoping across Multi-Prefixes', () => {
    it('correctly isolates scoped path and binds extracted parameters across multi-prefix mounts', async () => {
      // Create a router that simulates parameter extraction
      const paramRouter: Routable = {
        routes(): Middleware {
          return async (ctx, next) => {
            // Path incoming is scoped (e.g. /users/42)
            const match = /^\/users\/([^/]+)$/.exec(ctx.path);
            if (match && match[1]) {
              ctx.params = { ...ctx.params, id: match[1] };
              ctx.json({ id: match[1], path: ctx.path });
            } else if (next) {
              await next();
            }
          };
        },
      };

      app.route(['/api', '/v1', '/enterprise/v2'], paramRouter);

      const dispatch = app.callback();

      const prefixes = ['/api', '/v1', '/enterprise/v2'];
      for (const prefix of prefixes) {
        const fullPath = `${prefix}/users/user_xyz789`;
        const ctx = createMockContext({ path: fullPath, url: fullPath });

        await dispatch(ctx);

        expect(ctx.json).toHaveBeenCalledWith({
          id: 'user_xyz789',
          path: '/users/user_xyz789',
        });
        expect(ctx.path).toBe(fullPath);
      }
    });

    it('isolates wildcard paths across multiple mounted prefixes', async () => {
      const wildcardRouter: Routable = {
        routes(): Middleware {
          return async (ctx, next) => {
            if (ctx.path.startsWith('/files/')) {
              const wildcard = ctx.path.slice('/files/'.length);
              ctx.params = { ...ctx.params, '*': wildcard };
              ctx.json({ wildcard, path: ctx.path });
            } else if (next) {
              await next();
            }
          };
        },
      };

      app.route(['/cdn', '/public', '/assets'], wildcardRouter);

      const dispatch = app.callback();

      for (const prefix of ['/cdn', '/public', '/assets']) {
        const fullPath = `${prefix}/files/css/bundle/app.min.css`;
        const ctx = createMockContext({ path: fullPath, url: fullPath });

        await dispatch(ctx);

        expect(ctx.json).toHaveBeenCalledWith({
          wildcard: 'css/bundle/app.min.css',
          path: '/files/css/bundle/app.min.css',
        });
        expect(ctx.path).toBe(fullPath);
      }
    });
  });

  describe('3. Route Conflict & Validation Guards in Application', () => {
    describe('Validation Guards', () => {
      it('throws descriptive Error on empty array [] in app.route()', () => {
        const router = createNestedRouter();
        expect(() => {
          app.route([], router);
        }).toThrow('app.route() requires at least one path prefix when an array is provided');
      });

      it('throws TypeError on [null] in app.route()', () => {
        const router = createNestedRouter();
        expect(() => {
          app.route([null as unknown as string], router);
        }).toThrow(new TypeError('Route path prefix must be a string, received null'));
      });

      it('throws TypeError on [undefined] in app.route()', () => {
        const router = createNestedRouter();
        expect(() => {
          app.route([undefined as unknown as string], router);
        }).toThrow(new TypeError('Route path prefix must be a string, received undefined'));
      });

      it('throws TypeError on [123] in app.route()', () => {
        const router = createNestedRouter();
        expect(() => {
          app.route([123 as unknown as string], router);
        }).toThrow(new TypeError('Route path prefix must be a string, received number'));
      });

      it('throws TypeError on [""] in app.route()', () => {
        const router = createNestedRouter();
        expect(() => {
          app.route([''], router);
        }).toThrow(new TypeError('Route path prefix must be a non-empty string'));
      });

      it('throws TypeError when router is invalid in app.route()', () => {
        expect(() => {
          app.route(['/api'], null as unknown as Routable);
        }).toThrow(new TypeError('app.route() requires a router with a routes() method'));

        expect(() => {
          app.route(['/api'], {} as unknown as Routable);
        }).toThrow(new TypeError('app.route() requires a router with a routes() method'));
      });
    });

    describe('False Conflict Prevention & Deduplication', () => {
      it('does NOT duplicate middleware execution when array contains duplicate normalized prefixes', async () => {
        let handlerCallCount = 0;
        const router: Routable = {
          routes(): Middleware {
            return async (_ctx, next) => {
              handlerCallCount++;
              if (next) await next();
            };
          },
        };

        // All of these normalize to '/api'
        app.route(['/api', '/api/', '//api', '/api//', 'api'], router);

        const dispatch = app.callback();
        const ctx = createMockContext({ path: '/api/test' });

        await dispatch(ctx);

        // Due to deduplication in app.route, the prefix middleware must only run once
        expect(handlerCallCount).toBe(1);
      });

      it('does NOT conflict when mounting distinct routers across the same multi-prefixes', async () => {
        const routerA = createNestedRouter();
        routerA.get('/users', async (ctx) => {
          ctx.json({ source: 'routerA' });
        });

        const routerB = createNestedRouter();
        routerB.get('/orders', async (ctx) => {
          ctx.json({ source: 'routerB' });
        });

        expect(() => {
          app.route(['/api', '/v1'], routerA);
          app.route(['/api', '/v1'], routerB);
        }).not.toThrow();

        const dispatch = app.callback();

        const ctxUsers = createMockContext({ path: '/api/users' });
        await dispatch(ctxUsers);
        expect(ctxUsers.json).toHaveBeenCalledWith({ source: 'routerA' });

        const ctxOrders = createMockContext({ path: '/api/orders' });
        await dispatch(ctxOrders);
        expect(ctxOrders.json).toHaveBeenCalledWith({ source: 'routerB' });

        const ctxV1Users = createMockContext({ path: '/v1/users' });
        await dispatch(ctxV1Users);
        expect(ctxV1Users.json).toHaveBeenCalledWith({ source: 'routerA' });

        const ctxV1Orders = createMockContext({ path: '/v1/orders' });
        await dispatch(ctxV1Orders);
        expect(ctxV1Orders.json).toHaveBeenCalledWith({ source: 'routerB' });
      });
    });
  });
});
