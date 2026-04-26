/**
 * @nextrush/adapter-deno - Body Source Tests
 */

import { BodyConsumedError, BodyTooLargeError } from '@nextrush/runtime';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDenoBodySource,
  createEmptyBodySource,
  DenoBodySource,
  EmptyBodySource,
} from '../body-source';

/**
 * Create a mock Request with body
 */
function createRequestWithBody(
  body: string | null,
  contentType: string = 'text/plain',
  contentLength?: number
): Request {
  const headers: Record<string, string> = {
    'content-type': contentType,
  };

  if (contentLength !== undefined) {
    headers['content-length'] = String(contentLength);
  } else if (body !== null) {
    headers['content-length'] = String(new TextEncoder().encode(body).length);
  }

  return new Request('http://localhost/', {
    method: 'POST',
    headers,
    body,
  });
}

describe('DenoBodySource', () => {
  describe('constructor', () => {
    it('should parse content-length header', () => {
      const request = createRequestWithBody('hello', 'text/plain', 5);
      const bodySource = new DenoBodySource(request);

      expect(bodySource.contentLength).toBe(5);
    });

    it('should handle missing content-length', () => {
      const request = new Request('http://localhost/', {
        method: 'POST',
        body: 'hello',
      });
      const bodySource = new DenoBodySource(request);

      expect(bodySource.contentLength).toBeUndefined();
    });

    it('should parse content-type header', () => {
      const request = createRequestWithBody('{}', 'application/json');
      const bodySource = new DenoBodySource(request);

      expect(bodySource.contentType).toBe('application/json');
    });

    it('should handle request with string body - auto content-type', () => {
      const request = new Request('http://localhost/', {
        method: 'POST',
        body: 'hello',
      });
      const bodySource = new DenoBodySource(request);

      expect(bodySource.contentType).toBe('text/plain;charset=UTF-8');
    });

    it('should not be consumed initially', () => {
      const request = createRequestWithBody('hello');
      const bodySource = new DenoBodySource(request);

      expect(bodySource.consumed).toBe(false);
    });
  });

  describe('text()', () => {
    it('should read body as text', async () => {
      const request = createRequestWithBody('Hello World');
      const bodySource = new DenoBodySource(request);

      const text = await bodySource.text();
      expect(text).toBe('Hello World');
    });

    it('should mark as consumed after reading', async () => {
      const request = createRequestWithBody('test');
      const bodySource = new DenoBodySource(request);

      await bodySource.text();
      expect(bodySource.consumed).toBe(true);
    });

    it('should throw BodyTooLargeError when content-length exceeds limit', async () => {
      const request = createRequestWithBody('hello', 'text/plain', 100);
      const bodySource = new DenoBodySource(request, { limit: 10 });

      await expect(bodySource.text()).rejects.toThrow(BodyTooLargeError);
    });

    it('should allow reading from cache after consumed', async () => {
      const request = createRequestWithBody('cached');
      const bodySource = new DenoBodySource(request);

      const first = await bodySource.text();
      const second = await bodySource.text();

      expect(first).toBe('cached');
      expect(second).toBe('cached');
    });
  });

  describe('buffer()', () => {
    it('should read body as Uint8Array', async () => {
      const request = createRequestWithBody('Hello');
      const bodySource = new DenoBodySource(request);

      const buffer = await bodySource.buffer();
      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(buffer)).toBe('Hello');
    });

    it('should mark as consumed after reading', async () => {
      const request = createRequestWithBody('test');
      const bodySource = new DenoBodySource(request);

      await bodySource.buffer();
      expect(bodySource.consumed).toBe(true);
    });

    it('should throw BodyTooLargeError when exceeds limit', async () => {
      const request = createRequestWithBody('hello', 'text/plain', 100);
      const bodySource = new DenoBodySource(request, { limit: 10 });

      await expect(bodySource.buffer()).rejects.toThrow(BodyTooLargeError);
    });

    it('should return cached buffer on subsequent calls', async () => {
      const request = createRequestWithBody('cached');
      const bodySource = new DenoBodySource(request);

      const first = await bodySource.buffer();
      const second = await bodySource.buffer();

      expect(first).toEqual(second);
    });
  });

  describe('json()', () => {
    it('should read body as JSON', async () => {
      const request = createRequestWithBody('{"name":"John","age":30}', 'application/json');
      const bodySource = new DenoBodySource(request);

      const data = await bodySource.json();
      expect(data).toEqual({ name: 'John', age: 30 });
    });

    it('should mark as consumed after reading', async () => {
      const request = createRequestWithBody('{}', 'application/json');
      const bodySource = new DenoBodySource(request);

      await bodySource.json();
      expect(bodySource.consumed).toBe(true);
    });

    it('should throw BadRequestError for invalid JSON', async () => {
      const request = createRequestWithBody('not json', 'application/json');
      const bodySource = new DenoBodySource(request);

      await expect(bodySource.json()).rejects.toThrow('Invalid JSON');
    });

    it('should parse from cached buffer when consumed', async () => {
      const request = createRequestWithBody('{"cached":true}', 'application/json');
      const bodySource = new DenoBodySource(request);

      await bodySource.text();
      const data = await bodySource.json();
      expect(data).toEqual({ cached: true });
    });
  });

  describe('stream()', () => {
    it('should return ReadableStream', () => {
      const request = createRequestWithBody('streaming');
      const bodySource = new DenoBodySource(request);

      const stream = bodySource.stream();
      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it('should mark as consumed', () => {
      const request = createRequestWithBody('test');
      const bodySource = new DenoBodySource(request);

      bodySource.stream();
      expect(bodySource.consumed).toBe(true);
    });

    it('should throw BodyConsumedError if already consumed', async () => {
      const request = createRequestWithBody('test');
      const bodySource = new DenoBodySource(request);

      await bodySource.text();

      expect(() => bodySource.stream()).toThrow(BodyConsumedError);
    });
  });
});

describe('EmptyBodySource', () => {
  let emptySource: EmptyBodySource;

  beforeEach(() => {
    emptySource = new EmptyBodySource();
  });

  it('should have contentLength of 0', () => {
    expect(emptySource.contentLength).toBe(0);
  });

  it('should have undefined contentType', () => {
    expect(emptySource.contentType).toBeUndefined();
  });

  it('should not be consumed', () => {
    expect(emptySource.consumed).toBe(false);
  });

  it('should return empty string from text()', async () => {
    const text = await emptySource.text();
    expect(text).toBe('');
  });

  it('should return empty Uint8Array from buffer()', async () => {
    const buffer = await emptySource.buffer();
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBe(0);
  });

  it('should throw BadRequestError from json()', async () => {
    await expect(emptySource.json()).rejects.toThrow('Request body is empty');
  });

  it('should return empty ReadableStream from stream()', async () => {
    const stream = emptySource.stream();
    expect(stream).toBeInstanceOf(ReadableStream);

    const reader = stream.getReader();
    const { done, value } = await reader.read();
    expect(done).toBe(true);
    expect(value).toBeUndefined();
  });
});

describe('BodyConsumedError', () => {
  it('should have correct message', () => {
    const error = new BodyConsumedError();
    expect(error.message).toBe('Body has already been consumed');
    expect(error.name).toBe('BodyConsumedError');
  });
});

describe('BodyTooLargeError', () => {
  it('should have correct message and properties', () => {
    const error = new BodyTooLargeError(100, 200);

    expect(error.message).toContain('200 bytes');
    expect(error.message).toContain('100 bytes');
    expect(error.name).toBe('BodyTooLargeError');
    expect(error.limit).toBe(100);
    expect(error.received).toBe(200);
  });
});

describe('createDenoBodySource', () => {
  it('should create DenoBodySource instance', () => {
    const request = createRequestWithBody('test');
    const bodySource = createDenoBodySource(request);

    expect(bodySource).toBeInstanceOf(DenoBodySource);
  });

  it('should pass options', () => {
    const request = createRequestWithBody('test', 'text/plain', 100);
    const bodySource = createDenoBodySource(request, { limit: 10 });

    expect(bodySource).toBeInstanceOf(DenoBodySource);
  });
});

describe('createEmptyBodySource', () => {
  it('should create EmptyBodySource instance', () => {
    const bodySource = createEmptyBodySource();
    expect(bodySource).toBeInstanceOf(EmptyBodySource);
  });
});
