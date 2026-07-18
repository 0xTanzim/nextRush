/**
 * @nextrush/router - HP-10 single-allocation contract
 *
 * Pins design.md D1: a matched request produces ONE `RouteMatch` object with
 * `middleware` attached, rather than a `matchRoute` result later wrapped by
 * `resolveMatch`. Asserted at the `matchRoute` boundary — `matchRoute` now
 * returns the full `RouteMatch` shape (incl. `middleware === routerMiddleware`)
 * for both the static-map fast path and a param walk — plus at the public
 * `Router.match()` boundary (shape unchanged, middleware attached once).
 *
 * The "exactly one object" claim itself is proven by the allocation micro-bench
 * (`bench:alloc:router`); this file pins the observable single-object contract.
 */

import type { Middleware, RouteHandler } from '@nextrush/types';
import { describe, expect, it } from 'vitest';
import { matchRoute } from '../match-route';
import { compileExecutor, createNode, NodeType, type HandlerEntry } from '../segment-trie';
import { createRouter } from '../router';

const noop: RouteHandler = async () => {
  /* no-op */
};

describe('HP-10 — single RouteMatch allocation', () => {
  it('matchRoute attaches routerMiddleware to its own returned object (param walk)', () => {
    const root = createNode('');
    const users = createNode('users');
    root.children.set('users', users);
    const idNode = createNode(':id', NodeType.PARAM);
    idNode.paramName = 'id';
    users.paramChild = idNode;
    const executor = compileExecutor(noop, []);
    idNode.handlers.set('GET', { handler: noop, middleware: [], executor });

    const routerMiddleware: Middleware[] = [async (_ctx, next) => next?.()];
    const match = matchRoute(
      'GET',
      '/users/42',
      root,
      new Map<string, HandlerEntry>(),
      true,
      false,
      false,
      true,
      routerMiddleware
    );

    expect(match).not.toBeNull();
    expect(match?.handler).toBe(noop);
    expect(match?.executor).toBe(executor);
    expect(match?.params).toEqual({ id: '42' });
    // The single-object contract: middleware lives on matchRoute's own return.
    expect(match?.middleware).toBe(routerMiddleware);
  });

  it('matchRoute attaches routerMiddleware on the static fast path too', () => {
    const root = createNode('');
    const executor = compileExecutor(noop, []);
    const staticRoutes = new Map<string, HandlerEntry>([
      ['GET /s', { handler: noop, middleware: [], executor }],
    ]);
    const routerMiddleware: Middleware[] = [async (_ctx, next) => next?.()];

    const match = matchRoute('GET', '/s', root, staticRoutes, false, false, false, true, routerMiddleware);

    expect(match?.handler).toBe(noop);
    expect(match?.middleware).toBe(routerMiddleware);
  });

  it('Router.match attaches the SAME routerMiddleware array on every match (attached once, not rebuilt)', () => {
    const mw: Middleware = async (_ctx, next) => next?.();
    const router = createRouter();
    router.use(mw);
    router.get('/x', noop);
    router.get('/y/:id', noop);

    const m1 = router.match('GET', '/x');
    const m2 = router.match('GET', '/y/7');

    expect(m1?.middleware).toBe(m2?.middleware);
    expect(m1?.middleware).toContain(mw);
  });
});
