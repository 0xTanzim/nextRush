// Per-request framework cost, NO network: call the fetch-style handler in a loop.
// Env: N (iterations), HEADERS (0|4|12 request headers), TIMEOUT (0 disables the race).
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { createHandler } from '@nextrush/adapter-bun';
const N = Number(process.env.N ?? 300000);
const app = createApp({ router: createRouter() });
app.get('/', (ctx) => ctx.json({ hello: 'world' }));
await app.ready();
const handle = createHandler(app, process.env.TIMEOUT === '0' ? { timeout: 0 } : {});
const server = { requestIP: () => ({ address: '1.1.1.1' }) } as never;
const all: Record<string, string> = { host: 'localhost:3000', 'user-agent': 'curl/8', accept: '*/*', connection: 'keep-alive',
  'accept-encoding': 'gzip, br', 'accept-language': 'en-US,en;q=0.9', cookie: 'a=1; b=2', referer: 'http://localhost/', 'cache-control': 'no-cache',
  'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin', 'x-request-id': 'abc' };
const H = Object.fromEntries(Object.entries(all).slice(0, Number(process.env.HEADERS ?? 4)));
for (let i = 0; i < 30000; i++) await handle(new Request('http://localhost:3000/', { headers: H }), server);
const t0 = performance.now();
for (let i = 0; i < N; i++) await handle(new Request('http://localhost:3000/', { headers: H }), server);
console.log(`US=${(((performance.now() - t0) / N) * 1000).toFixed(3)}`);
