// Minimal deploy verification app for real Azure Functions (v4 programming
// model). Sibling to ../gcf-app/index.mjs and ../lambda-app/handler.mjs —
// same task group (openspec/changes/close-runtime-compatibility-gaps),
// extended for RFC-027/P2-6 (Azure Experimental -> real-platform-verified).
//
// createAzureHandler is a true drop-in for Azure Functions v4's
// HttpHandler contract — no manual field bridge.
import { createApp } from '@nextrush/core';
import { createAzureHandler } from '@nextrush/adapter-serverless';
import { app as functions } from '@azure/functions';

const app = createApp();
app.use((ctx) => ctx.json({ ok: true, runtime: 'azure', ts: Date.now() }));

functions.http('api', {
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  authLevel: 'anonymous',
  handler: createAzureHandler(app),
});
