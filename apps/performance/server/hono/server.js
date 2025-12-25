/**
 * Hono Server (Node.js)
 * Benchmark parity with NextRush
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const app = new Hono();

// 1. Hello World
app.get('/', (c) => {
  return c.json({ message: 'Hello World' });
});

// 2. Route Params
app.get('/users/:id', (c) => {
  const id = c.req.param('id');
  return c.json({ id, name: `User ${id}` });
});

// 3. POST JSON
app.post('/users', async (c) => {
  const data = await c.req.json();
  return c.json({ success: true, user: data });
});

const port = process.env.PORT || 3003;

serve({
  fetch: app.fetch,
  port,
});

console.log(`Hono running on :${port}`);
