/**
 * @nextrush/core — the boot-time "sync dispatch is safe" invariant.
 *
 * @remarks
 * The Web runner may only answer a request without awaiting when nothing else can
 * run for it. That holds when the application's whole middleware stack is the one
 * mounted router: the router's dispatch middleware returns the route executor's
 * promise directly and never resumes after the handler. Any additional middleware
 * can resume after `next()` and mutate the response, so the invariant must be
 * false there — even when that middleware looks synchronous.
 *
 * `@nextrush/core` does not depend on `@nextrush/router`, so the router here is
 * the structural slice `ready()` actually uses: `routes()`.
 */

import { describe, expect, it } from 'vitest';
import type { Middleware, Router } from '@nextrush/types';
import { createApp } from '../application';

const routesMiddleware: Middleware = () => Promise.resolve();

function fakeRouter(): Router {
  return {
    routes: () => routesMiddleware,
    // `ready()` only calls `routes()`; the route registration methods are no-ops
    // because these tests assert the middleware invariant, not dispatch.
    get: () => undefined,
  } as unknown as Router;
}

describe('Application.syncDispatchSafe', () => {
  it('is true when the mounted router is the only middleware', async () => {
    const app = createApp({ router: fakeRouter() });
    app.get('/', (ctx) => ctx.json({ ok: true }));

    await app.ready();

    expect(app.syncDispatchSafe).toBe(true);
  });

  it('is false when any application middleware is registered', async () => {
    const app = createApp({ router: fakeRouter() });
    app.use(async (_ctx, next) => {
      await next();
    });
    app.get('/', (ctx) => ctx.json({ ok: true }));

    await app.ready();

    expect(app.syncDispatchSafe).toBe(false);
  });

  it('is false for an application with no router', async () => {
    const app = createApp();
    app.use(async (_ctx, next) => {
      await next();
    });

    await app.ready();

    expect(app.syncDispatchSafe).toBe(false);
  });
});
