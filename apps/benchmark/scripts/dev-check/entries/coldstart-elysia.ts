// Cold start for the Elysia reference arm: register N routes, boot, serve one
// request in-process. Bun-only. Env: N (routes, default 25).
import { Elysia } from 'elysia';
const N = Number(process.env.N ?? 25);
const app = new Elysia();
for (let i = 0; i < N; i++) app.get(`/r${i}/:id`, ({ params }) => ({ i, id: params.id }));
const res = await app.handle(new Request('http://x/r0/5'));
await res.text();
console.log(
  `T=${performance.now().toFixed(2)} RSS=${(process.memoryUsage().rss / 1048576).toFixed(1)} status=${res.status}`
);
