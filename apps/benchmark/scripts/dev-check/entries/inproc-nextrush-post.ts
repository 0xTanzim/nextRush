// Per-request cost of a POST with a parsed JSON body, NO network.
// Env: N (iterations), HEADERS (0|4|12 request headers), BODY_BYTES (payload size).
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { bodyParser } from '@nextrush/body-parser';
import { createHandler } from '@nextrush/adapter-bun';

const N = Number(process.env.N ?? 300000);
const BODY_BYTES = Number(process.env.BODY_BYTES ?? 1024);

const app = createApp({ router: createRouter() });
app.use(bodyParser());
app.post('/echo', (ctx) => ctx.json({ ok: true }));
await app.ready();

const handle = createHandler(app);
const server = { requestIP: () => ({ address: '1.1.1.1' }) } as never;

const all: Record<string, string> = { host: 'localhost:3000', 'user-agent': 'curl/8', accept: '*/*', connection: 'keep-alive',
  'accept-encoding': 'gzip, br', 'accept-language': 'en-US,en;q=0.9', cookie: 'a=1; b=2', referer: 'http://localhost/', 'cache-control': 'no-cache',
  'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin', 'x-request-id': 'abc' };
const headers = {
  ...Object.fromEntries(Object.entries(all).slice(0, Number(process.env.HEADERS ?? 4))),
  'content-type': 'application/json',
};
const body = JSON.stringify({ name: 'x'.repeat(Math.max(0, BODY_BYTES - 12)) });
const request = () => new Request('http://localhost:3000/echo', { method: 'POST', headers, body });

const first = await handle(request(), server);
console.log(`OK=${first.status}:${await first.text()}`);

for (let i = 0; i < 10_000; i++) await handle(request(), server);
const t0 = performance.now();
for (let i = 0; i < N; i++) await handle(request(), server);
console.log(`US=${(((performance.now() - t0) / N) * 1000).toFixed(3)}`);
