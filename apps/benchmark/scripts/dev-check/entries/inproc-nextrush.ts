// Per-request framework cost, NO network: call the adapter's handler in a loop.
// The row exercises the adapter this runtime ships; the printed ADAPTER/RUNTIME
// line reports which one, so a Node row is never a Web-runner number in disguise.
// Env: N (iterations), HEADERS (0|4|12 request headers), TIMEOUT (0 disables the race).
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { prepare, runInproc } from './_inproc-adapter';

const N = Number(process.env.N ?? 300000);
const app = createApp({ router: createRouter() });
app.get('/', (ctx) => ctx.json({ hello: 'world' }));
await app.ready();

const all: Record<string, string> = { host: 'localhost:3000', 'user-agent': 'curl/8', accept: '*/*', connection: 'keep-alive',
  'accept-encoding': 'gzip, br', 'accept-language': 'en-US,en;q=0.9', cookie: 'a=1; b=2', referer: 'http://localhost/', 'cache-control': 'no-cache',
  'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin', 'x-request-id': 'abc' };
const headers = Object.fromEntries(Object.entries(all).slice(0, Number(process.env.HEADERS ?? 4)));

const dispatch = prepare(app, {
  path: '/',
  headers,
  timeoutMs: process.env.TIMEOUT === '0' ? 0 : undefined,
});

await runInproc(dispatch, N, 30000);
