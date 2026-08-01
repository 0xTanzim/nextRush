// Minimal deploy verification app for real AWS Lambda Function URL.
//
// Task 10.1 (openspec/changes/harden-runtime-edge-serverless): a throwaway app
// deployed and smoke-tested against the real platform, then torn down. Kept
// deliberately tiny — this is a proof of "the built handler works on the real
// service," not a feature test (the conformance suite already covers behavior).
import { createApp } from '@nextrush/core';
import { createLambdaHandler } from '@nextrush/adapter-serverless';

const app = createApp();
app.use((ctx) => ctx.json({ ok: true, runtime: 'lambda', ts: Date.now() }));

export const handler = createLambdaHandler(app);
