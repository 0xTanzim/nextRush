// Minimal deploy verification app for real Vercel Edge Functions.
// Task 5.1 (openspec/changes/close-runtime-compatibility-gaps) — see
// ../cloudflare-app/worker.mjs for the sibling Cloudflare app; this is the
// same shape targeting a different FetchAdapter platform handler.
import { createApp } from '@nextrush/core';
import { createVercelHandler } from '@nextrush/adapter-edge';

const app = createApp();
app.use((ctx) => ctx.json({ ok: true, runtime: 'vercel', ts: Date.now() }));

export const GET = createVercelHandler(app);
export const config = { runtime: 'edge' };
