/**
 * Cold-start sample — functional path.
 *
 * Prints ms from process start (perf_hooks timeOrigin) to the first Lambda
 * invocation's result, i.e. module load + app build + ready() + first request.
 * Run fresh per sample by bench/cold-start.mjs (one process = one cold start).
 */
import { performance } from 'node:perf_hooks';
import { createApp } from '@nextrush/core';
import { createLambdaHandler } from '@nextrush/adapter-serverless';

const app = createApp();
app.use((ctx) => ctx.json({ ok: true }));
const handler = createLambdaHandler(app);
await handler({ version: '2.0', rawPath: '/', requestContext: { http: { method: 'GET' } } });

process.stdout.write(performance.now().toFixed(3));
