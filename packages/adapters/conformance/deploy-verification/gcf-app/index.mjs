// Minimal deploy verification app for real Google Cloud Functions.
// Task 5.2 (openspec/changes/close-runtime-compatibility-gaps) — see
// ../lambda-app/handler.mjs for the sibling AWS Lambda app.
//
// RFC-027: createGoogleHandler is a true drop-in for functions-framework's
// (req, res) contract — no manual field bridge. This app previously
// reimplemented the README's now-removed hand-written bridge; it now proves
// the one-line drop-in itself deploys and responds on the real platform.
import { createApp } from '@nextrush/core';
import { createGoogleHandler } from '@nextrush/adapter-serverless';
import * as functions from '@google-cloud/functions-framework';

const app = createApp();
app.use((ctx) => ctx.json({ ok: true, runtime: 'gcf', ts: Date.now() }));

functions.http('api', createGoogleHandler(app));
