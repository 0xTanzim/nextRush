/**
 * @nextrush/adapter-serverless - Adapter tests (spec: serverless-adapter).
 */

import { describe, expect, it } from 'vitest';
import { createApp } from '@nextrush/core';
import { createServerlessAdapter, lambdaFunctionUrl } from '../index';
import type { EventMapper, LambdaFunctionUrlEvent } from '../index';

function event(overrides: Partial<LambdaFunctionUrlEvent> = {}): LambdaFunctionUrlEvent {
  return {
    version: '2.0',
    rawPath: '/',
    rawQueryString: '',
    headers: {},
    requestContext: { http: { method: 'GET' } },
    isBase64Encoded: false,
    ...overrides,
  };
}

describe('lambda-function-url round-trip', () => {
  it('maps method, path, and query into the Context', async () => {
    const app = createApp();
    app.use((ctx) => {
      ctx.json({ method: ctx.method, path: ctx.path, a: ctx.query.a });
    });
    const handler = createServerlessAdapter({
      mappers: [lambdaFunctionUrl],
      provider: 'lambda-function-url',
    }).createHandler(app);

    const res = await handler(
      event({ rawPath: '/users', rawQueryString: 'a=1', requestContext: { http: { method: 'GET' } } })
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { method: string; path: string; a: string };
    expect(body.method).toBe('GET');
    expect(body.path).toBe('/users');
    expect(body.a).toBe('1');
    expect(res.isBase64Encoded).toBe(false);
  });

  it('parses a JSON POST body', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      const raw = await ctx.bodySource.text();
      ctx.json({ echo: JSON.parse(raw) as unknown });
    });
    const handler = createServerlessAdapter({ mappers: [lambdaFunctionUrl] }).createHandler(app);

    const res = await handler(
      event({
        rawPath: '/echo',
        requestContext: { http: { method: 'POST' } },
        headers: { 'content-type': 'application/json' },
        body: '{"n":7}',
      })
    );
    const body = JSON.parse(res.body) as { echo: { n: number } };
    expect(body.echo.n).toBe(7);
  });

  it('decodes a base64-encoded request body', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.json({ raw: await ctx.bodySource.text() });
    });
    const handler = createServerlessAdapter({ mappers: [lambdaFunctionUrl] }).createHandler(app);

    const res = await handler(
      event({
        rawPath: '/b',
        requestContext: { http: { method: 'POST' } },
        headers: { 'content-type': 'text/plain' },
        body: btoa('hello-bytes'),
        isBase64Encoded: true,
      })
    );
    const body = JSON.parse(res.body) as { raw: string };
    expect(body.raw).toBe('hello-bytes');
  });

  it('moves Set-Cookie into the result cookies field', async () => {
    const app = createApp();
    app.use((ctx) => {
      ctx.set('set-cookie', 'sid=abc; Path=/');
      ctx.json({ ok: true });
    });
    const handler = createServerlessAdapter({ mappers: [lambdaFunctionUrl] }).createHandler(app);

    const res = await handler(event({ rawPath: '/c' }));
    expect(res.cookies).toBeDefined();
    expect(res.cookies?.some((c) => c.includes('sid=abc'))).toBe(true);
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});

describe('mapper selection', () => {
  const detectAll: EventMapper<LambdaFunctionUrlEvent, { statusCode: number; headers: Record<string, string>; body: string; isBase64Encoded: boolean }> =
    {
      name: 'always',
      toRequest: () => new Request('http://localhost/WRONG'),
      fromResponse: (r) => ({ statusCode: r.status, headers: {}, body: 'WRONG', isBase64Encoded: false }),
      detect: () => true,
    };

  it('explicit provider wins over a matching detect()', async () => {
    const app = createApp();
    app.use((ctx) => {
      ctx.json({ path: ctx.path });
    });
    // `detectAll` is first and would match, but the explicit provider forces lambda.
    const handler = createServerlessAdapter({
      mappers: [detectAll, lambdaFunctionUrl],
      provider: 'lambda-function-url',
    }).createHandler(app);

    const res = await handler(event({ rawPath: '/right' }));
    const body = JSON.parse(res.body) as { path: string };
    expect(body.path).toBe('/right'); // proves lambda mapper (not detectAll) was used
  });

  it('falls back to detect() when no provider is set', async () => {
    const app = createApp();
    app.use((ctx) => {
      ctx.json({ path: ctx.path });
    });
    const handler = createServerlessAdapter({ mappers: [lambdaFunctionUrl] }).createHandler(app);
    const res = await handler(event({ rawPath: '/detected' }));
    const body = JSON.parse(res.body) as { path: string };
    expect(body.path).toBe('/detected');
  });

  it('throws for an unknown explicit provider', () => {
    const app = createApp();
    const handler = createServerlessAdapter({
      mappers: [lambdaFunctionUrl],
      provider: 'nope',
    }).createHandler(app);
    return expect(handler(event())).rejects.toThrow(/No EventMapper named "nope"/);
  });
});

describe('no global registry (adapter-scoped)', () => {
  it('two adapters with different mappers stay isolated', async () => {
    const app = createApp();
    app.use((ctx) => {
      ctx.json({ path: ctx.path });
    });

    const a = createServerlessAdapter({ mappers: [lambdaFunctionUrl] }).createHandler(app);
    const b = createServerlessAdapter({ mappers: [] }).createHandler(app);

    const resA = await a(event({ rawPath: '/a' }));
    expect((JSON.parse(resA.body) as { path: string }).path).toBe('/a');

    // `b` has no mappers, so it cannot resolve — proving its registry is its own,
    // not a shared global that `a` populated.
    await expect(b(event({ rawPath: '/b' }))).rejects.toThrow(/No EventMapper matched/);
  });
});

describe('execution model', () => {
  it('per-invocation timeout returns 504 and aborts the handler', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      // Resolve only when the timeout aborts the request (avoids a hanging promise).
      await new Promise<void>((resolve) => {
        ctx.signal.addEventListener('abort', () => {
          resolve();
        }, { once: true });
      });
    });
    const handler = createServerlessAdapter({ mappers: [lambdaFunctionUrl], timeout: 10 }).createHandler(app);
    const res = await handler(event({ rawPath: '/slow' }));
    expect(res.statusCode).toBe(504);
  });

  it('buffers a streamed response body into the Function URL result', async () => {
    const app = createApp();
    app.use(async (ctx) => {
      ctx.set('content-type', 'text/plain');
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('chunk1'));
          controller.enqueue(new TextEncoder().encode('chunk2'));
          controller.close();
        },
      });
      await ctx.sendStream(stream);
    });
    const handler = createServerlessAdapter({ mappers: [lambdaFunctionUrl] }).createHandler(app);
    const res = await handler(event({ rawPath: '/s' }));
    const text = res.isBase64Encoded ? atob(res.body) : res.body;
    expect(text).toBe('chunk1chunk2');
  });
});
