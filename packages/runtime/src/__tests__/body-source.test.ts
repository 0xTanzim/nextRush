/** @nextrush/runtime - BodySource Tests */

import { describe, expect, it } from 'vitest';
import {
  BodyConsumedError,
  BodyTooLargeError,
  createEmptyBodySource,
  createWebBodySource,
  DEFAULT_BODY_LIMIT,
  EmptyBodySource,
  WebBodySource,
} from '../body-source.js';

describe('BodySource', () => {
  describe('EmptyBodySource', () => {
    it('should return empty string for text()', async () => {
      const source = new EmptyBodySource();
      const text = await source.text();
      expect(text).toBe('');
    });

    it('should return empty Uint8Array for buffer()', async () => {
      const source = new EmptyBodySource();
      const buffer = await source.buffer();
      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(buffer.length).toBe(0);
    });

    it('should throw BadRequestError for json()', async () => {
      const source = new EmptyBodySource();
      await expect(source.json()).rejects.toThrow('Request body is empty');
    });

    it('should return empty ReadableStream for stream()', () => {
      const source = new EmptyBodySource();
      const stream = source.stream();
      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it('should have correct properties', () => {
      const source = new EmptyBodySource();
      expect(source.consumed).toBe(false);
      expect(source.contentLength).toBe(0);
      expect(source.contentType).toBeUndefined();
    });
  });

  describe('createEmptyBodySource', () => {
    it('should create EmptyBodySource instance', () => {
      const source = createEmptyBodySource();
      expect(source).toBeInstanceOf(EmptyBodySource);
    });
  });

  describe('WebBodySource', () => {
    it('should read text from Request', async () => {
      const body = 'Hello, World!';
      const request = new Request('http://example.com', {
        method: 'POST',
        body,
        headers: { 'content-type': 'text/plain' },
      });

      const source = new WebBodySource(request);
      const text = await source.text();
      expect(text).toBe(body);
    });

    it('should read JSON from Request', async () => {
      const data = { hello: 'world', num: 42 };
      const request = new Request('http://example.com', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'content-type': 'application/json' },
      });

      const source = new WebBodySource(request);
      const json = await source.json();
      expect(json).toEqual(data);
    });

    it('should read buffer from Request', async () => {
      const body = 'Binary data';
      const request = new Request('http://example.com', {
        method: 'POST',
        body,
      });

      const source = new WebBodySource(request);
      const buffer = await source.buffer();
      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(buffer.length).toBe(body.length);
    });

    it('should return stream from Request', () => {
      const request = new Request('http://example.com', {
        method: 'POST',
        body: 'stream data',
      });

      const source = new WebBodySource(request);
      const stream = source.stream();
      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it('should extract content-type from headers', () => {
      const request = new Request('http://example.com', {
        method: 'POST',
        body: '{}',
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });

      const source = new WebBodySource(request);
      expect(source.contentType).toBe('application/json; charset=utf-8');
    });

    it('should extract content-length from headers', () => {
      const body = 'test body';
      const request = new Request('http://example.com', {
        method: 'POST',
        body,
      });

      const source = new WebBodySource(request);
      // Note: Content-Length may or may not be set depending on Request implementation
      // Just verify it's a number or undefined
      expect(source.contentLength === undefined || typeof source.contentLength === 'number').toBe(
        true
      );
    });

    it('should track consumed state', async () => {
      const request = new Request('http://example.com', {
        method: 'POST',
        body: 'test',
      });

      const source = new WebBodySource(request);
      expect(source.consumed).toBe(false);

      await source.text();
      expect(source.consumed).toBe(true);
    });

    it('should cache buffer for subsequent reads', async () => {
      const body = 'cached body';
      const request = new Request('http://example.com', {
        method: 'POST',
        body,
      });

      const source = new WebBodySource(request);

      // First read
      const buffer1 = await source.buffer();

      // Second read should return cached value
      const buffer2 = await source.buffer();

      expect(buffer1).toEqual(buffer2);
    });

    it('should throw BodyConsumedError when reading consumed body without cache', async () => {
      const request = new Request('http://example.com', {
        method: 'POST',
        body: 'test',
      });

      const source = new WebBodySource(request);

      // Consume via stream (no cache)
      source.stream();

      // Should throw on subsequent read
      await expect(source.buffer()).rejects.toThrow(BodyConsumedError);
    });
  });

  describe('createWebBodySource', () => {
    it('should create WebBodySource instance', () => {
      const request = new Request('http://example.com', {
        method: 'POST',
        body: 'test',
      });

      const source = createWebBodySource(request);
      expect(source).toBeInstanceOf(WebBodySource);
    });

    it('should accept options', () => {
      const request = new Request('http://example.com', {
        method: 'POST',
        body: 'test',
      });

      const source = createWebBodySource(request, { limit: 1024, encoding: 'utf-8' });
      expect(source).toBeInstanceOf(WebBodySource);
    });
  });

  describe('BodyConsumedError', () => {
    it('should have correct name', () => {
      const error = new BodyConsumedError();
      expect(error.name).toBe('BodyConsumedError');
    });

    it('should have correct message', () => {
      const error = new BodyConsumedError();
      expect(error.message).toBe('Body has already been consumed');
    });
  });

  describe('BodyTooLargeError', () => {
    it('should have correct name', () => {
      const error = new BodyTooLargeError(1024, 2048);
      expect(error.name).toBe('BodyTooLargeError');
    });

    it('should include limit and received in message', () => {
      const error = new BodyTooLargeError(1024, 2048);
      expect(error.message).toContain('1024');
      expect(error.message).toContain('2048');
    });

    it('should expose limit and received properties', () => {
      const error = new BodyTooLargeError(1024, 2048);
      expect(error.limit).toBe(1024);
      expect(error.received).toBe(2048);
    });
  });

  describe('DEFAULT_BODY_LIMIT', () => {
    it('should be 1MB', () => {
      expect(DEFAULT_BODY_LIMIT).toBe(1024 * 1024);
    });
  });

  describe('Size limits', () => {
    it('should reject body exceeding content-length limit', async () => {
      const largeBody = 'x'.repeat(100);
      const request = new Request('http://example.com', {
        method: 'POST',
        body: largeBody,
        headers: { 'content-length': '100' },
      });

      // Set limit to 50 bytes
      const source = new WebBodySource(request, { limit: 50 });

      await expect(source.buffer()).rejects.toThrow(BodyTooLargeError);
    });

    it('should accept body within limit', async () => {
      const body = 'x'.repeat(50);
      const request = new Request('http://example.com', {
        method: 'POST',
        body,
      });

      const source = new WebBodySource(request, { limit: 100 });
      const buffer = await source.buffer();

      expect(buffer.length).toBe(50);
    });
  });

  describe('Empty Request body', () => {
    it('should handle Request with no body', async () => {
      const request = new Request('http://example.com', {
        method: 'GET',
      });

      const source = new WebBodySource(request);
      const text = await source.text();

      expect(text).toBe('');
    });

    it('should return empty stream for Request with no body', () => {
      const request = new Request('http://example.com', {
        method: 'GET',
      });

      const source = new WebBodySource(request);
      const stream = source.stream();

      expect(stream).toBeInstanceOf(ReadableStream);
    });
  });

  describe('Content-Length 0 parsing', () => {
    it('should parse Content-Length 0 as 0, not undefined', () => {
      const request = new Request('http://example.com', {
        method: 'POST',
        body: '',
        headers: { 'content-length': '0' },
      });

      const source = new WebBodySource(request);
      expect(source.contentLength).toBe(0);
    });

    it('should parse Content-Length with valid values', () => {
      const request = new Request('http://example.com', {
        method: 'POST',
        body: 'test',
        headers: { 'content-length': '4' },
      });

      const source = new WebBodySource(request);
      expect(source.contentLength).toBe(4);
    });

    it('should return undefined for non-numeric Content-Length', () => {
      const request = new Request('http://example.com', {
        method: 'POST',
        body: 'test',
        headers: { 'content-length': 'invalid' },
      });

      const source = new WebBodySource(request);
      expect(source.contentLength).toBeUndefined();
    });
  });

  describe('Streaming body size enforcement', () => {
    it('should abort stream when body exceeds limit during read', async () => {
      // Create a body larger than the limit
      const largeBody = 'x'.repeat(200);
      const request = new Request('http://example.com', {
        method: 'POST',
        body: largeBody,
      });

      const source = new WebBodySource(request, { limit: 50 });

      await expect(source.buffer()).rejects.toThrow(BodyTooLargeError);
    });

    it('should read body that fits within limit', async () => {
      const body = 'x'.repeat(50);
      const request = new Request('http://example.com', {
        method: 'POST',
        body,
      });

      const source = new WebBodySource(request, { limit: 100 });
      const buffer = await source.buffer();

      expect(buffer.length).toBe(50);
    });

    it('should reject body without Content-Length that exceeds limit during streaming', async () => {
      // Simulate a streamed body without Content-Length pre-check
      const chunks = ['aaaa', 'bbbb', 'cccc', 'dddd', 'eeee'];
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
          controller.close();
        },
      });

      const request = new Request('http://example.com', {
        method: 'POST',
        body: stream,
        // @ts-expect-error - duplex required for streaming body
        duplex: 'half',
      });

      const source = new WebBodySource(request, { limit: 10 });

      await expect(source.buffer()).rejects.toThrow(BodyTooLargeError);
    });

    it('should return single chunk directly without concatenation', async () => {
      const body = 'small';
      const request = new Request('http://example.com', {
        method: 'POST',
        body,
      });

      const source = new WebBodySource(request, { limit: 1024 });
      const buffer = await source.buffer();

      expect(new TextDecoder().decode(buffer)).toBe('small');
    });
  });
});

