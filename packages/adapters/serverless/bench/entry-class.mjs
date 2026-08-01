/**
 * Cold-start sample — class/DI-runtime path.
 *
 * Identical to the functional entry, but additionally loads `@nextrush/class`,
 * which pulls in `reflect-metadata` and the decorator/DI machinery at import
 * time. That import is the dominant cold-start delta a class-based app pays over
 * the functional path.
 *
 * NOTE: this measures the *runtime-load* cost, not a decorated controller — raw
 * Node can't evaluate decorator syntax without a build step, so exercising
 * `@Controller` is out of scope for this micro-benchmark. The reflect-metadata
 * load is the figure that matters for a serverless cold start.
 */
import { performance } from 'node:perf_hooks';
import '@nextrush/class';
import { createApp } from '@nextrush/core';
import { createLambdaHandler } from '@nextrush/adapter-serverless';

const app = createApp();
app.use((ctx) => ctx.json({ ok: true }));
const handler = createLambdaHandler(app);
await handler({ version: '2.0', rawPath: '/', requestContext: { http: { method: 'GET' } } });

process.stdout.write(performance.now().toFixed(3));
