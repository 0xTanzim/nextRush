// Minimal deploy verification worker for real Cloudflare Workers.
// Task 10.1 — see lambda-app/handler.mjs for the sibling AWS Lambda app.
import { createApp } from '@nextrush/core';
import { createCloudflareHandler } from '@nextrush/adapter-edge';

const app = createApp();
app.use((ctx) => ctx.json({ ok: true, runtime: 'cloudflare', ts: Date.now() }));

export default createCloudflareHandler(app);
