import { Hono } from 'hono';
const N = Number(process.env.N ?? 300000);
const app = new Hono();
app.get('/', (c) => c.json({ hello: 'world' }));
const all: Record<string, string> = { host: 'localhost:3000', 'user-agent': 'curl/8', accept: '*/*', connection: 'keep-alive',
  'accept-encoding': 'gzip, br', 'accept-language': 'en-US,en;q=0.9', cookie: 'a=1; b=2', referer: 'http://localhost/', 'cache-control': 'no-cache',
  'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin', 'x-request-id': 'abc' };
const H = Object.fromEntries(Object.entries(all).slice(0, Number(process.env.HEADERS ?? 4)));
for (let i = 0; i < 30000; i++) await app.fetch(new Request('http://localhost:3000/', { headers: H }));
const t0 = performance.now();
for (let i = 0; i < N; i++) await app.fetch(new Request('http://localhost:3000/', { headers: H }));
console.log(`US=${(((performance.now() - t0) / N) * 1000).toFixed(3)}`);
