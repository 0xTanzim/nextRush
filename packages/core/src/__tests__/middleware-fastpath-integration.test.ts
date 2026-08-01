/**
 * @nextrush/core - Single-middleware fast-path integration (§8.1)
 *
 * OpenSpec change: core-single-middleware-fastpath.
 *
 * `app.route('/', router)` produces a single-middleware stack
 * (`[router.routes()]`), so `Application.callback()` composes it through the
 * `len === 1` fast path. This suite drives that path end-to-end through the
 * real `Application` + `compose()` + a router-shaped middleware (the same
 * match-or-`next()` contract the real router's `routes()` returns), covering
 * every route outcome and the 404 fall-through where the lone tail `next()`
 * resolves with no tail present at the app root.
 *
 * The router package sits above core in the layer graph, so this uses a
 * router-shaped middleware rather than importing `@nextrush/router` — the
 * fast-path behavior under test (single-entry dispatch + fall-through) is
 * identical, and cross-adapter/real-router parity is covered by the existing
 * router and adapter-conformance suites (§8.2/§8.3).
 */

import type { Middleware } from '@nextrush/types';
import { describe, expect, it } from 'vitest';
import { createApp } from '../application';
import { createMockContext } from './_shared/create-mock-context';

/** A router-shaped middleware: match on method+path, else fall through via next(). */
function routerRoutes(): Middleware {
  return async (ctx, next) => {
    if (ctx.method === 'GET' && ctx.path === '/hello') {
      ctx.status = 200;
      (ctx as { responded: boolean }).responded = true;
      ctx.json({ message: 'hello' });
      return;
    }
    if (ctx.method === 'GET' && ctx.path.startsWith('/users/')) {
      ctx.params = { id: ctx.path.slice('/users/'.length) };
      ctx.status = 200;
      (ctx as { responded: boolean }).responded = true;
      ctx.json({ id: ctx.params.id });
      return;
    }
    if (ctx.method === 'POST' && ctx.path === '/users') {
      ctx.status = 201;
      (ctx as { responded: boolean }).responded = true;
      ctx.json({ created: true });
      return;
    }
    // No match — fall through so the app root (or adapter) can finalize a 404.
    if (next) {
      await next();
    }
  };
}

describe('single-middleware fast path: app integration (§8.1)', () => {
  it('serves a static GET route with a 200 body', async () => {
    const app = createApp();
    app.route('/', { routes: routerRoutes });
    const handler = app.callback();

    const ctx = createMockContext({ method: 'GET', path: '/hello' });
    await handler(ctx);

    expect(ctx.status).toBe(200);
    expect(ctx.json).toHaveBeenCalledWith({ message: 'hello' });
  });

  it('serves a param route with the parsed param', async () => {
    const app = createApp();
    app.route('/', { routes: routerRoutes });
    const handler = app.callback();

    const ctx = createMockContext({ method: 'GET', path: '/users/42' });
    await handler(ctx);

    expect(ctx.status).toBe(200);
    expect(ctx.params).toEqual({ id: '42' });
    expect(ctx.json).toHaveBeenCalledWith({ id: '42' });
  });

  it('serves a POST route with a 201', async () => {
    const app = createApp();
    app.route('/', { routes: routerRoutes });
    const handler = app.callback();

    const ctx = createMockContext({ method: 'POST', path: '/users' });
    await handler(ctx);

    expect(ctx.status).toBe(201);
    expect(ctx.json).toHaveBeenCalledWith({ created: true });
  });

  it('falls through cleanly on an unmatched path (404 fall-through, lone tail next resolves)', async () => {
    const app = createApp();
    app.route('/', { routes: routerRoutes });
    const handler = app.callback();

    const ctx = createMockContext({ method: 'GET', path: '/nope' });
    // The single tail next() resolves (no tail at app root) → no throw, nothing
    // committed a response, so the adapter would finalize a 404.
    await expect(handler(ctx)).resolves.toBeUndefined();
    expect(ctx.responded).toBe(false);
    expect(ctx.json).not.toHaveBeenCalled();
  });
});
