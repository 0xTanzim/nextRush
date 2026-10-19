// Per-request cost of a five-middleware stack around a JSON handler, NO network.
// Compared against `inproc-nextrush` (zero middleware) the delta is the stack cost.
// Env: N (iterations), HEADERS (0|4|12 request headers).
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { createHandler } from '@nextrush/adapter-bun';

const N = Number(process.env.N ?? 300000);
const MW_COUNT = 5;

const app = createApp({ router: createRouter() });
for (let i = 0; i < MW_COUNT; i++) {
  app.use(async (ctx, next) => {
    ctx.state[`mw${i}`] = i;
    await next();
  });
}
app.get('/', (ctx) => ctx.json({ ok: true }));
await app.ready();

const handle = createHandler(app);
const server = { requestIP: () => ({ address: '1.1.1.1' }) } as never;

const all: Record<string, string> = { host: 'localhost:3000', 'user-agent': 'curl/8', accept: '*/*', connection: 'keep-alive',
  'accept-encoding': 'gzip, br', 'accept-language': 'en-US,en;q=0.9', cookie: 'a=1; b=2', referer: 'http://localhost/', 'cache-control': 'no-cache',
  'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin', 'x-request-id': 'abc' };
const headers = Object.fromEntries(Object.entries(all).slice(0, Number(process.env.HEADERS ?? 4)));
const request = () => new Request('http://localhost:3000/', { headers });

const first = await handle(request(), server);
console.log(`MW=${MW_COUNT} OK=${first.status}:${await first.text()}`);

for (let i = 0; i < 30_000; i++) await handle(request(), server);
const t0 = performance.now();
for (let i = 0; i < N; i++) await handle(request(), server);
console.log(`US=${(((performance.now() - t0) / N) * 1000).toFixed(3)}`);
