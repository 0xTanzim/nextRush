// Minimal deploy verification app for real Google Cloud Functions.
// Task 5.2 (openspec/changes/close-runtime-compatibility-gaps) — see
// ../lambda-app/handler.mjs for the sibling AWS Lambda app.
//
// GCF's Node.js functions-framework hands the entry point an Express-style
// (req, res) pair, not the normalized GcfEvent createGoogleHandler expects —
// bridging one to the other is the one adapting line the package's own
// README documents (packages/adapters/serverless/README.md, "The three
// handlers" section); this file follows that documented pattern verbatim,
// not an invented one.
import { createApp } from '@nextrush/core';
import { createGoogleHandler } from '@nextrush/adapter-serverless';
import * as functions from '@google-cloud/functions-framework';

const app = createApp();
app.use((ctx) => ctx.json({ ok: true, runtime: 'gcf', ts: Date.now() }));

const api = createGoogleHandler(app);

functions.http('api', async (req, res) => {
  const r = await api({
    method: req.method,
    path: req.path,
    query: req.query,
    headers: req.headers,
    body: req.rawBody?.toString(),
  });
  res.status(r.statusCode).set(r.headers).send(r.body);
});
