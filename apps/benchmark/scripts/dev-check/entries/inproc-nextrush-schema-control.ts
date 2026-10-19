// Control for `inproc-nextrush-schema-post`: same bodyParser + validate
// middleware count, identity Standard Schema, same request shape. The difference
// isolates the schema library and the validation wrapper.
// Env: N (iterations), BODY_BYTES (payload size).
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { bodyParser } from '@nextrush/body-parser';
import { validate } from '@nextrush/validation';
import type { StandardSchemaV1 } from '@nextrush/types';
import { prepare, runInproc } from './_inproc-adapter';

const N = Number(process.env.N ?? 300000);
const BODY_BYTES = Number(process.env.BODY_BYTES ?? 1024);
const PREBUILD_CAP = 20_000;
const WARMUP = 2_000;
const COUNT = Math.min(N, PREBUILD_CAP - WARMUP);

const identity: StandardSchemaV1 = {
  '~standard': {
    version: 1,
    vendor: 'benchmark',
    validate: (value) => ({ value }),
  },
};

const app = createApp({ router: createRouter() });
app.use(bodyParser());
app.use(validate(identity));
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
