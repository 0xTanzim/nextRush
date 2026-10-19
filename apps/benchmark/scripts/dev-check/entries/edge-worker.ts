// What a Cloudflare Worker ships: the edge adapter's handler, no server.
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { bodyParser } from '@nextrush/body-parser';
import { compression } from '@nextrush/compression';
import { timer, serverTiming } from '@nextrush/timer';
import { createCloudflareHandler } from '@nextrush/adapter-edge';

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
  ctx.json({
    items: Array.from({ length: 400 }, (_, i) => ({
      id: i,
      name: `item-${i}`,
      tags: ['a', 'b', 'c'],
    })),
  })
);

export default createCloudflareHandler(app);
