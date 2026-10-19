/**
 * Worker entry for real-workerd conformance (task 3.3).
 *
 * Boots an app on the edge adapter and exposes a `fetch` handler. Bundled by the
 * test (esbuild) and loaded into a real workerd isolate via miniflare, so the
 * edge adapter is exercised on-runtime, not simulated under Node/vitest.
 */

import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { createFetchHandler } from '@nextrush/adapter-edge';
import { bodyParser } from '@nextrush/body-parser';

const app = createApp({ router: createRouter() });

// The unparsed-content-type policy belongs to a parser instance, so the worker
// builds one of each and routes each path to the policy it is asserting.
const defaultParser = bodyParser();
const rejectingParser = bodyParser({ onUnsupportedContentType: 'reject' });

app.use((ctx, next) =>
  ctx.path === '/reject-xml' ? rejectingParser(ctx, next) : defaultParser(ctx, next)
);

// Registered before the catch-all below, which answers every path it sees.
// The mount is at a case-mismatching prefix on purpose: it is matched
// case-insensitively, and the remainder handed to the mounted router must still
// carry the request's casing for its parameter values to be correct.
const router = createRouter();
router.get('/Users/:name', (ctx) => {
  ctx.json({ name: ctx.params.name, path: ctx.path });
});
router.get('/Files/*', (ctx) => {
  ctx.json({ wildcard: ctx.params['*'] });
});
app.route('/API', router);

// Declared on the application's OWN router, which only boot mounts. The handler
// below is built on first request and `ready()` is never called, so reaching this
// route is the proof that the entry point booted before it dispatched.
app.get('/booted', (ctx) => {
  ctx.json({ booted: true });
});

app.use(async (ctx) => {
  if (ctx.path === '/bad-json' && ctx.method === 'POST') {
    // Reaching here would mean the malformed body was accepted; the parser is
    // expected to have answered 400 before the chain got this far.
    ctx.json({ parsed: ctx.body });
    return;
  }
  if (ctx.path === '/reject-xml' && ctx.method === 'POST') {
    // Same as `/bad-json`: the rejecting policy is expected to have answered 415.
    ctx.json({ reached: true });
    return;
  }
  if (ctx.path === '/ignore-xml' && ctx.method === 'POST') {
    ctx.json({ body: ctx.body ?? null });
    return;
  }
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
  if (ctx.path === '/unserializable') {
    // A body JSON cannot represent: the response must be answered, not left empty.
    ctx.json({ id: 10n });
    return;
  }
  if (ctx.path === '/nothing-written') {
    // An error status nothing wrote: the finalizer answers it.
    ctx.status = 503;
    return;
  }
  if (ctx.path === '/') {
    ctx.json({ hello: 'world', n: 42, nested: { a: [1, 2, 3] } });
    return;
  }
  if (ctx.path === '/booted' || ctx.path === '/unrouted') {
    // Handed off explicitly to the router boot mounted: `/booted` must be reached
    // through it, and `/unrouted` must end as the framework 404 rather than as an
    // empty 200. A bare `return` would end the chain here instead.
    await ctx.next();
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
