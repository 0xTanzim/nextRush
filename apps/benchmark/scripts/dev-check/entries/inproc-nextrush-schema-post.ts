// Per-request cost of bodyParser + zod validation, NO network. The control entry
// runs the same middleware with an identity Standard Schema, so the difference
// is the schema library plus its wrapper, not the request shape.
// Env: N (iterations), BODY_BYTES (payload size).
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { bodyParser } from '@nextrush/body-parser';
import { validate } from '@nextrush/validation';
import { z } from 'zod';
import { prepare, runInproc } from './_inproc-adapter';

const N = Number(process.env.N ?? 300000);
const BODY_BYTES = Number(process.env.BODY_BYTES ?? 1024);
const PREBUILD_CAP = 20_000;
const WARMUP = 2_000;
const COUNT = Math.min(N, PREBUILD_CAP - WARMUP);

const Body = z.object({
  name: z.string().min(1),
  tags: z.array(z.string()).max(64),
  pad: z.string(),
});

const app = createApp({ router: createRouter() });
app.use(bodyParser());
app.use(validate(Body));
app.post('/echo', (ctx) => ctx.json({ ok: true }));
await app.ready();

const tags = Array.from({ length: 32 }, (_, i) => `tag-${i}`);
const padLength = Math.max(0, BODY_BYTES - JSON.stringify({ name: 'bench', tags, pad: '' }).length);
const body = JSON.stringify({ name: 'bench', tags, pad: 'x'.repeat(padLength) });
const dispatch = prepare(
  app,
  { path: '/echo', method: 'POST', headers: { 'content-type': 'application/json' }, body },
  WARMUP + COUNT
);
await runInproc(dispatch, COUNT, WARMUP);
