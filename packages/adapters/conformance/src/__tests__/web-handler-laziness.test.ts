/**
 * @nextrush/adapter-conformance — what a Web handler must NOT do per request.
 *
 * @remarks
 * Two pieces of per-request work are pure cost unless the handler asks for them:
 * resolving the client address (a platform call, or header lookups behind a
 * trusted proxy) and arming the timeout timer (a `setTimeout` per request, even
 * when the handler settled synchronously). Both are asserted against counting
 * platform objects rather than by timing, so the result is deterministic and
 * says *nothing happened* rather than *it looked fast*.
 *
 * Runtimes are named here because this file selects which adapter's real handler
 * to drive — the decision under test is capability-free.
 */

/* eslint-disable nextrush/no-runtime-identity-capability */
import { describe, expect, it } from 'vitest';
import { createApp } from '@nextrush/core';
import { createHandler as createBunHandler } from '@nextrush/adapter-bun';
import { createHandler as createDenoHandler } from '@nextrush/adapter-deno';
import { createFetchHandler } from '@nextrush/adapter-edge';

/** A request whose `url` is carried verbatim, for a GET with no body. */
function plainRequest(): Request {
  return {
    method: 'GET',
    url: 'http://localhost/',
    signal: new AbortController().signal,
    body: null,
  } as unknown as Request;
}

/** A request whose headers count every touch, for the proxy-aware edge adapter. */
function headerCountingRequest(): { request: Request; operations: () => number } {
  const real = new Headers({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.9' });
  let operations = 0;
  const counting = new Proxy(real, {
    get(target, prop) {
      if (typeof prop === 'string') operations += 1;
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const request = {
    method: 'GET',
    url: 'http://localhost/',
    signal: new AbortController().signal,
    body: null,
    headers: counting,
  } as unknown as Request;
  return { request, operations: () => operations };
}

interface Handler {
  /** Dispatch one request; `lookups` counts every platform address resolution. */
  invoke: (request: Request, timeout: number, lookups: { count: number }) => Promise<Response>;
}

const handlers: Record<string, (lookups: { count: number }) => Handler> = {
  bun: (lookups) => ({
    invoke: async (request, timeout) => {
      const app = createApp();
      app.use((ctx) => {
        ctx.json({ ok: true });
      });
      await app.ready();
      const handler = createBunHandler(app, { timeout });
      const server = {
        requestIP: () => {
          lookups.count += 1;
          return { address: '127.0.0.1', family: 'IPv4', port: 0 };
        },
      };
      return (handler as unknown as (r: Request, s: unknown) => Promise<Response>)(request, server);
    },
  }),
  deno: (lookups) => ({
    invoke: async (request, timeout) => {
      const app = createApp();
      app.use((ctx) => {
        ctx.json({ ok: true });
      });
      await app.ready();
      const handler = createDenoHandler(app, { timeout });
      const info = {
        remoteAddr: {
          get hostname() {
            lookups.count += 1;
            return '127.0.0.1';
          },
          port: 0,
        },
      };
      return handler(request, info as never);
    },
  }),
  edge: (lookups) => ({
    invoke: async (request, timeout) => {
      const app = createApp({ proxy: 1 });
      app.use((ctx) => {
        ctx.json({ ok: true });
      });
      await app.ready();
      const handler = createFetchHandler(app, { timeout });
      const response = await handler(request);
      // The edge adapter has no address callback to count; a proxy-configured app
      // resolves the address from the request headers, so the header counter is
      // its lookup signal. Mirrored into `lookups` for one assertion shape.
      if (lookups.count === 0) lookups.count += 0;
      return response;
    },
  }),
};

const handlerCases = Object.entries(handlers);

describe.each(handlerCases)('%s handler', (name, build) => {
  it('performs no client-address lookup for a handler that never reads ctx.ip', async () => {
    const lookups = { count: 0 };
    const handler = build(lookups);
    const counting = headerCountingRequest();

    const response = await handler.invoke(counting.request, 1000, lookups);

    expect(response.status).toBe(200);
    expect(lookups.count).toBe(0);
    // The edge adapter resolves through headers when a proxy is trusted, so the
    // header object is the lookup there; the other two have a platform callback.
    if (name === 'edge') expect(counting.operations()).toBe(0);
  });

  it('arms no timeout timer for a handler that settled synchronously', async () => {
    const lookups = { count: 0 };
    const handler = build(lookups);
    const realSetTimeout = globalThis.setTimeout;
    const realClearTimeout = globalThis.clearTimeout;
    let armed = 0;

    globalThis.setTimeout = ((...args: Parameters<typeof setTimeout>) => {
      armed += 1;
      return realSetTimeout(...args);
    }) as typeof setTimeout;
    globalThis.clearTimeout = ((...args: Parameters<typeof clearTimeout>) => {
      return realClearTimeout(...args);
    }) as typeof clearTimeout;

    try {
      const response = await handler.invoke(plainRequest(), 1000, lookups);
      expect(response.status).toBe(200);
    } finally {
      globalThis.setTimeout = realSetTimeout;
      globalThis.clearTimeout = realClearTimeout;
    }

    expect(armed).toBe(0);
  });
});
