// Per-request cost of a parsed JSON POST on Hono, NO network.
// Mirrors `inproc-nextrush-post`: same request bytes, same count, same warmup.
// Env: N (iterations), HEADERS (0|4|12 request headers), BODY_BYTES (payload size).
import { Hono } from 'hono';
import { runInproc } from './_inproc-adapter';

const N = Number(process.env.N ?? 300000);
const BODY_BYTES = Number(process.env.BODY_BYTES ?? 1024);
const PREBUILD_CAP = 20_000;
const WARMUP = 2_000;
const COUNT = Math.min(N, PREBUILD_CAP - WARMUP);

const app = new Hono();
app.post('/echo', async (c) => {
  await c.req.json();
  return c.json({ ok: true });
});

const all: Record<string, string> = { host: 'localhost:3000', 'user-agent': 'curl/8', accept: '*/*', connection: 'keep-alive',
  'accept-encoding': 'gzip, br', 'accept-language': 'en-US,en;q=0.9', cookie: 'a=1; b=2', referer: 'http://localhost/', 'cache-control': 'no-cache',
  'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin', 'x-request-id': 'abc' };
const headers = {
  ...Object.fromEntries(Object.entries(all).slice(0, Number(process.env.HEADERS ?? 4))),
  'content-type': 'application/json',
};
const body = JSON.stringify({ name: 'x'.repeat(Math.max(0, BODY_BYTES - 12)) });
const requests = Array.from(
  { length: COUNT + WARMUP },
  () => new Request('http://localhost:3000/echo', { method: 'POST', headers, body })
);
console.log(`COUNT=${COUNT}`);

await runInproc((i) => app.fetch(requests[i] as Request), COUNT, WARMUP, 'hono');
