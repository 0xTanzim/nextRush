/**
 * @nextrush/router - HEAD-on-GET auto-registration (RFC 9110 §9.3.2)
 *
 * A `GET` route must also answer `HEAD`. Fastify, Express, Koa and Hono all do
 * this; before this suite NextRush returned 404 for `HEAD` on every `GET` route,
 * making conditional-request revalidation, CDN HEAD probes and HEAD-configured
 * health checks fail.
 *
 * @see reports/investigations/2026-07-31-measured-floor-params-compliance/04-http-compliance-head.md
 */

import type { HttpMethod } from '@nextrush/types';
import { describe, expect, it } from 'vitest';
import { createRouter, Router } from '../router';

const noop = (): void => {};

describe('HEAD auto-registration for GET routes', () => {
  it('matches HEAD on a static GET route', () => {
    const router = createRouter();
    router.get('/health', noop);

    expect(router.match('GET', '/health')).not.toBeNull();
    expect(router.match('HEAD', '/health')).not.toBeNull();
  });

  it('matches HEAD on a param GET route and extracts the same params', () => {
    const router = createRouter();
    router.get('/users/:id', noop);

    const get = router.match('GET', '/users/42');
    const head = router.match('HEAD', '/users/42');

    expect(head).not.toBeNull();
    expect(head?.params).toEqual({ id: '42' });
    expect(head?.params).toEqual(get?.params);
  });

  it('matches HEAD on a wildcard GET route', () => {
    const router = createRouter();
    router.get('/static/*', noop);

    const head = router.match('HEAD', '/static/a/b.txt');
    expect(head).not.toBeNull();
    expect(head?.params['*']).toBe('a/b.txt');
  });

  it('reuses the GET handler and executor rather than compiling a second one', () => {
    const router = createRouter();
    router.get('/x', noop);

    const get = router.match('GET', '/x');
    const head = router.match('HEAD', '/x');

    expect(head?.handler).toBe(get?.handler);
    expect(head?.executor).toBe(get?.executor);
  });

  it('does not auto-register HEAD for non-GET methods', () => {
    const router = createRouter();
    router.post('/submit', noop);
    router.put('/replace', noop);

    expect(router.match('HEAD', '/submit')).toBeNull();
    expect(router.match('HEAD', '/replace')).toBeNull();
  });

  describe('an explicit router.head() always wins', () => {
    it('when registered AFTER the GET route', () => {
      const router = createRouter();
      const getHandler = (): void => {};
      const headHandler = (): void => {};

      router.get('/x', getHandler);
      expect(() => router.head('/x', headHandler)).not.toThrow();

      expect(router.match('HEAD', '/x')?.handler).toBe(headHandler);
      expect(router.match('GET', '/x')?.handler).toBe(getHandler);
    });

    it('when registered BEFORE the GET route', () => {
      const router = createRouter();
      const getHandler = (): void => {};
      const headHandler = (): void => {};

      router.head('/x', headHandler);
      expect(() => router.get('/x', getHandler)).not.toThrow();

      expect(router.match('HEAD', '/x')?.handler).toBe(headHandler);
      expect(router.match('GET', '/x')?.handler).toBe(getHandler);
    });
  });

  it('still rejects a genuine duplicate HEAD registration', () => {
    const router = createRouter();
    router.head('/x', noop);
    expect(() => router.head('/x', noop)).toThrow(/already registered/);
  });

  it('still rejects a genuine duplicate GET registration', () => {
    const router = createRouter();
    router.get('/x', noop);
    expect(() => router.get('/x', noop)).toThrow(/already registered/);
  });

  it('does not emit a duplicate introspection row for the derived HEAD', () => {
    const router = createRouter();
    router.get('/users/:id', noop);

    const rows = router.getRoutes();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.method).toBe('GET');
    expect(rows.some((r) => r.method === 'HEAD')).toBe(false);
  });

  it('emits exactly one introspection row when HEAD is registered explicitly', () => {
    const router = createRouter();
    router.get('/x', noop);
    router.head('/x', noop);

    const rows = router.getRoutes();
    expect(rows.filter((r) => r.method === 'HEAD')).toHaveLength(1);
    expect(rows.filter((r) => r.method === 'GET')).toHaveLength(1);
  });

  it('leaves router.all() working (its own HEAD registration must not conflict)', () => {
    const router = createRouter();
    expect(() => router.all('/any', noop)).not.toThrow();

    const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    for (const method of methods) {
      expect(router.match(method, '/any'), `expected ${method} to match`).not.toBeNull();
    }
    // .all() still consolidates to a single introspection row
    expect(router.getRoutes()).toHaveLength(1);
  });

  it('leaves redirect() working (it registers GET and HEAD itself)', () => {
    const router = createRouter();
    expect(() => router.redirect('/old', '/new')).not.toThrow();

    expect(router.match('GET', '/old')).not.toBeNull();
    expect(router.match('HEAD', '/old')).not.toBeNull();
  });

  it('survives a mounted sub-router without a route conflict or duplicate rows', () => {
    const sub = createRouter();
    sub.get('/list', noop);
    sub.get('/:id', noop);

    const parent = createRouter();
    expect(() => parent.mount('/users', sub)).not.toThrow();

    expect(parent.match('GET', '/users/list')).not.toBeNull();
    expect(parent.match('HEAD', '/users/list')).not.toBeNull();
    expect(parent.match('HEAD', '/users/7')).not.toBeNull();

    // one row per copied GET route, no HEAD rows
    const rows = parent.getRoutes();
    expect(rows.filter((r) => r.method === 'HEAD')).toHaveLength(0);
    expect(rows.filter((r) => r.method === 'GET')).toHaveLength(2);
  });

  it('reports HEAD in the Allow set for a GET-only route', () => {
    const router = createRouter();
    router.get('/only-get', noop);

    // allowedMethods() walks the trie; HEAD is now a registered method there.
    const middleware = router.allowedMethods();
    expect(typeof middleware).toBe('function');

    // Direct trie assertion via match(), which is the observable contract.
    expect(router.match('HEAD', '/only-get')).not.toBeNull();
  });

  it('clears derived HEAD entries on reset()', () => {
    const router = new Router();
    router.get('/x', noop);
    expect(router.match('HEAD', '/x')).not.toBeNull();

    router.reset();
    expect(router.match('GET', '/x')).toBeNull();
    expect(router.match('HEAD', '/x')).toBeNull();

    // re-registering after reset must not report a conflict
    expect(() => router.get('/x', noop)).not.toThrow();
    expect(router.match('HEAD', '/x')).not.toBeNull();
  });

  it('honours a case-insensitive static route for HEAD too', () => {
    const router = createRouter();
    router.get('/Health', noop);

    expect(router.match('HEAD', '/health')).not.toBeNull();
    expect(router.match('HEAD', '/HEALTH')).not.toBeNull();
  });
});
