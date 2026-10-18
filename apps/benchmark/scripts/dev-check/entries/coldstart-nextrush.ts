// Cold start: register N routes, boot, serve ONE request in-process. Prints T (ms since
// process start, includes runtime boot) and RSS. Env: N (routes, default 25).
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { createHandler } from '@nextrush/adapter-bun';
const N = Number(process.env.N ?? 25);
const app = createApp({ router: createRouter() });
for (let i = 0; i < N; i++) app.get(`/r${i}/:id`, (ctx) => ctx.json({ i, id: ctx.params.id }));
await app.ready();
const handle = createHandler(app);
const res = await handle(new Request('http://x/r0/5'), { requestIP: () => ({ address: '1.1.1.1' }) } as never);
await res.text();
console.log(`T=${performance.now().toFixed(2)} RSS=${(process.memoryUsage().rss / 1048576).toFixed(1)} status=${res.status}`);
