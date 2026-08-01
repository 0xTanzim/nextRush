/**
 * Tier-1 per-provider handler tests (spec: serverless-adapter → Tiered public API).
 *
 * These assert the *minimal DX* surface: a normal user deploys with a single
 * `createXHandler(app)` call, no `mappers`, no `provider`, no `EventMapper`.
 */

import { describe, expect, it } from 'vitest';
import { createApp } from '@nextrush/core';
import {
  createAzureEventHandler,
  createAzureHandler,
  createGoogleEventHandler,
  createGoogleHandler,
  createLambdaHandler,
} from '../index';

/** Canonical app: echoes the mapped method/path/query so the chain is observable. */
function echoApp(): ReturnType<typeof createApp> {
  const app = createApp();
  app.use((ctx) => {
    ctx.json({ method: ctx.method, path: ctx.path, query: ctx.query });
  });
  return app;
}

describe('createLambdaHandler (Tier 1, zero-config)', () => {
  it('serves a Lambda Function URL / API Gateway v2 event with no options', async () => {
    const handler = createLambdaHandler(echoApp());
    const result = await handler({
      version: '2.0',
      rawPath: '/users',
      rawQueryString: 'a=1',
      requestContext: { http: { method: 'GET' } },
    });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ method: 'GET', path: '/users', query: { a: '1' } });
  });

  it('auto-detects and serves an API Gateway v1 (REST) event with no options', async () => {
    const handler = createLambdaHandler(echoApp());
    const result = await handler({
      httpMethod: 'GET',
      path: '/users',
      multiValueQueryStringParameters: { a: ['1'] },
      multiValueHeaders: {},
    });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ method: 'GET', path: '/users', query: { a: '1' } });
  });

  it('honors the Tier-2 timeout option → 504', async () => {
    const app = createApp();
    app.use(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const handler = createLambdaHandler(app, { timeout: 5 });
    const result = await handler({
      version: '2.0',
      rawPath: '/slow',
      requestContext: { http: { method: 'GET' } },
    });
    expect(result.statusCode).toBe(504);
  });
});

describe('createGoogleHandler (Tier 1, zero-config, RFC-027 drop-in)', () => {
  it('serves a real functions-framework-shaped (req, res) pair with no options', async () => {
    const handler = createGoogleHandler(echoApp());
    const req = { method: 'GET', path: '/users', query: { a: '1' }, headers: {} };
    const calls: string[] = [];
    const res = {
      status(code: number) {
        calls.push(`status:${code}`);
        return this;
      },
      setHeader(name: string, value: string | readonly string[]) {
        calls.push(`setHeader:${name}`);
        return this;
      },
      send(body: string | Uint8Array) {
        calls.push(`send:${body}`);
        return this;
      },
    };
    await handler(req, res);
    expect(calls[0]).toBe('status:200');
    expect(JSON.parse(String(calls.find((c) => c.startsWith('send:'))?.slice(5)))).toEqual({
      method: 'GET',
      path: '/users',
      query: { a: '1' },
    });
  });
});

describe('createGoogleEventHandler (Tier 3, struct-based — pre-RFC-027 behavior, unchanged)', () => {
  it('serves a GCF HTTP event with no options', async () => {
    const handler = createGoogleEventHandler(echoApp());
    const result = await handler({ method: 'GET', path: '/users', query: { a: '1' } });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ method: 'GET', path: '/users', query: { a: '1' } });
  });
});

describe('createAzureHandler (Tier 1, zero-config, RFC-027 drop-in)', () => {
  it('serves a real Azure v4-shaped HttpRequest with no options', async () => {
    const handler = createAzureHandler(echoApp());
    const req = {
      method: 'GET',
      url: 'http://localhost/users?a=1',
      headers: [] as [string, string][],
      async arrayBuffer() {
        return new ArrayBuffer(0);
      },
    };
    const result = await handler(req);
    expect(result.status).toBe(200);
    expect(JSON.parse(String(result.body))).toEqual({ method: 'GET', path: '/users', query: { a: '1' } });
  });
});

describe('createAzureEventHandler (Tier 3, struct-based — pre-RFC-027 behavior, unchanged)', () => {
  it('serves an Azure v4 HTTP event with no options', async () => {
    const handler = createAzureEventHandler(echoApp());
    const result = await handler({ method: 'GET', url: 'http://localhost/users?a=1' });
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ method: 'GET', path: '/users', query: { a: '1' } });
  });
});
