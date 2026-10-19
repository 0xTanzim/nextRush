// Drives the documented `Bun.serve({ fetch: createHandler(app) })` pattern with an
// app-owned router and no explicit `await app.ready()`. The entry point is expected
// to boot the application itself, so `/` must answer rather than fall through to an
// empty 200.
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { createHandler } from '@nextrush/adapter-bun';

const app = createApp({ router: createRouter() });
app.get('/', (ctx) => ctx.json({ ok: 1 }));
// NOTE: intentionally no `await app.ready()` here.
Bun.serve({ port: Number(process.env.PORT), fetch: createHandler(app) });
console.log('listening');
