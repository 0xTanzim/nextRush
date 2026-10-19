// Bundle entry for the Deno adapter: what a Deno app ships, no server started.
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { createHandler } from '@nextrush/adapter-deno';
const app = createApp({ router: createRouter() });
app.get('/', (ctx) => ctx.json({ hello: 'world' }));
console.log(typeof createHandler(app));
