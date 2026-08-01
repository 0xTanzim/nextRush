/**
 * @nextrush/adapter-serverless - Platform shapes assignability (RFC-027 P0).
 *
 * Compile-time only: asserts hand-written, SDK-shaped objects are structurally
 * assignable to the platform interfaces without importing the real SDKs.
 */

import { describe, expect, it } from 'vitest';
import type {
  AzureHttpRequestLike,
  AzureHttpResponseLike,
  GcfHttpRequest,
  GcfHttpResponse,
} from '../platform-shapes';

describe('platform-shapes assignability', () => {
  it('a functions-framework-shaped request satisfies GcfHttpRequest', () => {
    const req: GcfHttpRequest = {
      method: 'GET',
      path: '/users',
      originalUrl: '/users?a=1',
      query: { a: '1' },
      headers: { 'content-type': 'application/json' },
      rawBody: new Uint8Array([1, 2, 3]),
      body: { a: 1 },
    };
    expect(req.method).toBe('GET');
  });

  it('an Express-response-shaped object satisfies GcfHttpResponse', () => {
    const calls: string[] = [];
    const res: GcfHttpResponse = {
      status(code: number) {
        calls.push(`status:${code}`);
        return this;
      },
      setHeader(name: string, value: string | readonly string[]) {
        calls.push(`setHeader:${name}=${String(value)}`);
        return this;
      },
      send(body: string | Uint8Array) {
        calls.push(`send:${typeof body}`);
        return this;
      },
    };
    res.status(200).setHeader('x', 'y');
    res.send('ok');
    expect(calls).toEqual(['status:200', 'setHeader:x=y', 'send:string']);
  });

  it('an Azure v4-shaped request satisfies AzureHttpRequestLike', async () => {
    const req: AzureHttpRequestLike = {
      method: 'GET',
      url: 'https://x.azurewebsites.net/api/x',
      headers: [['content-type', 'application/json']],
      async arrayBuffer() {
        return new ArrayBuffer(0);
      },
    };
    await expect(req.arrayBuffer()).resolves.toBeInstanceOf(ArrayBuffer);
  });

  it('an HttpResponseInit-shaped object satisfies AzureHttpResponseLike', () => {
    const res: AzureHttpResponseLike = {
      status: 200,
      headers: { 'content-type': 'text/plain' },
      cookies: [{ name: 'a', value: '1' }],
      body: 'ok',
    };
    expect(res.status).toBe(200);
  });
});
