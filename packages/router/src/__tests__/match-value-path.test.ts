/**
 * @nextrush/router — Request-path value integrity
 *
 * Matching a request path is case-insensitive by default, but the VALUES bound
 * from that path are data the application acts on (an identifier, a filename, a
 * token) — folding them silently changes what the handler receives. So the
 * request yields two strings: the folded one matching and policy decisions use,
 * and the case-preserved one parameter and wildcard values come from.
 *
 * These are DISPATCH-level tests: they run `router.routes()`, the middleware the
 * application actually mounts, so a value path that only works through the
 * standalone `Router.match()` API is not mistaken for a fix.
 */

import type { Context, RouteHandler } from '@nextrush/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canonicalizePath } from '../canonicalize';
import { createRouter, type Router } from '../router';

const noop: RouteHandler = async () => {};

function createCtx(path: string, method = 'GET'): Context {
  return { method, path, params: {}, set: () => undefined } as unknown as Context;
}

async function dispatch(router: Router, path: string, method = 'GET'): Promise<Context> {
  const ctx = createCtx(path, method);
  await router.routes()(ctx, async () => {});
  return ctx;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Dispatch: bound values keep the casing the request wrote', () => {
  it('a mixed-case static segment still matches, and the parameter keeps its case', async () => {
    const router = createRouter();
    router.get('/users/:id', noop);

    const ctx = await dispatch(router, '/Users/ABC123');

    expect(ctx.params.id).toBe('ABC123');
    // Matching stays case-insensitive: the published path is the folded one.
    expect(ctx.path).toBe('/users/abc123');
  });

  it('a wildcard keeps its case and its inner slashes', async () => {
    const router = createRouter();
    router.get('/files/*', noop);

    const ctx = await dispatch(router, '/files/Foo/Bar.TXT');

    expect(ctx.params['*']).toBe('Foo/Bar.TXT');
  });

  it('a parameter and a trailing wildcard both keep their case', async () => {
    const router = createRouter();
    router.get('/g/:x/*', noop);

    const ctx = await dispatch(router, '/g/ABC/Def/GHI');

    expect(ctx.params.x).toBe('ABC');
    expect(ctx.params['*']).toBe('Def/GHI');
  });

  it('doubled and trailing slashes collapse without touching the value casing', async () => {
    const router = createRouter();
    router.get('/users/:id', noop);

    const ctx = await dispatch(router, '//Users//ABC123//');

    expect(ctx.params.id).toBe('ABC123');
  });

  it('a percent-encoded uppercase parameter decodes with its case intact', async () => {
    const router = createRouter();
    router.get('/users/:id', noop);

    const ctx = await dispatch(router, '/users/ABC%2Fdef');

    expect(ctx.params.id).toBe('ABC/def');
  });

  it('a fold that changes a character length does not shift later values', async () => {
    const router = createRouter();
    router.get('/users/:first/:second', noop);

    // U+0130 lowercases to two code points, so a matcher that indexes the
    // folded string while slicing out of the original reads every later value
    // from the wrong offset — and a value read from the wrong offset is worse
    // than a folded one, because it is silently wrong.
    const ctx = await dispatch(router, '/Users/\u0130/XYZ');

    expect(ctx.params.first).toBe('\u0130');
    expect(ctx.params.second).toBe('XYZ');
  });

  it('a static route still wins over a parameter at the same position', async () => {
    const router = createRouter();
    router.get('/p/:id', noop);
    router.get('/p/Me', noop);

    const ctx = await dispatch(router, '/p/ME');

    expect(Object.keys(ctx.params)).toEqual([]);
  });

  it('the OPTIONS/405 path walk is unaffected — it binds no values', async () => {
    const router = createRouter();
    router.get('/users/:id', noop);

    const ctx = await dispatch(router, '/Users/ABC123', 'POST');

    expect(ctx.status).toBe(404);
    expect(Object.keys(ctx.params)).toEqual([]);
  });
});

describe('Dispatch: a case-sensitive router is unchanged', () => {
  it('matches an uppercase path and preserves its case', async () => {
    const router = createRouter({ caseSensitive: true });
    router.get('/Users/:id', noop);

    const ctx = await dispatch(router, '/Users/ABC123');

    expect(ctx.params.id).toBe('ABC123');
    expect(ctx.path).toBe('/Users/ABC123');
  });

  it('still misses a differently-cased path', async () => {
    const router = createRouter({ caseSensitive: true });
    router.get('/Users/:id', noop);

    const ctx = await dispatch(router, '/users/ABC123');

    expect(ctx.status).toBe(404);
  });
});

describe('Router.match: the public two-argument entry point is unchanged', () => {
  it('still normalizes its own raw input', () => {
    const router = createRouter();
    router.get('/users/:id', noop);

    expect(router.match('GET', '/Users/AbC')?.params.id).toBe('AbC');
  });

  it('still takes exactly two arguments', () => {
    // The case-preserved value path is supplied by the dispatch path only; a
    // caller that does not supply one keeps today's behaviour.
    expect(createRouter().match.length).toBe(2);
  });

  it('still returns null for a path it cannot fold into a match', () => {
    const router = createRouter();
    router.get('/users/:id', noop);

    expect(router.match('GET', '/nope/ABC')).toBeNull();
  });
});

describe('canonicalizePath: the case-preserved value path', () => {
  it('is the matched path itself when nothing needs folding', () => {
    const spy = vi.spyOn(String.prototype, 'toLowerCase');

    const result = canonicalizePath('/users/abc', false, false);

    expect(result.path).toBe('/users/abc');
    expect(result.valuePath).toBe('/users/abc');
    // No fold ran, so no second path string was produced either.
    expect(spy).not.toHaveBeenCalled();
  });

  it('preserves case and structure when matching folds', () => {
    const result = canonicalizePath('//Users/ABC123//', false, false);

    expect(result.path).toBe('/users/abc123');
    expect(result.valuePath).toBe('/Users/ABC123');
    expect(result.valuePath.split('/').length).toBe(result.path.split('/').length);
  });

  it('preserves original case across a fold that changes a character length', () => {
    const result = canonicalizePath('/Users/\u0130/XYZ', false, false);

    expect(result.valuePath).toBe('/Users/\u0130/XYZ');
    expect(result.valuePath.split('/').length).toBe(result.path.split('/').length);
  });

  it('equals the matched path under a case-sensitive router', () => {
    const result = canonicalizePath('/Users/ABC', true, false);

    expect(result.valuePath).toBe('/Users/ABC');
    expect(result.valuePath).toBe(result.path);
  });

  it('is still populated on a rejected path, where neither string is used', () => {
    const result = canonicalizePath('/files/../admin', false, false);

    expect(result.rejected).toBe(true);
    expect(result.valuePath).toBe('/files/../admin');
  });
});
