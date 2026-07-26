/**
 * @nextrush/adapter-serverless - Azure bridge tests (RFC-027 P1).
 */

import { describe, expect, it } from 'vitest';
import type { AzureHttpRequestLike } from '../platform-shapes';
import { toAzureEvent, toAzureResponse } from '../azure';

function mockAzureReq(overrides: Partial<AzureHttpRequestLike> = {}): AzureHttpRequestLike {
  return {
    method: 'GET',
    url: 'https://x.azurewebsites.net/api/x',
    headers: [['content-type', 'text/plain']],
    async arrayBuffer() {
      return new ArrayBuffer(0);
    },
    ...overrides,
  };
}

describe('toAzureEvent', () => {
  it('maps method, url, headers, and a text body', async () => {
    const bytes = new TextEncoder().encode('hello');
    const req = mockAzureReq({
      method: 'post',
      async arrayBuffer() {
        return bytes.buffer;
      },
    });
    const event = await toAzureEvent(req);
    expect(event).toEqual({
      method: 'post',
      url: 'https://x.azurewebsites.net/api/x',
      headers: { 'content-type': 'text/plain' },
      body: 'hello',
      isBase64Encoded: false,
    });
  });

  it('base64-encodes a binary body and sets isBase64Encoded', async () => {
    const bytes = new Uint8Array([0, 1, 2, 255]);
    const req = mockAzureReq({
      method: 'POST',
      headers: [['content-type', 'application/octet-stream']],
      async arrayBuffer() {
        return bytes.buffer;
      },
    });
    const event = await toAzureEvent(req);
    expect(event.isBase64Encoded).toBe(true);
    expect(typeof event.body).toBe('string');
  });

  it('omits body for GET/HEAD even when arrayBuffer would return bytes', async () => {
    const req = mockAzureReq({
      method: 'GET',
      async arrayBuffer() {
        return new TextEncoder().encode('should not appear').buffer;
      },
    });
    const event = await toAzureEvent(req);
    expect(event.body).toBeUndefined();
  });
});

describe('toAzureResponse', () => {
  it('maps status, headers, and a text body', () => {
    const res = toAzureResponse({
      status: 201,
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}',
      isBase64Encoded: false,
    });
    expect(res).toEqual({
      status: 201,
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}',
    });
  });

  it('decodes a base64 body to bytes (binary response fidelity)', () => {
    const original = new Uint8Array([10, 20, 30]);
    const b64 = Buffer.from(original).toString('base64');
    const res = toAzureResponse({
      status: 200,
      headers: {},
      body: b64,
      isBase64Encoded: true,
    });
    expect(res.body).toBeInstanceOf(Uint8Array);
    expect(Array.from(res.body as Uint8Array)).toEqual([10, 20, 30]);
  });

  it('maps raw Set-Cookie lines to structured cookie entries', () => {
    const res = toAzureResponse({
      status: 200,
      headers: {},
      cookies: ['a=1; Path=/', 'b=2; Path=/'],
      body: '',
      isBase64Encoded: false,
    });
    expect(res.cookies).toEqual([
      { name: 'a', value: '1' },
      { name: 'b', value: '2' },
    ]);
  });
});
