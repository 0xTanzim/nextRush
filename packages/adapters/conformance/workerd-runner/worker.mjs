/**
 * Worker entry for real-workerd conformance (task 3.3).
 *
 * Boots an app on the edge adapter and exposes a `fetch` handler. Bundled by the
 * test (esbuild) and loaded into a real workerd isolate via miniflare, so the
 * edge adapter is exercised on-runtime, not simulated under Node/vitest.
 */

import { createApp } from '@nextrush/core';
import { createFetchHandler } from '@nextrush/adapter-edge';

const app = createApp();

app.use(async (ctx) => {
  if (ctx.path === '/echo' && ctx.method === 'POST') {
    // Body + JSON round-trip on the edge runtime.
    const raw = await ctx.bodySource.text();
    ctx.json({ echo: JSON.parse(raw) });
    return;
  }
  if (ctx.path === '/boom') {
    ctx.throw(404, 'nope');
    return;
  }
  if (ctx.path === '/cookies') {
    ctx.set('Set-Cookie', ['a=1; Path=/', 'b=2; Path=/']);
    ctx.status = 204;
    return;
  }
  if (ctx.path === '/crash') {
    throw new Error('secret-leak-123');
  }
  if (ctx.path === '/') {
    ctx.json({ hello: 'world', n: 42, nested: { a: [1, 2, 3] } });
    return;
  }
  ctx.json({ method: ctx.method, path: ctx.path, a: ctx.query.a });
});

let handler;

export default {
  fetch(request) {
    handler ??= createFetchHandler(app);
    return handler(request);
  },
};
