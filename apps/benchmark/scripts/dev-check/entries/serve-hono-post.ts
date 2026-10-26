// Wire-benchmark server for a parsed 1 KB JSON POST on Hono. Env: PORT.
// Mirrors `serve-hono` and `inproc-hono-post` so every POST row describes one shape.
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
const app = new Hono();
app.post('/', async (c) => {
  await c.req.json();
  return c.json({ ok: true });
});
const port = Number(process.env.PORT);
const D = (globalThis as { Deno?: { serve: (o: unknown) => unknown } }).Deno;
const B = (globalThis as { Bun?: { serve: (o: unknown) => unknown } }).Bun;
if (D) D.serve({ port, handler: (request: Request) => app.fetch(request) });
else if (B) B.serve({ port, fetch: app.fetch });
else serve({ fetch: app.fetch, port });
