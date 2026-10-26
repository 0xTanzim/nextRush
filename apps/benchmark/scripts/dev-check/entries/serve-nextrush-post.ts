// Wire-benchmark server for a parsed 1 KB JSON POST. Env: PORT.
// Mirrors `serve-nextrush` so the GET and POST rows share one adapter path, and
// mirrors `inproc-nextrush-post` so the socket and in-process rows share one shape.
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { bodyParser } from '@nextrush/body-parser';
import { serve as serveBun } from '@nextrush/adapter-bun';
import { serve as serveDeno } from '@nextrush/adapter-deno';
import { serve as serveNode } from '@nextrush/adapter-node';
const app = createApp({ router: createRouter() });
app.use(bodyParser());
app.post('/', (ctx) => ctx.json({ ok: true }));
const port = Number(process.env.PORT);
if (typeof (globalThis as { Deno?: unknown }).Deno !== 'undefined') await serveDeno(app, { port });
else if (typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined') await serveBun(app, { port });
else await serveNode(app, { port });
