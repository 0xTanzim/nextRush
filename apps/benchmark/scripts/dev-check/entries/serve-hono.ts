import { Hono } from 'hono';
import { serve } from '@hono/node-server';
const app = new Hono();
app.get('/', (c) => c.json({ hello: 'world' }));
const port = Number(process.env.PORT);
const B = (globalThis as { Bun?: { serve: (o: unknown) => unknown } }).Bun;
if (B) B.serve({ port, fetch: app.fetch });
else serve({ fetch: app.fetch, port });
