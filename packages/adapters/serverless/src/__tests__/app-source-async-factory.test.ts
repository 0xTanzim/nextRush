import { describe, expect, it, vi } from 'vitest';
import { createApp } from '@nextrush/core';
import { createLambdaHandler } from '../lambda';
import { createVercelHandler } from '../vercel';
import { createGoogleEventHandler } from '../google';
import { createAzureEventHandler } from '../azure';
import type { ApiGatewayV2Event } from '../mappers/_v2';
import type { ApiGatewayV1Event } from '../mappers/apigw-v1';

describe('Serverless AppSource Async Factory & Zero Top-Level Await (Issue #75)', () => {
  it('creates an AWS Lambda handler from an async factory without top-level await', async () => {
    let factoryCalled = 0;
    const factory = async () => {
      factoryCalled++;
      // Simulate async setup (e.g. dynamic controller import, KMS secrets, DB pool init)
      await new Promise((r) => setTimeout(r, 10));
      const app = createApp();
      app.use(async (ctx) => {
        ctx.json({ booted: true, count: factoryCalled });
      });
      return app;
    };

    const handler = createLambdaHandler(factory);
    expect(factoryCalled).toBe(0); // Synchronous module evaluation: factory NOT called yet!

    const event: ApiGatewayV2Event = {
      version: '2.0',
      rawPath: '/items',
      requestContext: { http: { method: 'GET', path: '/items' } },
    };

    // First invocation: boots lazily
    const result1 = await handler(event);
    expect(factoryCalled).toBe(1);
    expect(result1.statusCode).toBe(200);
    expect(JSON.parse(result1.body)).toEqual({ booted: true, count: 1 });

    // Second invocation: warm container reuse, factory NOT called again
    const result2 = await handler(event);
    expect(factoryCalled).toBe(1);
    expect(result2.statusCode).toBe(200);
    expect(JSON.parse(result2.body)).toEqual({ booted: true, count: 1 });
  });

  it('creates a Vercel handler from an async factory for both Web and Node invocations', async () => {
    let booted = false;
    const factory = async () => {
      booted = true;
      const app = createApp();
      app.use(async (ctx) => {
        ctx.json({ ok: true });
      });
      return app;
    };

    const handler = createVercelHandler(factory);
    expect(booted).toBe(false);

    const req = new Request('http://localhost/api/test');
    const res = await handler(req);
    expect(booted).toBe(true);
    expect(res.status).toBe(200);
  });

  it('creates a Google Cloud Functions handler from an async factory', async () => {
    const factory = async () => {
      const app = createApp();
      app.use(async (ctx) => ctx.json({ provider: 'gcf' }));
      return app;
    };

    const handler = createGoogleEventHandler(factory);
    const result = await handler({
      method: 'GET',
      path: '/test',
      headers: { host: 'localhost' },
    });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ provider: 'gcf' });
  });

  it('creates an Azure Functions handler from an async factory', async () => {
    const factory = async () => {
      const app = createApp();
      app.use(async (ctx) => ctx.json({ provider: 'azure' }));
      return app;
    };

    const handler = createAzureEventHandler(factory);
    const result = await handler({
      method: 'GET',
      url: 'http://localhost/test',
      headers: { host: 'localhost' },
    });

    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ provider: 'azure' });
  });

  it('maps sourceIp from API Gateway v2 requestContext when x-forwarded-for is missing', async () => {
    const app = createApp({ proxy: 1 });
    let resolvedIp = '';
    app.use(async (ctx) => {
      resolvedIp = ctx.ip;
      ctx.json({ ip: ctx.ip });
    });

    const handler = createLambdaHandler(app);
    const event: ApiGatewayV2Event = {
      version: '2.0',
      rawPath: '/ip',
      requestContext: { http: { method: 'GET', path: '/ip', sourceIp: '203.0.113.195' } },
      headers: {},
    };

    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    expect(resolvedIp).toBe('203.0.113.195');
  });

  it('maps sourceIp from API Gateway v1 requestContext when x-forwarded-for is missing', async () => {
    const app = createApp({ proxy: 1 });
    let resolvedIp = '';
    app.use(async (ctx) => {
      resolvedIp = ctx.ip;
      ctx.json({ ip: ctx.ip });
    });

    const handler = createLambdaHandler(app);
    const event: ApiGatewayV1Event = {
      httpMethod: 'GET',
      path: '/ip',
      requestContext: { identity: { sourceIp: '198.51.100.42' } },
      headers: {},
      multiValueHeaders: {},
    };

    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    expect(resolvedIp).toBe('198.51.100.42');
  });

  it('settles background tasks before returning from AWS Lambda handler', async () => {
    let backgroundFinished = false;
    const app = createApp();
    app.use(async (ctx) => {
      ctx.waitUntil(
        new Promise<void>((resolve) => {
          setTimeout(() => {
            backgroundFinished = true;
            resolve();
          }, 30);
        })
      );
      ctx.json({ ok: true });
    });

    const handler = createLambdaHandler(app);
    const event: ApiGatewayV2Event = {
      version: '2.0',
      rawPath: '/async-task',
      requestContext: { http: { method: 'GET', path: '/async-task' } },
    };

    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    // Crucial guarantee: Lambda handler settled the background task before returning
    expect(backgroundFinished).toBe(true);
  });
});
