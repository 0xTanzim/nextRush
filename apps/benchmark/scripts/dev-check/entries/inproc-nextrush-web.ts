// Control row: the Web runner, on whatever runtime executes this file.
//
// The runtime-selected rows answer "what does this runtime's adapter cost". This
// one deliberately keeps the Web runner everywhere, so a Node run can show both
// adapters side by side on the same machine: the difference is the adapter, not
// the hardware. It is reported as INFO and never gated.
// Env: N (iterations), HEADERS (0|4|12 request headers).
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { createHandler } from '@nextrush/adapter-bun';

const N = Number(process.env.N ?? 300000);
const app = createApp({ router: createRouter() });
app.get('/', (ctx) => ctx.json({ hello: 'world' }));
await app.ready();

const handle = createHandler(app);
const server = { requestIP: () => ({ address: '1.1.1.1' }) } as never;

const all: Record<string, string> = { host: 'localhost:3000', 'user-agent': 'curl/8', accept: '*/*', connection: 'keep-alive',
  'accept-encoding': 'gzip, br', 'accept-language': 'en-US,en;q=0.9', cookie: 'a=1; b=2', referer: 'http://localhost/', 'cache-control': 'no-cache',
  'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin', 'x-request-id': 'abc' };
const headers = Object.fromEntries(Object.entries(all).slice(0, Number(process.env.HEADERS ?? 4)));
const request = () => new Request('http://localhost:3000/', { headers });

for (let i = 0; i < 30_000; i++) await handle(request(), server);
const started = performance.now();
for (let i = 0; i < N; i++) await handle(request(), server);
console.log(`US=${(((performance.now() - started) / N) * 1000).toFixed(3)}`);
console.log('ADAPTER=adapter-bun RUNTIME=control');
