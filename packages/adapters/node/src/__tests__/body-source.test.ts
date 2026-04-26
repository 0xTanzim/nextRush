/**
 * @nextrush/adapter-node - BodySource Tests
 */

import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createEmptyBodySource, NodeBodySource } from '../body-source';

function createMockReq(
  body: string | Buffer = '',
  headers: Record<string, string> = {}
): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.headers = headers;

  // Push body data and end
  const readable = new Readable({
    read() {
      if (body.length > 0) {
        this.push(Buffer.from(body));
      }
      this.push(null);
    },
  });

  // Pipe readable into req's internal stream
  Object.assign(req, {
    [Symbol.asyncIterator]: readable[Symbol.asyncIterator].bind(readable),
  });

  return req;
}

describe('NodeBodySource', () => {
  describe('Content-Length 0 parsing', () => {
    it('should parse Content-Length 0 as 0, not undefined', () => {
      const req = createMockReq('', { 'content-length': '0' });
      const source = new NodeBodySource(req);
      expect(source.contentLength).toBe(0);
    });

    it('should parse Content-Length with valid values', () => {
      const req = createMockReq('test', { 'content-length': '4' });
      const source = new NodeBodySource(req);
      expect(source.contentLength).toBe(4);
    });

    it('should return undefined for missing Content-Length', () => {
      const req = createMockReq('test');
      const source = new NodeBodySource(req);
      expect(source.contentLength).toBeUndefined();
    });

    it('should return undefined for non-numeric Content-Length', () => {
      const req = createMockReq('test', { 'content-length': 'invalid' });
      const source = new NodeBodySource(req);
      expect(source.contentLength).toBeUndefined();
    });
  });

  describe('Streaming body size enforcement', () => {
    it('should abort when body exceeds limit during streaming', async () => {
      const largeBody = 'x'.repeat(200);
      const req = createMockReq(largeBody, { 'content-type': 'text/plain' });
      const source = new NodeBodySource(req, { limit: 50 });

      await expect(source.buffer()).rejects.toThrow('Body too large');
    });

    it('should read body within limit', async () => {
      const body = 'hello world';
      const req = createMockReq(body, { 'content-type': 'text/plain' });
      const source = new NodeBodySource(req, { limit: 1024 });

      const buffer = await source.buffer();
      expect(new TextDecoder().decode(buffer)).toBe(body);
    });
  });
});

describe('createEmptyBodySource', () => {
  it('should return singleton', () => {
    const a = createEmptyBodySource();
    const b = createEmptyBodySource();
    expect(a).toBe(b);
  });

  it('should return empty string for text', async () => {
    const source = createEmptyBodySource();
    expect(await source.text()).toBe('');
  });

  it('should return empty buffer', async () => {
    const source = createEmptyBodySource();
    const buffer = await source.buffer();
    expect(buffer.length).toBe(0);
  });
});
