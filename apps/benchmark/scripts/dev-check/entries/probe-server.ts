// One server exposing every endpoint the correctness probes drive: routes for the
// path/param/wildcard shape, endpoints that hand `ctx.json` a value it cannot
// serialize, an echo endpoint for the body-parser and error-shape probes, and a
// large response for the compression probe. The probe registry that consumes these
// endpoints lives in `check.mjs`.
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { bodyParser } from '@nextrush/body-parser';
import { compression } from '@nextrush/compression';
import { timer, serverTiming } from '@nextrush/timer';
import { serve as serveBun } from '@nextrush/adapter-bun';
import { serve as serveNode } from '@nextrush/adapter-node';

const app = createApp({ router: createRouter() });
app.use(timer({ exposeHeader: true }));
app.use(serverTiming({ exposeHeader: true }));
app.use(compression({ threshold: 0 }));
app.use(bodyParser({ onUnsupportedContentType: 'reject' }));

const echo = (ctx: any) =>
  ctx.json({ path: ctx.path, original: ctx.originalPath, params: ctx.params, query: ctx.query });
app.get('/', (ctx: any) => ctx.json({ ok: 1 }));
app.get('/users/:id', echo);
app.get('/files/*', echo);
app.get('/admin', (ctx: any) => ctx.json({ admin: true }));
app.post('/echo', (ctx: any) => ctx.json({ body: ctx.body, type: typeof ctx.body }));
app.get('/boom', () => {
  throw new Error('secret-db-password-123');
});
app.get('/circular', (ctx: any) => {
  const a: any = {};
  a.self = a;
  ctx.json(a);
});
app.get('/bigint', (ctx: any) => ctx.json({ n: 10n }));
app.get('/undef', (ctx: any) => ctx.json(undefined));
app.get('/big', (ctx: any) =>
  ctx.json({ items: Array.from({ length: 400 }, (_, i) => ({ id: i, name: `item-${i}`, tags: ['a', 'b', 'c'] })) })
);

const port = Number(process.env.PORT);
if (typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined') await serveBun(app, { port });
else await serveNode(app, { port });
console.log('listening');
