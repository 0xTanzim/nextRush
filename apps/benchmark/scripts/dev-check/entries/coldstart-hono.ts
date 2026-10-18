import { Hono } from 'hono';
const N = Number(process.env.N ?? 25);
const app = new Hono();
for (let i = 0; i < N; i++) app.get(`/r${i}/:id`, (c) => c.json({ i, id: c.req.param('id') }));
const res = await app.fetch(new Request('http://x/r0/5'));
await res.text();
console.log(`T=${performance.now().toFixed(2)} RSS=${(process.memoryUsage().rss / 1048576).toFixed(1)} status=${res.status}`);
