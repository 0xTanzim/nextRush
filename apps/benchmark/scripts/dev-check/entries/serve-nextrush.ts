// Wire-benchmark server. Env: PORT, TIMEOUT (0 disables the handler race).
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { serve as serveBun } from '@nextrush/adapter-bun';
import { serve as serveNode } from '@nextrush/adapter-node';
const app = createApp({ router: createRouter() });
app.get('/', (ctx) => ctx.json({ hello: 'world' }));
const port = Number(process.env.PORT);
const opts = process.env.TIMEOUT === '0' ? { port, timeout: 0 } : { port };
if (typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined') await serveBun(app, opts);
else await serveNode(app, opts);
