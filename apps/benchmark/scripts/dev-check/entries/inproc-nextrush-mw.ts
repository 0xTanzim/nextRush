// Per-request cost of a five-middleware stack around a JSON handler, NO network.
// Compared against `inproc-nextrush` (zero middleware) the delta is the stack cost.
// The row exercises the adapter this runtime ships (printed as ADAPTER/RUNTIME).
// Env: N (iterations), HEADERS (0|4|12 request headers).
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { prepare, runInproc, statusOf } from './_inproc-adapter';

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

const all: Record<string, string> = { host: 'localhost:3000', 'user-agent': 'curl/8', accept: '*/*', connection: 'keep-alive',
  'accept-encoding': 'gzip, br', 'accept-language': 'en-US,en;q=0.9', cookie: 'a=1; b=2', referer: 'http://localhost/', 'cache-control': 'no-cache',
  'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin', 'x-request-id': 'abc' };
const headers = Object.fromEntries(Object.entries(all).slice(0, Number(process.env.HEADERS ?? 4)));

const dispatch = prepare(app, { path: '/', headers });
console.log(`MW=${MW_COUNT} OK=${statusOf(await dispatch(0))}`);

await runInproc(dispatch, N, 30_000);
