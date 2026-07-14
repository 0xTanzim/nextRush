/**
 * Real-runtime conformance — Deno (runtime-proof-harness, task 3.2).
 *
 * Runs the Deno adapter's real request handler under the REAL Deno runtime
 * (`deno test`), not simulated under Node/vitest. Asserts the same core
 * observable behaviors the cross-adapter suite pins, proving parity on-runtime.
 *
 * Run: cd packages/adapters/conformance/deno-runner && deno task conformance
 */

import assert from 'node:assert/strict';
import { createApp } from '@nextrush/core';
import { createHandler } from '@nextrush/adapter-deno';
import { detectRuntime } from '@nextrush/runtime';

/** Drive one request through the real Deno adapter handler. */
async function dispatch(
  configure: (app: ReturnType<typeof createApp>) => void,
  init?: { method?: string; path?: string; headers?: Record<string, string>; body?: string },
): Promise<Response> {
  const app = createApp();
  configure(app);
  await app.ready();
  const handler = createHandler(app);
  const req = new Request(`http://localhost${init?.path ?? '/'}`, {
    method: init?.method ?? 'GET',
    headers: init?.headers,
    ...(init?.body !== undefined ? { body: init.body } : {}),
  });
  return handler(req, { remoteAddr: { hostname: '127.0.0.1', port: 0 } });
}

Deno.test('runs under the real Deno runtime', () => {
  assert.equal(detectRuntime(), 'deno');
});

Deno.test('#1 method upper-cased; path split from query', async () => {
  const res = await dispatch(
    (app) => {
      app.use((ctx) => {
        ctx.json({ method: ctx.method, path: ctx.path });
      });
    },
    { method: 'get', path: '/users/5?x=1' },
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as { method: string; path: string };
  assert.equal(body.method, 'GET');
  assert.equal(body.path, '/users/5');
});

Deno.test('#2 query repeats become arrays; __proto__ rejected', async () => {
  const res = await dispatch(
    (app) => {
      app.use((ctx) => {
        ctx.json({ a: ctx.query.a, b: ctx.query.b });
      });
    },
    { path: '/q?a=1&b=2&b=3&__proto__=evil' },
  );
  const body = (await res.json()) as { a: string; b: string[] };
  assert.equal(body.a, '1');
  assert.deepEqual(body.b, ['2', '3']);
  assert.equal((Object.prototype as Record<string, unknown>).evil, undefined);
});

Deno.test('#3 route params writable + readable across middleware', async () => {
  const res = await dispatch((app) => {
    app.use(async (ctx) => {
      ctx.params = { id: '42' };
      await ctx.next();
    });
    app.use((ctx) => {
      ctx.json({ id: ctx.params.id });
    });
  });
  const body = (await res.json()) as { id: string };
  assert.equal(body.id, '42');
});

Deno.test('#4 JSON body parsed on POST', async () => {
  const res = await dispatch(
    (app) => {
      app.use(async (ctx) => {
        const raw = await ctx.bodySource.text();
        ctx.json({ echo: JSON.parse(raw) as unknown });
      });
    },
    { method: 'POST', path: '/echo', headers: { 'content-type': 'application/json' }, body: '{"n":7}' },
  );
  const body = (await res.json()) as { echo: { n: number } };
  assert.equal(body.echo.n, 7);
});

Deno.test('#16 thrown HttpError maps to status; body not leaked as 500', async () => {
  const res = await dispatch((app) => {
    app.use((ctx) => {
      ctx.throw(404, 'nope');
    });
  });
  assert.equal(res.status, 404);
});