// ===========================================================================
// RFC-043 — native read for provable-length bodies
// ===========================================================================

interface FakeRequestOptions {
  headers?: Record<string, string>;
  body?: unknown;
  arrayBuffer?: () => Promise<ArrayBuffer>;
}

/** Minimal Request stand-in: only the surfaces `WebBodySource` touches. */
function fakeRequest(options: FakeRequestOptions = {}): Request {
  return {
    headers: new Headers(options.headers ?? {}),
    body: options.body ?? null,
    arrayBuffer:
      options.arrayBuffer ??
      (() => {
        throw new Error('arrayBuffer must not be called');
      }),
  } as unknown as Request;
}

/** A reader whose `read()` yields the given chunks once, then completes. */
function chunkedBody(chunks: string[]): unknown {
  let index = 0;
  return {
    getReader() {
      return {
        read: () => {
          if (index >= chunks.length) return Promise.resolve({ done: true, value: undefined });
          const value = new TextEncoder().encode(chunks[index++]);
          return Promise.resolve({ done: false, value });
        },
        cancel: () => Promise.resolve(),
        releaseLock: () => undefined,
      };
    },
  };
}

function bytesOf(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('RFC-043: native read for provable-length bodies', () => {
  it('reads natively when Content-Length is present and within the limit', async () => {
    const request = fakeRequest({
      headers: { 'content-length': '7' },
      body: {
        getReader() {
          throw new Error('reader path must not be used when the length is provable');
        },
      },
      arrayBuffer: () => Promise.resolve(bytesOf('payload')),
    });

    const source = new WebBodySource(request);
    await expect(source.text()).resolves.toBe('payload');
  });

  it('uses the incremental reader when Content-Length is absent', async () => {
    const request = fakeRequest({
      body: chunkedBody(['abc', 'def']),
      arrayBuffer: () => {
        throw new Error('arrayBuffer must not be used when the length is unknown');
      },
    });

    const source = new WebBodySource(request);
    await expect(source.text()).resolves.toBe('abcdef');
  });

  it('rejects an honest over-limit Content-Length before any read', async () => {
    let readCalls = 0;
    const request = fakeRequest({
      headers: { 'content-length': '100' },
      body: {},
      arrayBuffer: () => {
        readCalls++;
        return Promise.resolve(bytesOf('x'.repeat(100)));
      },
    });

    const source = new WebBodySource(request, { limit: 50 });
    await expect(source.buffer()).rejects.toThrow(BodyTooLargeError);
    expect(readCalls).toBe(0);
  });

  it('checks the actual size after a native read when Content-Length understates it', async () => {
    let readCalls = 0;
    const request = fakeRequest({
      headers: { 'content-length': '2' },
      body: {},
      arrayBuffer: () => {
        readCalls++;
        return Promise.resolve(bytesOf('0123456789'));
      },
    });

    const source = new WebBodySource(request, { limit: 5 });
    await expect(source.buffer()).rejects.toThrow(BodyTooLargeError);
    expect(readCalls).toBe(1);
  });

  it('caches a native read so a second buffer() does not read again', async () => {
    let readCalls = 0;
    const request = fakeRequest({
      headers: { 'content-length': '4' },
      body: {},
      arrayBuffer: () => {
        readCalls++;
        return Promise.resolve(bytesOf('data'));
      },
    });

    const source = new WebBodySource(request);
    const first = await source.buffer();
    const second = await source.buffer();

    expect(new TextDecoder().decode(first)).toBe('data');
    expect(second).toBe(first);
    expect(readCalls).toBe(1);
  });

  it('reports BodyConsumedError when stream() follows a cached native read', async () => {
    const request = fakeRequest({
      headers: { 'content-length': '4' },
      body: {},
      arrayBuffer: () => Promise.resolve(bytesOf('data')),
    });

    const source = new WebBodySource(request);
    await source.buffer();
    expect(() => source.stream()).toThrow(BodyConsumedError);
  });
});
