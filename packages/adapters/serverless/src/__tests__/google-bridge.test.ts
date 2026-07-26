/**
 * @nextrush/adapter-serverless - GCF bridge tests (RFC-027 P1).
 *
 * Pure transforms: real-request-shaped input → GcfEvent, GcfResult → response sink.
 */

import { describe, expect, it, vi } from 'vitest';
import type { GcfHttpRequest, GcfHttpResponse } from '../platform-shapes';
import { toGcfEvent, writeGcfResult } from '../google';

function mockRes(): GcfHttpResponse & { calls: string[] } {
  const calls: string[] = [];
  const res: GcfHttpResponse & { calls: string[] } = {
    calls,
    status(code: number) {
      calls.push(`status:${code}`);
      return this;
    },
    setHeader(name: string, value: string | readonly string[]) {
      calls.push(`setHeader:${name}=${Array.isArray(value) ? value.join('|') : value}`);
      return this;
    },
    send(body: string | Uint8Array) {
      calls.push(typeof body === 'string' ? `send:text:${body}` : `send:bytes:${body.length}`);
      return this;
    },
  };
  return res;
}

describe('toGcfEvent', () => {
  it('maps method, path, query, headers, and a text rawBody', () => {
    const req: GcfHttpRequest = {
      method: 'post',
      path: '/users',
      query: { a: '1' },
      headers: { 'content-type': 'text/plain' },
      rawBody: new TextEncoder().encode('hello'),
    };
    const event = toGcfEvent(req);
    expect(event).toEqual({
      method: 'post',
      path: '/users',
      query: { a: '1' },
      headers: { 'content-type': 'text/plain' },
      body: 'hello',
      isBase64Encoded: false,
    });
  });

  it('falls back to originalUrl/url when path is absent', () => {
    const req: GcfHttpRequest = {
      method: 'GET',
      originalUrl: '/from-original',
      headers: {},
    };
    expect(toGcfEvent(req).path).toBe('/from-original');
  });

  it('base64-encodes a binary rawBody and sets isBase64Encoded', () => {
    const bytes = new Uint8Array([0, 1, 2, 255]);
    const req: GcfHttpRequest = {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      rawBody: bytes,
    };
    const event = toGcfEvent(req);
    expect(event.isBase64Encoded).toBe(true);
    expect(typeof event.body).toBe('string');
  });

  it('omits body for GET/HEAD even when rawBody is present', () => {
    const req: GcfHttpRequest = {
      method: 'GET',
      headers: {},
      rawBody: new TextEncoder().encode('should not appear'),
    };
    expect(toGcfEvent(req).body).toBeUndefined();
  });

  it('falls back to a string body when rawBody is absent', () => {
    const req: GcfHttpRequest = {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'plain string body',
    };
    expect(toGcfEvent(req).body).toBe('plain string body');
  });

  it('warns and omits body when rawBody is absent and body is a parsed object (not a lossy toString)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const req: GcfHttpRequest = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { a: 1 },
    };
    const event = toGcfEvent(req);
    expect(event.body).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[nextrush/serverless]'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('rawBody'));
    warn.mockRestore();
  });
});

describe('writeGcfResult', () => {
  it('writes status, headers, and a text body', () => {
    const res = mockRes();
    writeGcfResult(res, {
      statusCode: 201,
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}',
      isBase64Encoded: false,
    });
    expect(res.calls).toEqual([
      'status:201',
      'setHeader:content-type=application/json',
      'send:text:{"ok":true}',
    ]);
  });

  it('decodes a base64 body to bytes before sending (binary response fidelity)', () => {
    const res = mockRes();
    const original = new Uint8Array([10, 20, 30]);
    const b64 = Buffer.from(original).toString('base64');
    writeGcfResult(res, {
      statusCode: 200,
      headers: { 'content-type': 'application/octet-stream' },
      body: b64,
      isBase64Encoded: true,
    });
    expect(res.calls).toContain(`send:bytes:${original.length}`);
  });

  it('writes multiple Set-Cookie values as one array-valued header call', () => {
    const res = mockRes();
    writeGcfResult(res, {
      statusCode: 200,
      headers: {},
      cookies: ['a=1; Path=/', 'b=2; Path=/'],
      body: '',
      isBase64Encoded: false,
    });
    expect(res.calls).toContain('setHeader:Set-Cookie=a=1; Path=/|b=2; Path=/');
  });
});
