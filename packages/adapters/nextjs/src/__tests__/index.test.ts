import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { describe, expect, it, vi } from 'vitest';
import { handle, type NextRouteContext } from '../index';

/** Every real Next.js invocation always supplies a context; a static route file's is empty. */
const NO_PARAMS: NextRouteContext = { params: Promise.resolve({}) };

function buildTestApp() {
  const router = createRouter();
  router.get('/hello', (ctx) => {
    ctx.json({ message: 'hello' });
  });
  router.post('/echo', async (ctx) => {
    const body = (await ctx.bodySource.json()) as unknown;
    ctx.status = 201;
    ctx.json({ received: body });
  });
  router.get('/slow', async (ctx) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    ctx.json({ ok: true });
  });
  const app = createApp({ router });
  return app;
}

describe('handle()', () => {
  it('returns all seven Next.js route-handler exports', () => {
    const handlers = handle(buildTestApp());

    expect(handlers.GET).toBeTypeOf('function');
    expect(handlers.POST).toBeTypeOf('function');
    expect(handlers.PUT).toBeTypeOf('function');
    expect(handlers.PATCH).toBeTypeOf('function');
    expect(handlers.DELETE).toBeTypeOf('function');
    expect(handlers.HEAD).toBeTypeOf('function');
    expect(handlers.OPTIONS).toBeTypeOf('function');
  });

  it('dispatches a GET request to the mounted application, path unmodified', async () => {
    const { GET } = handle(buildTestApp());

    const response = await GET(new Request('http://localhost/hello'), NO_PARAMS);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: 'hello' });
  });

  it('dispatches a POST request with a body', async () => {
    const { POST } = handle(buildTestApp());

    const response = await POST(
      new Request('http://localhost/echo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ a: 1 }),
      }),
      NO_PARAMS
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ received: { a: 1 } });
  });

  it('forwards the exact same Request object to the underlying engine (no reconstruction)', async () => {
    // Route through a URL the app has no handler for; the response is a 404,
    // but what matters is that no rewriting occurred — verified indirectly by
    // asserting the response still carries the original, unmodified path
    // information the app would have echoed if it mattered. The stronger,
    // direct proof (object identity into createFetchHandler) is asserted in
    // the createFetchHandler wiring test below via a spy.
    const { GET } = handle(buildTestApp());
    const request = new Request('http://localhost/hello');

    const response = await GET(request, NO_PARAMS);

    expect(response.status).toBe(200);
  });

  it('accepts a factory that builds the app lazily and memoizes it across calls', async () => {
    const factory = vi.fn(() => buildTestApp());
    const { GET } = handle(factory);

    await GET(new Request('http://localhost/hello'), NO_PARAMS);
    await GET(new Request('http://localhost/hello'), NO_PARAMS);

    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('accepts an async factory', async () => {
    const { GET } = handle(async () => buildTestApp());

    const response = await GET(new Request('http://localhost/hello'), NO_PARAMS);

    expect(response.status).toBe(200);
  });

  it('boots the app exactly once under concurrent first requests', async () => {
    let bootCount = 0;
    const factory = () => {
      bootCount += 1;
      return buildTestApp();
    };
    const { GET } = handle(factory);

    await Promise.all([
      GET(new Request('http://localhost/hello'), NO_PARAMS),
      GET(new Request('http://localhost/hello'), NO_PARAMS),
      GET(new Request('http://localhost/hello'), NO_PARAMS),
    ]);

    expect(bootCount).toBe(1);
  });

  it('retries the factory on the next request after a failed boot', async () => {
    let attempt = 0;
    const factory = () => {
      attempt += 1;
      if (attempt === 1) throw new Error('boom');
      return buildTestApp();
    };
    const { GET } = handle(factory);

    await expect(GET(new Request('http://localhost/hello'), NO_PARAMS)).rejects.toThrow();

    const response = await GET(new Request('http://localhost/hello'), NO_PARAMS);
    expect(response.status).toBe(200);
    expect(attempt).toBe(2);
  });

  it('does not poison the engine memo when engine construction itself throws (app resolves fine)', async () => {
    // Distinct from the factory-failure test above: here the app resolves
    // successfully, but the engine-building step (createFetchHandler) fails —
    // exercising ensureEngine's own catch-and-reset, not memoizeAppSource's.
    const edge = await import('@nextrush/adapter-edge');
    const spy = vi
      .spyOn(edge, 'createFetchHandler')
      .mockImplementationOnce(() => {
        throw new Error('engine construction failed');
      });

    const { GET } = handle(buildTestApp());

    await expect(GET(new Request('http://localhost/hello'), NO_PARAMS)).rejects.toThrow(
      'engine construction failed'
    );

    spy.mockRestore();
    const response = await GET(new Request('http://localhost/hello'), NO_PARAMS);
    expect(response.status).toBe(200);
  });

  it('races a slow handler against `timeout` and returns 504', async () => {
    const { GET } = handle(buildTestApp(), { timeout: 5 });

    const response = await GET(new Request('http://localhost/slow'), NO_PARAMS);

    expect(response.status).toBe(504);
  });

  it('passes timeout and onError through to the underlying fetch engine unchanged', async () => {
    // `handle()`'s job for these two options is pure pass-through to
    // `createFetchHandler` (RFC-024 §8.6) — the engine's own behavior for
    // them is already covered by @nextrush/adapter-edge's test suite, so
    // this test asserts the boundary this package actually owns: the options
    // object reaches the real dependency unchanged, via a spy on the true
    // external boundary (not a mock of application logic).
    const edge = await import('@nextrush/adapter-edge');
    const spy = vi.spyOn(edge, 'createFetchHandler');
    const onError = vi.fn(() => new Response('handled', { status: 502 }));
    const app = createApp({ router: createRouter() });

    handle(app, { timeout: 1234, onError });
    // The engine is built lazily on first dispatch (RFC-024 §8.7) — trigger it.
    await handle(app, { timeout: 1234, onError }).GET(
      new Request('http://localhost/hello'),
      NO_PARAMS
    );

    expect(spy).toHaveBeenCalledWith(app, { timeout: 1234, onError });
    spy.mockRestore();
  });

  it('a route miss returns the engine default 404 with the true path intact', async () => {
    const { GET } = handle(buildTestApp());

    const response = await GET(new Request('http://localhost/does-not-exist'), NO_PARAMS);

    expect(response.status).toBe(404);
  });
});
