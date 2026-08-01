/**
 * @nextrush/adapter-serverless - ctx.platform Tests (RFC-026 P2)
 *
 * Each Tier-1 handler already knows its own platform identity unambiguously
 * and must pass it through to `ctx.platform` with zero detection needed.
 */

import { createApp } from '@nextrush/core';
import { describe, expect, it } from 'vitest';
import { createAzureEventHandler, createGoogleEventHandler, createLambdaHandler } from '../index';

/** App that echoes ctx.platform so the value threaded through is observable. */
function platformEchoApp(): ReturnType<typeof createApp> {
  const app = createApp();
  app.use((ctx) => {
    ctx.json({ platform: ctx.platform });
  });
  return app;
}

describe('ctx.platform (RFC-026)', () => {
  it('is "lambda" for createLambdaHandler', async () => {
    const handler = createLambdaHandler(platformEchoApp());
    const result = await handler({
      version: '2.0',
      rawPath: '/',
      requestContext: { http: { method: 'GET' } },
    });
    expect(JSON.parse(result.body)).toEqual({ platform: 'lambda' });
  });

  it('is "gcf" for createGoogleEventHandler (and therefore also the createGoogleHandler drop-in, which delegates to it)', async () => {
    const handler = createGoogleEventHandler(platformEchoApp());
    const result = await handler({ method: 'GET', path: '/', headers: {} });
    expect(JSON.parse(result.body)).toEqual({ platform: 'gcf' });
  });

  it('is "azure" for createAzureEventHandler (and therefore also the createAzureHandler drop-in, which delegates to it)', async () => {
    const handler = createAzureEventHandler(platformEchoApp());
    const result = await handler({ method: 'GET', url: 'https://x.azurewebsites.net/api/x' });
    expect(JSON.parse(result.body ?? '{}')).toEqual({ platform: 'azure' });
  });
});
