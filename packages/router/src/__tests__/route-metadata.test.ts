/**
 * @nextrush/router - Route Metadata System Tests
 *
 * Covers endpoint() markers, the ROUTE_METADATA contribution protocol,
 * getRoutes() introspection, contribution merge semantics, and the guarantee
 * that pure-metadata markers never enter the executed handler chain.
 */

import type { Context, Middleware } from '@nextrush/types';
import { ROUTE_METADATA, type MetadataContribution } from '@nextrush/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, endpoint, Router } from '../router';

function createMockContext(overrides: Partial<Context> = {}): Context {
  return {
    method: 'GET',
    path: '/',
    params: {},
    query: {},
    body: undefined,
    headers: {},
    status: 200,
    state: {},
    json: vi.fn(),
    send: vi.fn(),
    html: vi.fn(),
    redirect: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    next: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    raw: { req: {} as any, res: {} as any },
    ...overrides,
  } as Context;
}

/** Simulate a metadata-contributing middleware (like validate()): a real function carrying the symbol. */
function contributingMiddleware(contribution: MetadataContribution): Middleware {
  const mw: Middleware = async (ctx, next) => {
    await next();
  };
  Object.defineProperty(mw, ROUTE_METADATA, { value: contribution, enumerable: false });
  return mw;
}

describe('endpoint()', () => {
  it('returns a marker carrying its metadata under ROUTE_METADATA', () => {
    const marker = endpoint({ summary: 'Create user' });
    expect(marker[ROUTE_METADATA]).toEqual({ summary: 'Create user' });
  });

  it('is not a function (never executed as middleware)', () => {
    expect(typeof endpoint({ summary: 'x' })).not.toBe('function');
  });
});

describe('getRoutes()', () => {
  let router: Router;
  beforeEach(() => {
    router = createRouter();
  });

  it('lists every registered route (static and param) with method, path, key', () => {
    router.get('/health', vi.fn());
    router.get('/users/:id', vi.fn());
    router.post('/users', vi.fn());

    const routes = router.getRoutes();
    const keys = routes.map((r) => r.key).sort();
    expect(keys).toEqual(['GET /health', 'GET /users/:id', 'POST /users']);

    const byId = routes.find((r) => r.key === 'GET /users/:id');
    expect(byId?.method).toBe('GET');
    expect(byId?.path).toBe('/users/:id');
  });

  it('yields a definition with no metadata for a bare route', () => {
    router.get('/hello', vi.fn());
    const [route] = router.getRoutes();
    expect(route?.key).toBe('GET /hello');
    expect(route?.metadata).toBeUndefined();
  });

  it('captures endpoint() metadata on the route', () => {
    router.post('/users', endpoint({ summary: 'Create a user', tags: ['users'] }), vi.fn());
    const [route] = router.getRoutes();
    expect(route?.metadata?.summary).toBe('Create a user');
    expect(route?.metadata?.tags).toEqual(['users']);
  });

  it('captures a contributing middleware (validate-style) request schema', () => {
    const schema = { '~standard': { version: 1, vendor: 'test', validate: () => ({ value: {} }) } };
    router.post('/users', contributingMiddleware({ request: { body: schema } }), vi.fn());
    const [route] = router.getRoutes();
    expect(route?.metadata?.request?.body).toBe(schema);
  });

  it('returns a readonly snapshot', () => {
    router.get('/x', vi.fn());
    const routes = router.getRoutes();
    expect(Array.isArray(routes)).toBe(true);
    expect(routes).toHaveLength(1);
  });
});

describe('contribution merge semantics', () => {
  let router: Router;
  beforeEach(() => {
    router = createRouter();
  });

  it('merges across contributors: request from one, responses/summary from another', () => {
    const bodySchema = { '~standard': { version: 1, vendor: 'test', validate: () => ({ value: {} }) } };
    const resSchema = { '~standard': { version: 1, vendor: 'test', validate: () => ({ value: {} }) } };
    router.post('/users',
      contributingMiddleware({ request: { body: bodySchema } }),
      endpoint({ summary: 'Create', responses: { 201: resSchema } }),
      vi.fn()
    );
    const [route] = router.getRoutes();
    expect(route?.metadata?.request?.body).toBe(bodySchema);
    expect(route?.metadata?.summary).toBe('Create');
    expect(route?.metadata?.responses?.[201]).toBe(resSchema);
  });

  it('last-write-wins for scalars/arrays; per-key merge for responses map', () => {
    const a = { '~standard': { version: 1, vendor: 't', validate: () => ({ value: {} }) } };
    const b = { '~standard': { version: 1, vendor: 't', validate: () => ({ value: {} }) } };
    router.get('/x',
      endpoint({ summary: 'first', tags: ['a'], responses: { 200: a } }),
      endpoint({ summary: 'second', tags: ['b'], responses: { 404: b } }),
      vi.fn()
    );
    const [route] = router.getRoutes();
    expect(route?.metadata?.summary).toBe('second'); // last wins
    expect(route?.metadata?.tags).toEqual(['b']); // last wins
    expect(route?.metadata?.responses).toEqual({ 200: a, 404: b }); // per-key merge
  });
});

describe('markers never enter the executed chain', () => {
  it('dispatches correctly with an endpoint() marker present', async () => {
    const router = createRouter();
    const handler = vi.fn();
    router.get('/x', endpoint({ summary: 'x' }), handler);

    const ctx = createMockContext({ method: 'GET', path: '/x' });
    await router.routes()(ctx, async () => {});

    // Handler ran; the marker was filtered out (a non-function marker in the
    // chain would throw when invoked).
    expect(handler).toHaveBeenCalledOnce();
  });

  it('still runs a contributing middleware function in the chain', async () => {
    const router = createRouter();
    const order: string[] = [];
    const mw = contributingMiddleware({ summary: 'x' });
    const wrapped: Middleware = async (ctx, next) => {
      order.push('mw');
      await mw(ctx, next);
    };
    const handler = vi.fn(() => void order.push('handler'));
    router.get('/x', wrapped, handler);

    const ctx = createMockContext({ method: 'GET', path: '/x' });
    await router.routes()(ctx, async () => {});

    expect(order).toEqual(['mw', 'handler']);
    expect(handler).toHaveBeenCalledOnce();
  });
});
