// Per-request cost of a POST with a parsed JSON body, NO network.
// The row exercises the adapter this runtime ships (printed as ADAPTER/RUNTIME);
// on the Web arm the constructed requests are pre-built because platform
// construction is not framework work.
// Env: N (iterations), HEADERS (0|4|12 request headers), BODY_BYTES (payload size).
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { bodyParser } from '@nextrush/body-parser';
import { prepare, runInproc, statusOf } from './_inproc-adapter';

const N = Number(process.env.N ?? 300000);
const BODY_BYTES = Number(process.env.BODY_BYTES ?? 1024);
const PREBUILD_CAP = 20_000;
const COUNT = Math.min(N, PREBUILD_CAP);
const WARMUP = 2_000;

const app = createApp({ router: createRouter() });
app.use(bodyParser());
app.post('/echo', (ctx) => ctx.json({ ok: true }));
await app.ready();

const all: Record<string, string> = { host: 'localhost:3000', 'user-agent': 'curl/8', accept: '*/*', connection: 'keep-alive',
  'accept-encoding': 'gzip, br', 'accept-language': 'en-US,en;q=0.9', cookie: 'a=1; b=2', referer: 'http://localhost/', 'cache-control': 'no-cache',
  'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin', 'x-request-id': 'abc' };
const headers = {
  ...Object.fromEntries(Object.entries(all).slice(0, Number(process.env.HEADERS ?? 4))),
  'content-type': 'application/json',
};
const body = JSON.stringify({ name: 'x'.repeat(Math.max(0, BODY_BYTES - 12)) });

const dispatch = prepare(app, { path: '/echo', headers, body }, COUNT);
console.log(`OK=${statusOf(await dispatch(0))}`);

await runInproc(dispatch, COUNT, WARMUP);
