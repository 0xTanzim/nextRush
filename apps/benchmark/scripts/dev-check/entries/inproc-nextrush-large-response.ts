// Per-request cost of serializing and returning a fixed 400-object payload, NO
// network. The body is consumed so response serialization is part of the
// measurement rather than deferred until after `runInproc` returns.
// Env: N (iterations).
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { prepare, runInproc } from './_inproc-adapter';

const N = Number(process.env.N ?? 100000);
const WARMUP = 2_000;
const COUNT = Math.min(N, 98_000);

const payload = {
  items: Array.from({ length: 400 }, (_, i) => ({
    id: i,
    name: `item-${i}`,
    tags: ['a', 'b', 'c'],
  })),
};

const app = createApp({ router: createRouter() });
app.get('/big', (ctx) => ctx.json(payload));
await app.ready();

const dispatch = prepare(app, { path: '/big', headers: { accept: '*/*' } });
const consume = async (i: number): Promise<void> => {
  const result = await dispatch(i);
  if (result instanceof Response) await result.text();
};

await runInproc(consume, COUNT, WARMUP);
