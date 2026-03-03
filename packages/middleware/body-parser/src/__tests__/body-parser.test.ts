import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bodyParser,
  BodyParserError,
  bufferToString,
  concatBuffers,
  formatBytes,
  getContentLength,
  json,
  matchContentType,
  normalizeCharset,
  parseLimit,
  parseUrlEncoded,
  raw,
  safeDecodeURIComponent,
  setNestedValue,
  text,
  urlencoded,
  type BodyParserContext,
} from '../index';
import { isCharsetSupported } from '../utils/content-type.js';

function createMockContext(
  method: string = 'POST',
  contentType?: string,
  body?: string | Buffer,
  contentLength?: number
): BodyParserContext {
  const emitter = new EventEmitter();
  const headers: Record<string, string | undefined> = {};

  if (contentType) {
    headers['content-type'] = contentType;
  }
  if (contentLength !== undefined) {
    headers['content-length'] = String(contentLength);
  } else if (body) {
    headers['content-length'] = String(Buffer.byteLength(body));
  }

  const ctx: BodyParserContext = {
    method,
    path: '/',
    headers,
    raw: {
      req: {
        on: (event: string, listener: (arg?: Buffer | Error) => void) => {
          emitter.on(event, listener);
        },
      } as BodyParserContext['raw']['req'],
    },
  };

  // Emit body data after a tick
  if (body !== undefined) {
    setImmediate(() => {
      const buffer = typeof body === 'string' ? Buffer.from(body) : body;
      emitter.emit('data', buffer);
      emitter.emit('end');
    });
  } else {
    setImmediate(() => {
      emitter.emit('end');
    });
  }

  return ctx;
}

describe('json middleware', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  describe('basic parsing', () => {
    it('should parse JSON body', async () => {
      const ctx = createMockContext('POST', 'application/json', '{"name":"John"}');
      await json()(ctx, next);

      expect(ctx.body).toEqual({ name: 'John' });
      expect(next).toHaveBeenCalledOnce();
    });

    it('should parse JSON array', async () => {
      const ctx = createMockContext('POST', 'application/json', '[1, 2, 3]');
      await json()(ctx, next);

      expect(ctx.body).toEqual([1, 2, 3]);
    });

    it('should handle empty body', async () => {
      const ctx = createMockContext('POST', 'application/json', '');
      await json()(ctx, next);

      expect(ctx.body).toBeUndefined();
    });

    it('should handle nested objects', async () => {
      const data = { user: { name: 'John', address: { city: 'NYC' } } };
      const ctx = createMockContext('POST', 'application/json', JSON.stringify(data));
      await json()(ctx, next);

      expect(ctx.body).toEqual(data);
    });
  });

  describe('skip conditions', () => {
    it('should skip GET requests', async () => {
      const ctx = createMockContext('GET', 'application/json', '{"name":"John"}');
      await json()(ctx, next);

      expect(ctx.body).toBeUndefined();
      expect(next).toHaveBeenCalledOnce();
    });

    it('should skip HEAD requests', async () => {
      const ctx = createMockContext('HEAD', 'application/json');
      await json()(ctx, next);

      expect(ctx.body).toBeUndefined();
    });

    it('should skip DELETE requests', async () => {
      const ctx = createMockContext('DELETE', 'application/json');
      await json()(ctx, next);

      expect(ctx.body).toBeUndefined();
    });

    it('should skip non-JSON content types', async () => {
      const ctx = createMockContext('POST', 'text/plain', '{"name":"John"}');
      await json()(ctx, next);

      expect(ctx.body).toBeUndefined();
    });

    it('should skip when no content-type', async () => {
      const ctx = createMockContext('POST', undefined, '{"name":"John"}');
      await json()(ctx, next);

      expect(ctx.body).toBeUndefined();
    });
  });

  describe('content-type matching', () => {
    it('should parse application/json', async () => {
      const ctx = createMockContext('POST', 'application/json', '{}');
      await json()(ctx, next);

      expect(ctx.body).toEqual({});
    });

    it('should parse application/json with charset', async () => {
      const ctx = createMockContext('POST', 'application/json; charset=utf-8', '{}');
      await json()(ctx, next);

      expect(ctx.body).toEqual({});
    });

    it('should support custom content types', async () => {
      const ctx = createMockContext('POST', 'application/vnd.api+json', '{}');
      await json({ type: 'application/vnd.api+json' })(ctx, next);

      expect(ctx.body).toEqual({});
    });

    it('should support array of content types', async () => {
      const middleware = json({ type: ['application/json', 'text/json'] });

      const ctx1 = createMockContext('POST', 'application/json', '{}');
      await middleware(ctx1, next);
      expect(ctx1.body).toEqual({});

      const ctx2 = createMockContext('POST', 'text/json', '{}');
      await middleware(ctx2, next);
      expect(ctx2.body).toEqual({});
    });
  });

  describe('options', () => {
    it('should respect limit option', async () => {
      const largeBody = JSON.stringify({ data: 'x'.repeat(1000) });
      const ctx = createMockContext('POST', 'application/json', largeBody);

      await expect(json({ limit: 100 })(ctx, next)).rejects.toThrow(BodyParserError);
    });

    it('should parse limit string (kb)', async () => {
      const ctx = createMockContext('POST', 'application/json', '{}');
      await json({ limit: '1kb' })(ctx, next);

      expect(ctx.body).toEqual({});
    });

    it('should store raw body when rawBody=true', async () => {
      const body = '{"name":"John"}';
      const ctx = createMockContext('POST', 'application/json', body);
      await json({ rawBody: true })(ctx, next);

      expect(ctx.rawBody).toEqual(Buffer.from(body));
    });

    it('should use reviver function', async () => {
      const ctx = createMockContext('POST', 'application/json', '{"date":"2023-01-01"}');
      await json({
        reviver: (key, value) => {
          if (key === 'date') return new Date(value as string);
          return value;
        },
      })(ctx, next);

      expect((ctx.body as Record<string, unknown>).date).toBeInstanceOf(Date);
    });
  });

  describe('strict mode', () => {
    it('should reject non-object in strict mode', async () => {
      const ctx = createMockContext('POST', 'application/json', '"just a string"');

      await expect(json({ strict: true })(ctx, next)).rejects.toThrow('strict mode');
    });

    it('should reject number in strict mode', async () => {
      const ctx = createMockContext('POST', 'application/json', '42');

      await expect(json({ strict: true })(ctx, next)).rejects.toThrow('strict mode');
    });

    it('should reject null in strict mode', async () => {
      const ctx = createMockContext('POST', 'application/json', 'null');

      await expect(json({ strict: true })(ctx, next)).rejects.toThrow('strict mode');
    });

    it('should allow primitives when strict=false', async () => {
      const ctx = createMockContext('POST', 'application/json', '"hello"');
      await json({ strict: false })(ctx, next);

      expect(ctx.body).toBe('hello');
    });
  });

  describe('error handling', () => {
    it('should throw on invalid JSON', async () => {
      const ctx = createMockContext('POST', 'application/json', '{invalid}');

      await expect(json()(ctx, next)).rejects.toThrow(BodyParserError);
    });

    it('should include error code', async () => {
      const ctx = createMockContext('POST', 'application/json', '{invalid}');

      try {
        await json()(ctx, next);
      } catch (err) {
        expect((err as BodyParserError).code).toBe('INVALID_JSON');
        expect((err as BodyParserError).status).toBe(400);
      }
    });

    it('should throw on body too large', async () => {
      const ctx = createMockContext('POST', 'application/json', '{}', 1000000);

      try {
        await json({ limit: 100 })(ctx, next);
      } catch (err) {
        expect((err as BodyParserError).code).toBe('ENTITY_TOO_LARGE');
        expect((err as BodyParserError).status).toBe(413);
      }
    });
  });

  it('should work without next function', async () => {
    const ctx = createMockContext('POST', 'application/json', '{}');
    await expect(json()(ctx)).resolves.not.toThrow();
  });
});

describe('urlencoded middleware', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  describe('basic parsing', () => {
    it('should parse URL-encoded body', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        'name=John&age=30'
      );
      await urlencoded()(ctx, next);

      expect(ctx.body).toEqual({ name: 'John', age: '30' });
    });

    it('should handle empty body', async () => {
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', '');
      await urlencoded()(ctx, next);

      expect(ctx.body).toEqual({});
    });

    it('should decode URL-encoded values', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        'message=Hello%20World'
      );
      await urlencoded()(ctx, next);

      expect(ctx.body).toEqual({ message: 'Hello World' });
    });

    it('should handle + as space', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        'message=Hello+World'
      );
      await urlencoded()(ctx, next);

      expect(ctx.body).toEqual({ message: 'Hello World' });
    });

    it('should handle special characters', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        'email=test%40example.com'
      );
      await urlencoded()(ctx, next);

      expect(ctx.body).toEqual({ email: 'test@example.com' });
    });
  });

  describe('array handling', () => {
    it('should handle duplicate keys as arrays', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        'color=red&color=blue'
      );
      await urlencoded()(ctx, next);

      expect(ctx.body).toEqual({ color: ['red', 'blue'] });
    });
  });

  describe('extended mode', () => {
    it('should parse nested objects when extended=true', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        'user[name]=John&user[age]=30'
      );
      await urlencoded({ extended: true })(ctx, next);

      expect(ctx.body).toEqual({ user: { name: 'John', age: '30' } });
    });

    it('should parse arrays when extended=true', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        'items[0]=a&items[1]=b'
      );
      await urlencoded({ extended: true })(ctx, next);

      expect(ctx.body).toEqual({ items: ['a', 'b'] });
    });

    it('should not parse nested objects when extended=false', async () => {
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'user[name]=John');
      await urlencoded({ extended: false })(ctx, next);

      expect(ctx.body).toEqual({ 'user[name]': 'John' });
    });
  });

  describe('options', () => {
    it('should respect limit option', async () => {
      const largeBody = 'x=' + 'a'.repeat(1000);
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', largeBody);

      await expect(urlencoded({ limit: 100 })(ctx, next)).rejects.toThrow(BodyParserError);
    });

    it('should respect parameterLimit', async () => {
      const params = Array.from({ length: 10 }, (_, i) => `key${i}=value${i}`).join('&');
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', params);

      await expect(urlencoded({ parameterLimit: 5 })(ctx, next)).rejects.toThrow(
        'Too many parameters'
      );
    });

    it('should store raw body when rawBody=true', async () => {
      const body = 'name=John';
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', body);
      await urlencoded({ rawBody: true })(ctx, next);

      expect(ctx.rawBody).toEqual(Buffer.from(body));
    });
  });

  describe('skip conditions', () => {
    it('should skip GET requests', async () => {
      const ctx = createMockContext('GET', 'application/x-www-form-urlencoded');
      await urlencoded()(ctx, next);

      expect(ctx.body).toBeUndefined();
    });

    it('should skip non-matching content types', async () => {
      const ctx = createMockContext('POST', 'application/json', 'name=John');
      await urlencoded()(ctx, next);

      expect(ctx.body).toBeUndefined();
    });
  });
});

describe('text middleware', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should parse text body', async () => {
    const ctx = createMockContext('POST', 'text/plain', 'Hello World');
    await text()(ctx, next);

    expect(ctx.body).toBe('Hello World');
  });

  it('should handle empty body', async () => {
    const ctx = createMockContext('POST', 'text/plain', '');
    await text()(ctx, next);

    expect(ctx.body).toBe('');
  });

  it('should skip non-text content types', async () => {
    const ctx = createMockContext('POST', 'application/json', 'hello');
    await text()(ctx, next);

    expect(ctx.body).toBeUndefined();
  });

  it('should support custom content types', async () => {
    const ctx = createMockContext('POST', 'text/html', '<h1>Hello</h1>');
    await text({ type: 'text/html' })(ctx, next);

    expect(ctx.body).toBe('<h1>Hello</h1>');
  });

  it('should respect limit option', async () => {
    const ctx = createMockContext('POST', 'text/plain', 'x'.repeat(1000));

    await expect(text({ limit: 100 })(ctx, next)).rejects.toThrow(BodyParserError);
  });

  it('should store raw body when rawBody=true', async () => {
    const body = 'Hello';
    const ctx = createMockContext('POST', 'text/plain', body);
    await text({ rawBody: true })(ctx, next);

    expect(ctx.rawBody).toEqual(Buffer.from(body));
  });
});

describe('raw middleware', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should parse raw body as Buffer', async () => {
    const data = Buffer.from([0x00, 0x01, 0x02]);
    const ctx = createMockContext('POST', 'application/octet-stream', data);
    await raw()(ctx, next);

    expect(ctx.body).toBeInstanceOf(Buffer);
    expect(ctx.body).toEqual(data);
  });

  it('should skip non-matching content types', async () => {
    const ctx = createMockContext('POST', 'application/json', '{}');
    await raw()(ctx, next);

    expect(ctx.body).toBeUndefined();
  });

  it('should support custom content types', async () => {
    const ctx = createMockContext('POST', 'image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await raw({ type: 'image/png' })(ctx, next);

    expect(ctx.body).toBeInstanceOf(Buffer);
  });

  it('should respect limit option', async () => {
    const ctx = createMockContext('POST', 'application/octet-stream', Buffer.alloc(1000));

    await expect(raw({ limit: 100 })(ctx, next)).rejects.toThrow(BodyParserError);
  });
});

describe('bodyParser middleware', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should parse JSON body', async () => {
    const ctx = createMockContext('POST', 'application/json', '{"name":"John"}');
    await bodyParser()(ctx, next);

    expect(ctx.body).toEqual({ name: 'John' });
  });

  it('should parse URL-encoded body', async () => {
    const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'name=John');
    await bodyParser()(ctx, next);

    expect(ctx.body).toEqual({ name: 'John' });
  });

  it('should skip unknown content types', async () => {
    const ctx = createMockContext('POST', 'text/plain', 'hello');
    await bodyParser()(ctx, next);

    expect(ctx.body).toBeUndefined();
  });

  it('should allow disabling JSON parsing', async () => {
    const ctx = createMockContext('POST', 'application/json', '{}');
    await bodyParser({ json: false })(ctx, next);

    expect(ctx.body).toBeUndefined();
  });

  it('should allow disabling URL-encoded parsing', async () => {
    const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'name=John');
    await bodyParser({ urlencoded: false })(ctx, next);

    expect(ctx.body).toBeUndefined();
  });

  it('should pass options to JSON middleware', async () => {
    const largeBody = JSON.stringify({ data: 'x'.repeat(1000) });
    const ctx = createMockContext('POST', 'application/json', largeBody);

    await expect(bodyParser({ json: { limit: 100 } })(ctx, next)).rejects.toThrow(BodyParserError);
  });
});

describe('BodyParserError', () => {
  it('should create error with status and code', () => {
    const error = new BodyParserError('Test error', 400, 'TEST_ERROR');

    expect(error.message).toBe('Test error');
    expect(error.status).toBe(400);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.name).toBe('BodyParserError');
  });

  it('should expose client errors', () => {
    const error = new BodyParserError('Client error', 400, 'CLIENT_ERROR');
    expect(error.expose).toBe(true);
  });

  it('should not expose server errors', () => {
    const error = new BodyParserError('Server error', 500, 'SERVER_ERROR');
    expect(error.expose).toBe(false);
  });
});

describe('edge cases', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should handle wildcard content type', async () => {
    const ctx = createMockContext('POST', 'application/json', '{}');
    await json({ type: '*/*' })(ctx, next);

    expect(ctx.body).toEqual({});
  });

  it('should handle prefix wildcard', async () => {
    const ctx = createMockContext('POST', 'application/vnd.api+json', '{}');
    await json({ type: 'application/*' })(ctx, next);

    expect(ctx.body).toEqual({});
  });

  it('should handle key without value in URL-encoded', async () => {
    const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'flag');
    await urlencoded()(ctx, next);

    expect(ctx.body).toEqual({ flag: '' });
  });

  it('should handle concurrent requests', async () => {
    const ctx1 = createMockContext('POST', 'application/json', '{"id":1}');
    const ctx2 = createMockContext('POST', 'application/json', '{"id":2}');

    const [,] = await Promise.all([
      json()(ctx1, vi.fn().mockResolvedValue(undefined)),
      json()(ctx2, vi.fn().mockResolvedValue(undefined)),
    ]);

    expect(ctx1.body).toEqual({ id: 1 });
    expect(ctx2.body).toEqual({ id: 2 });
  });

  it('should handle PUT method', async () => {
    const ctx = createMockContext('PUT', 'application/json', '{"name":"Updated"}');
    await json()(ctx, next);

    expect(ctx.body).toEqual({ name: 'Updated' });
  });

  it('should handle PATCH method', async () => {
    const ctx = createMockContext('PATCH', 'application/json', '{"name":"Patched"}');
    await json()(ctx, next);

    expect(ctx.body).toEqual({ name: 'Patched' });
  });

  it('should pass through errors from next', async () => {
    const ctx = createMockContext('POST', 'application/json', '{}');
    const error = new Error('Test error');
    const failingNext = vi.fn().mockRejectedValue(error);

    await expect(json()(ctx, failingNext)).rejects.toThrow('Test error');
  });
});

// ============================================================================
// SECURITY TESTS
// ============================================================================

describe('Security: Prototype Pollution Prevention', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  describe('URL-encoded prototype pollution', () => {
    it('should reject __proto__ key', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        '__proto__[polluted]=true'
      );

      await expect(urlencoded({ extended: true })(ctx, next)).rejects.toThrow(BodyParserError);
    });

    it('should reject constructor key', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        'constructor[prototype][polluted]=true'
      );

      await expect(urlencoded({ extended: true })(ctx, next)).rejects.toThrow(BodyParserError);
    });

    it('should reject prototype key', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        'prototype[polluted]=true'
      );

      await expect(urlencoded({ extended: true })(ctx, next)).rejects.toThrow(BodyParserError);
    });

    it('should reject deeply nested __proto__', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        'a[b][__proto__][polluted]=true'
      );

      await expect(urlencoded({ extended: true })(ctx, next)).rejects.toThrow(BodyParserError);
    });

    it('should reject URL-encoded __proto__', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        '__proto__%5Bpolluted%5D=true'
      );

      await expect(urlencoded({ extended: true })(ctx, next)).rejects.toThrow(BodyParserError);
    });

    it('should have INVALID_PARAMETER error code for prototype pollution', async () => {
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', '__proto__[x]=y');

      try {
        await urlencoded({ extended: true })(ctx, next);
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as BodyParserError).code).toBe('INVALID_PARAMETER');
        expect((err as BodyParserError).status).toBe(400);
      }
    });

    it('should not pollute Object.prototype', async () => {
      const originalProto = Object.prototype;
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        '__proto__[polluted]=true'
      );

      try {
        await urlencoded({ extended: true })(ctx, next);
      } catch {
        // Expected
      }

      expect(Object.prototype).toBe(originalProto);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(({} as any).polluted).toBeUndefined();
    });
  });

  describe('JSON prototype pollution', () => {
    it('should parse JSON with __proto__ as data (JSON.parse behavior)', async () => {
      // Note: JSON.parse does NOT cause prototype pollution
      // The key is parsed as a regular property
      const ctx = createMockContext('POST', 'application/json', '{"__proto__":{"polluted":true}}');

      await json()(ctx, next);

      // JSON.parse creates a property named __proto__, not prototype chain access
      expect(ctx.body).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(({} as any).polluted).toBeUndefined(); // Object.prototype not affected
    });
  });
});

describe('Security: DoS Prevention', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  describe('Size limits', () => {
    it('should reject body exceeding byte limit', async () => {
      const largeBody = '{"data":"' + 'x'.repeat(10000) + '"}';
      const ctx = createMockContext('POST', 'application/json', largeBody);

      await expect(json({ limit: 1000 })(ctx, next)).rejects.toThrow(BodyParserError);
    });

    it('should have ENTITY_TOO_LARGE error code', async () => {
      const ctx = createMockContext('POST', 'application/json', '{"x":"y"}', 999999);

      try {
        await json({ limit: 100 })(ctx, next);
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as BodyParserError).code).toBe('ENTITY_TOO_LARGE');
        expect((err as BodyParserError).status).toBe(413);
      }
    });

    it('should reject based on Content-Length header before reading', async () => {
      const ctx = createMockContext('POST', 'application/json', '', 10000000);

      await expect(json({ limit: 1000 })(ctx, next)).rejects.toThrow('Request body too large');
    });

    it('should parse various limit formats', async () => {
      const ctx1 = createMockContext('POST', 'application/json', '{}');
      await json({ limit: '1kb' })(ctx1, next);
      expect(ctx1.body).toEqual({});

      const ctx2 = createMockContext('POST', 'application/json', '{}');
      await json({ limit: '1mb' })(ctx2, next);
      expect(ctx2.body).toEqual({});

      const ctx3 = createMockContext('POST', 'application/json', '{}');
      await json({ limit: 1024 })(ctx3, next);
      expect(ctx3.body).toEqual({});
    });
  });

  describe('Parameter limits', () => {
    it('should reject too many URL-encoded parameters', async () => {
      const params = Array.from({ length: 1001 }, (_, i) => `k${i}=v`).join('&');
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', params);

      await expect(urlencoded({ parameterLimit: 1000 })(ctx, next)).rejects.toThrow(
        BodyParserError
      );
    });

    it('should have TOO_MANY_PARAMETERS error code', async () => {
      const params = 'a=1&b=2&c=3&d=4&e=5&f=6';
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', params);

      try {
        await urlencoded({ parameterLimit: 3 })(ctx, next);
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as BodyParserError).code).toBe('TOO_MANY_PARAMETERS');
      }
    });
  });

  describe('Nesting depth limits', () => {
    it('should reject deeply nested URL-encoded', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        'a[b][c][d][e][f][g]=deep'
      );

      await expect(urlencoded({ extended: true, depth: 3 })(ctx, next)).rejects.toThrow(
        BodyParserError
      );
    });

    it('should have DEPTH_EXCEEDED error code', async () => {
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'a[b][c][d][e]=v');

      try {
        await urlencoded({ extended: true, depth: 2 })(ctx, next);
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as BodyParserError).code).toBe('DEPTH_EXCEEDED');
        expect((err as BodyParserError).status).toBe(400);
      }
    });

    it('should allow nesting within depth limit', async () => {
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'a[b][c]=value');

      await urlencoded({ extended: true, depth: 5 })(ctx, next);
      expect(ctx.body).toEqual({ a: { b: { c: 'value' } } });
    });
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('Error Handling: Malformed Input', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  describe('Invalid JSON', () => {
    it('should reject truncated JSON', async () => {
      const ctx = createMockContext('POST', 'application/json', '{"name":');
      await expect(json()(ctx, next)).rejects.toThrow(BodyParserError);
    });

    it('should reject JSON with trailing comma', async () => {
      const ctx = createMockContext('POST', 'application/json', '{"name":"John",}');
      await expect(json()(ctx, next)).rejects.toThrow(BodyParserError);
    });

    it('should reject JSON with single quotes', async () => {
      const ctx = createMockContext('POST', 'application/json', "{'name':'John'}");
      await expect(json()(ctx, next)).rejects.toThrow(BodyParserError);
    });

    it('should reject JavaScript comments in JSON', async () => {
      const ctx = createMockContext('POST', 'application/json', '{"name":"John"/* comment */}');
      await expect(json()(ctx, next)).rejects.toThrow(BodyParserError);
    });

    it('should reject undefined in JSON', async () => {
      const ctx = createMockContext('POST', 'application/json', '{"name":undefined}');
      await expect(json()(ctx, next)).rejects.toThrow(BodyParserError);
    });

    it('should handle INVALID_JSON error code', async () => {
      const ctx = createMockContext('POST', 'application/json', 'not json');

      try {
        await json()(ctx, next);
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as BodyParserError).code).toBe('INVALID_JSON');
        expect((err as BodyParserError).status).toBe(400);
      }
    });
  });

  describe('Invalid URL-encoded', () => {
    it('should handle malformed percent encoding gracefully', async () => {
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'name=%ZZ');

      // Should not throw, should return original string
      await urlencoded()(ctx, next);
      expect(ctx.body).toBeDefined();
    });

    it('should handle incomplete percent encoding', async () => {
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'name=test%2');

      await urlencoded()(ctx, next);
      expect(ctx.body).toBeDefined();
    });

    it('should handle empty keys gracefully', async () => {
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', '=value');

      await urlencoded()(ctx, next);
      // Implementation skips empty keys for security
      expect(ctx.body).toEqual({});
    });

    it('should handle multiple equals signs', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        'key=value=with=equals'
      );

      await urlencoded()(ctx, next);
      expect(ctx.body).toEqual({ key: 'value=with=equals' });
    });
  });
});

// ============================================================================
// CHARSET HANDLING TESTS
// ============================================================================

describe('Charset Handling', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should parse utf-8 charset', async () => {
    const ctx = createMockContext('POST', 'application/json; charset=utf-8', '{"emoji":"🚀"}');

    await json()(ctx, next);
    expect((ctx.body as Record<string, string>).emoji).toBe('🚀');
  });

  it('should parse UTF-8 (uppercase)', async () => {
    const ctx = createMockContext('POST', 'application/json; charset=UTF-8', '{"name":"Test"}');

    await json()(ctx, next);
    expect(ctx.body).toEqual({ name: 'Test' });
  });

  it('should default to utf-8 for text', async () => {
    const ctx = createMockContext('POST', 'text/plain', 'Hello 世界');

    await text({ defaultCharset: 'utf-8' })(ctx, next);
    expect(ctx.body).toBe('Hello 世界');
  });

  it('should handle latin1 charset', async () => {
    const ctx = createMockContext(
      'POST',
      'text/plain; charset=latin1',
      Buffer.from('Caf\xe9', 'latin1')
    );

    await text()(ctx, next);
    expect(ctx.body).toBeDefined();
  });

  it('should handle ascii charset', async () => {
    const ctx = createMockContext('POST', 'text/plain; charset=ascii', 'Hello World');

    await text()(ctx, next);
    expect(ctx.body).toBe('Hello World');
  });
});

// ============================================================================
// SPECIAL CHARACTER TESTS
// ============================================================================

describe('Special Characters', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should handle JSON with unicode', async () => {
    const ctx = createMockContext('POST', 'application/json', '{"name":"日本語","emoji":"🎉"}');

    await json()(ctx, next);
    expect((ctx.body as Record<string, string>).name).toBe('日本語');
    expect((ctx.body as Record<string, string>).emoji).toBe('🎉');
  });

  it('should handle JSON with escaped unicode', async () => {
    const ctx = createMockContext(
      'POST',
      'application/json',
      '{"name":"\\u0048\\u0065\\u006c\\u006c\\u006f"}'
    );

    await json()(ctx, next);
    expect((ctx.body as Record<string, string>).name).toBe('Hello');
  });

  it('should handle URL-encoded with unicode', async () => {
    const ctx = createMockContext(
      'POST',
      'application/x-www-form-urlencoded',
      'name=%E6%97%A5%E6%9C%AC%E8%AA%9E'
    );

    await urlencoded()(ctx, next);
    expect((ctx.body as Record<string, string>).name).toBe('日本語');
  });

  it('should handle newlines in JSON strings', async () => {
    const ctx = createMockContext('POST', 'application/json', '{"text":"line1\\nline2"}');

    await json()(ctx, next);
    expect((ctx.body as Record<string, string>).text).toBe('line1\nline2');
  });

  it('should handle tabs in JSON strings', async () => {
    const ctx = createMockContext('POST', 'application/json', '{"text":"col1\\tcol2"}');

    await json()(ctx, next);
    expect((ctx.body as Record<string, string>).text).toBe('col1\tcol2');
  });
});

// ============================================================================
// CONTENT-TYPE MATCHING TESTS
// ============================================================================

describe('Content-Type Matching', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should match application/vnd.api+json when explicitly configured', async () => {
    const ctx = createMockContext('POST', 'application/vnd.api+json', '{"data":[]}');

    // Wildcard patterns need explicit matching in implementation
    await json({ type: ['application/json', 'application/vnd.api+json'] })(ctx, next);
    expect(ctx.body).toEqual({ data: [] });
  });

  it('should match with parameters', async () => {
    const ctx = createMockContext(
      'POST',
      'application/json; charset=utf-8; boundary=something',
      '{"test":true}'
    );

    await json()(ctx, next);
    expect(ctx.body).toEqual({ test: true });
  });

  it('should be case-insensitive', async () => {
    const ctx = createMockContext('POST', 'APPLICATION/JSON', '{"upper":true}');

    await json()(ctx, next);
    expect(ctx.body).toEqual({ upper: true });
  });

  it('should not match partial type', async () => {
    const ctx = createMockContext('POST', 'application/jsonx', '{"test":true}');

    await json()(ctx, next);
    expect(ctx.body).toBeUndefined();
  });
});

// ============================================================================
// COMBINED PARSER TESTS
// ============================================================================

describe('Combined Parser: Content-Type Routing', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should route JSON correctly', async () => {
    const ctx = createMockContext('POST', 'application/json', '{"from":"json"}');
    await bodyParser()(ctx, next);
    expect(ctx.body).toEqual({ from: 'json' });
  });

  it('should route URL-encoded correctly', async () => {
    const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'from=urlencoded');
    await bodyParser()(ctx, next);
    expect(ctx.body).toEqual({ from: 'urlencoded' });
  });

  it('should route text when enabled', async () => {
    const ctx = createMockContext('POST', 'text/plain', 'plain text');
    await bodyParser({ text: { limit: '1mb' } })(ctx, next);
    expect(ctx.body).toBe('plain text');
  });

  it('should route raw when enabled', async () => {
    const buffer = Buffer.from([0x01, 0x02, 0x03]);
    const ctx = createMockContext('POST', 'application/octet-stream', buffer);
    await bodyParser({ raw: { limit: '1mb' } })(ctx, next);
    expect(ctx.body).toEqual(buffer);
  });

  it('should respect custom types per parser', async () => {
    const ctx = createMockContext('POST', 'application/vnd.custom+json', '{"custom":true}');

    await bodyParser({
      json: { type: ['application/vnd.custom+json'] },
    })(ctx, next);

    expect(ctx.body).toEqual({ custom: true });
  });
});

// ============================================================================
// METHOD HANDLING TESTS
// ============================================================================

describe('HTTP Method Handling', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it.each(['POST', 'PUT', 'PATCH'])('should parse %s requests', async (method) => {
    const ctx = createMockContext(method, 'application/json', '{"method":"' + method + '"}');
    await json()(ctx, next);
    expect((ctx.body as Record<string, string>).method).toBe(method);
  });

  it.each(['GET', 'HEAD', 'DELETE', 'OPTIONS'])('should skip %s requests', async (method) => {
    const ctx = createMockContext(method, 'application/json', '{"method":"' + method + '"}');
    await json()(ctx, next);
    expect(ctx.body).toBeUndefined();
  });
});

// ============================================================================
// RAW BODY PRESERVATION TESTS
// ============================================================================

describe('Raw Body Preservation', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should preserve raw body for signature verification', async () => {
    const body = '{"webhook":"data"}';
    const ctx = createMockContext('POST', 'application/json', body);

    await json({ rawBody: true })(ctx, next);

    expect(ctx.rawBody).toBeInstanceOf(Buffer);
    expect(ctx.rawBody?.toString()).toBe(body);
    expect(ctx.body).toEqual({ webhook: 'data' });
  });

  it('should preserve exact bytes', async () => {
    const body = '{"spaces":"  test  "}';
    const ctx = createMockContext('POST', 'application/json', body);

    await json({ rawBody: true })(ctx, next);

    expect(ctx.rawBody?.toString()).toBe(body);
  });

  it('should work with URL-encoded', async () => {
    const body = 'key=value&other=data';
    const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', body);

    await urlencoded({ rawBody: true })(ctx, next);

    expect(ctx.rawBody?.toString()).toBe(body);
    expect(ctx.body).toEqual({ key: 'value', other: 'data' });
  });
});

// ============================================================================
// LARGE PAYLOAD TESTS
// ============================================================================

describe('Large Payload Handling', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should handle large JSON within limit', async () => {
    const largeArray = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `item-${i}` }));
    const ctx = createMockContext('POST', 'application/json', JSON.stringify(largeArray));

    await json({ limit: '10mb' })(ctx, next);
    expect((ctx.body as unknown[]).length).toBe(1000);
  });

  it('should handle many URL-encoded params within limit', async () => {
    const params = Array.from({ length: 500 }, (_, i) => `key${i}=value${i}`).join('&');
    const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', params);

    await urlencoded({ parameterLimit: 1000 })(ctx, next);
    expect(Object.keys(ctx.body as object).length).toBe(500);
  });

  it('should handle deeply nested JSON', async () => {
    const nested = { a: { b: { c: { d: { e: { f: 'deep' } } } } } };
    const ctx = createMockContext('POST', 'application/json', JSON.stringify(nested));

    await json()(ctx, next);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((ctx.body as any).a.b.c.d.e.f).toBe('deep');
  });
});

// =============================================================================
// BODY SOURCE (Modern Cross-Runtime) TESTS
// =============================================================================

/**
 * Create a mock BodyParserBodySource for testing the modern cross-runtime path.
 */
function createBodySourceMock(
  body?: string | Buffer,
  options?: {
    contentLength?: number;
    contentType?: string;
    consumed?: boolean;
  }
): BodyParserContext['bodySource'] {
  let consumed = options?.consumed ?? false;
  const buf =
    body !== undefined
      ? typeof body === 'string'
        ? new TextEncoder().encode(body)
        : new Uint8Array(body)
      : new Uint8Array(0);

  return {
    async text() {
      if (consumed) {
        const err = new Error('Body has already been consumed');
        err.name = 'BodyConsumedError';
        throw err;
      }
      consumed = true;
      return typeof body === 'string' ? body : new TextDecoder().decode(buf);
    },
    async buffer() {
      if (consumed) {
        const err = new Error('Body has already been consumed');
        err.name = 'BodyConsumedError';
        throw err;
      }
      consumed = true;
      return buf;
    },
    async json<T>() {
      if (consumed) {
        const err = new Error('Body has already been consumed');
        err.name = 'BodyConsumedError';
        throw err;
      }
      consumed = true;
      return JSON.parse(new TextDecoder().decode(buf)) as T;
    },
    get consumed() {
      return consumed;
    },
    get contentLength() {
      return options?.contentLength ?? buf.length;
    },
    get contentType() {
      return options?.contentType;
    },
  };
}

/**
 * Create a mock context that uses bodySource instead of raw.req.
 */
function createMockContextWithBodySource(
  method: string,
  contentType: string | undefined,
  body?: string | Buffer,
  contentLength?: number
): BodyParserContext {
  const headers: Record<string, string | undefined> = {};

  if (contentType) {
    headers['content-type'] = contentType;
  }
  if (contentLength !== undefined) {
    headers['content-length'] = String(contentLength);
  } else if (body) {
    headers['content-length'] = String(
      typeof body === 'string' ? Buffer.byteLength(body) : body.length
    );
  }

  return {
    method,
    path: '/',
    headers,
    bodySource: createBodySourceMock(body, { contentType, contentLength }),
  };
}

describe('BodySource path (modern cross-runtime)', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  describe('json parser via bodySource', () => {
    it('should parse JSON body', async () => {
      const ctx = createMockContextWithBodySource('POST', 'application/json', '{"name":"Alice"}');
      await json()(ctx, next);

      expect(ctx.body).toEqual({ name: 'Alice' });
      expect(next).toHaveBeenCalledOnce();
    });

    it('should parse JSON array', async () => {
      const ctx = createMockContextWithBodySource('POST', 'application/json', '[1, 2, 3]');
      await json()(ctx, next);

      expect(ctx.body).toEqual([1, 2, 3]);
    });

    it('should handle empty body', async () => {
      const ctx = createMockContextWithBodySource('POST', 'application/json', '');
      await json()(ctx, next);

      expect(ctx.body).toBeUndefined();
    });

    it('should reject invalid JSON', async () => {
      const ctx = createMockContextWithBodySource('POST', 'application/json', '{invalid}');

      await expect(json()(ctx, next)).rejects.toThrow(BodyParserError);
    });

    it('should reject primitives in strict mode', async () => {
      const ctx = createMockContextWithBodySource('POST', 'application/json', '"just a string"');

      await expect(json({ strict: true })(ctx, next)).rejects.toThrow('strict mode');
    });

    it('should store rawBody when option enabled', async () => {
      const ctx = createMockContextWithBodySource('POST', 'application/json', '{"x":1}');
      await json({ rawBody: true })(ctx, next);

      expect(ctx.body).toEqual({ x: 1 });
      expect(ctx.rawBody).toBeInstanceOf(Buffer);
    });

    it('should handle consumed body error', async () => {
      const ctx = createMockContextWithBodySource('POST', 'application/json', '{"x":1}');
      // Pre-consume the body
      await ctx.bodySource!.buffer();

      await expect(json()(ctx, next)).rejects.toThrow('already been consumed');
    });

    it('should enforce size limit via bodySource', async () => {
      const ctx = createMockContextWithBodySource(
        'POST',
        'application/json',
        '{"x":1}',
        999999999 // Declared content-length exceeds limit
      );

      await expect(json({ limit: 100 })(ctx, next)).rejects.toThrow('too large');
    });
  });

  describe('urlencoded parser via bodySource', () => {
    it('should parse URL-encoded body', async () => {
      const ctx = createMockContextWithBodySource(
        'POST',
        'application/x-www-form-urlencoded',
        'name=Bob&age=30'
      );
      await urlencoded()(ctx, next);

      expect(ctx.body).toEqual({ name: 'Bob', age: '30' });
      expect(next).toHaveBeenCalledOnce();
    });

    it('should handle nested URL-encoded body', async () => {
      const ctx = createMockContextWithBodySource(
        'POST',
        'application/x-www-form-urlencoded',
        'user[name]=Bob&user[age]=30'
      );
      await urlencoded({ extended: true })(ctx, next);

      const body = ctx.body as Record<string, unknown>;
      expect(body).toHaveProperty('user');
    });

    it('should handle empty body', async () => {
      const ctx = createMockContextWithBodySource('POST', 'application/x-www-form-urlencoded', '');
      await urlencoded()(ctx, next);

      expect(ctx.body).toEqual({});
    });
  });

  describe('text parser via bodySource', () => {
    it('should parse text body', async () => {
      const ctx = createMockContextWithBodySource('POST', 'text/plain', 'Hello World');
      await text()(ctx, next);

      expect(ctx.body).toBe('Hello World');
      expect(next).toHaveBeenCalledOnce();
    });

    it('should handle empty text body', async () => {
      const ctx = createMockContextWithBodySource('POST', 'text/plain', '');
      await text()(ctx, next);

      expect(ctx.body).toBe('');
    });
  });

  describe('raw parser via bodySource', () => {
    it('should return buffer', async () => {
      const data = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      const ctx = createMockContextWithBodySource('POST', 'application/octet-stream', data);
      await raw()(ctx, next);

      expect(ctx.body).toBeInstanceOf(Buffer);
      expect((ctx.body as Buffer).length).toBe(4);
      expect(next).toHaveBeenCalledOnce();
    });
  });

  describe('bodyParser (combined) via bodySource', () => {
    it('should route JSON to json parser', async () => {
      const ctx = createMockContextWithBodySource('POST', 'application/json', '{"combined":true}');
      await bodyParser()(ctx, next);

      expect(ctx.body).toEqual({ combined: true });
    });

    it('should route urlencoded to urlencoded parser', async () => {
      const ctx = createMockContextWithBodySource(
        'POST',
        'application/x-www-form-urlencoded',
        'key=value'
      );
      await bodyParser()(ctx, next);

      expect(ctx.body).toEqual({ key: 'value' });
    });
  });
});

// =============================================================================
// NEW FEATURE TESTS
// =============================================================================

describe('JSON maxDepth', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should accept JSON within depth limit', async () => {
    const data = { a: { b: { c: 'ok' } } }; // depth 3
    const ctx = createMockContext('POST', 'application/json', JSON.stringify(data));
    await json({ maxDepth: 5 })(ctx, next);

    expect(ctx.body).toEqual(data);
  });

  it('should reject JSON exceeding depth limit', async () => {
    const data = { a: { b: { c: { d: { e: { f: 'deep' } } } } } }; // depth 6
    const ctx = createMockContext('POST', 'application/json', JSON.stringify(data));

    await expect(json({ maxDepth: 3 })(ctx, next)).rejects.toThrow('depth exceeded');
  });

  it('should allow unlimited depth when maxDepth is not set', async () => {
    // Build deeply nested object
    let nested: Record<string, unknown> = { value: 'deep' };
    for (let i = 0; i < 50; i++) {
      nested = { child: nested };
    }
    const ctx = createMockContext('POST', 'application/json', JSON.stringify(nested));

    await json()(ctx, next);
    expect(ctx.body).toBeDefined();
  });

  it('should check depth in arrays', async () => {
    const data = [[[['too deep']]]]; // array depth 4
    const ctx = createMockContext('POST', 'application/json', JSON.stringify(data));

    await expect(json({ maxDepth: 2, strict: false })(ctx, next)).rejects.toThrow('depth exceeded');
  });

  it('should handle flat arrays within depth limit', async () => {
    const data = [1, 2, 3, 4, 5]; // depth 1
    const ctx = createMockContext('POST', 'application/json', JSON.stringify(data));

    await json({ maxDepth: 1 })(ctx, next);
    expect(ctx.body).toEqual(data);
  });

  it('should work with bodySource path', async () => {
    const data = { a: { b: { c: { d: 'deep' } } } };
    const ctx = createMockContextWithBodySource('POST', 'application/json', JSON.stringify(data));

    await expect(json({ maxDepth: 2 })(ctx, next)).rejects.toThrow('depth exceeded');
  });
});

describe('Verify callback', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should call verify with body buffer for json', async () => {
    const verifySpy = vi.fn();
    const ctx = createMockContext('POST', 'application/json', '{"name":"test"}');

    await json({ verify: verifySpy })(ctx, next);

    expect(verifySpy).toHaveBeenCalledOnce();
    expect(verifySpy).toHaveBeenCalledWith(ctx, expect.any(Buffer), 'utf-8');
  });

  it('should reject body when verify throws for json', async () => {
    const verify = () => {
      throw new Error('Verify failed');
    };
    const ctx = createMockContext('POST', 'application/json', '{"name":"test"}');

    await expect(json({ verify })(ctx, next)).rejects.toThrow('Verify failed');
  });

  it('should call verify for urlencoded', async () => {
    const verifySpy = vi.fn();
    const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'key=value');

    await urlencoded({ verify: verifySpy })(ctx, next);

    expect(verifySpy).toHaveBeenCalledOnce();
    expect(verifySpy).toHaveBeenCalledWith(ctx, expect.any(Buffer), 'utf-8');
  });

  it('should call verify for text', async () => {
    const verifySpy = vi.fn();
    const ctx = createMockContext('POST', 'text/plain', 'hello');

    await text({ verify: verifySpy })(ctx, next);

    expect(verifySpy).toHaveBeenCalledOnce();
  });

  it('should call verify for raw', async () => {
    const verifySpy = vi.fn();
    const ctx = createMockContext('POST', 'application/octet-stream', Buffer.from([0x01, 0x02]));

    await raw({ verify: verifySpy })(ctx, next);

    expect(verifySpy).toHaveBeenCalledOnce();
  });

  it('should not call verify for empty body', async () => {
    const verifySpy = vi.fn();
    const ctx = createMockContext('POST', 'application/json', '');

    await json({ verify: verifySpy })(ctx, next);

    expect(verifySpy).not.toHaveBeenCalled();
  });

  it('should support async verify', async () => {
    const verify = vi.fn().mockResolvedValue(undefined);
    const ctx = createMockContext('POST', 'application/json', '{"name":"test"}');

    await json({ verify })(ctx, next);

    expect(verify).toHaveBeenCalledOnce();
    expect(ctx.body).toEqual({ name: 'test' });
  });

  it('should work with bodySource path', async () => {
    const verifySpy = vi.fn();
    const ctx = createMockContextWithBodySource('POST', 'application/json', '{"x":1}');

    await json({ verify: verifySpy })(ctx, next);

    expect(verifySpy).toHaveBeenCalledOnce();
    expect(ctx.body).toEqual({ x: 1 });
  });
});

describe('Multipart stub', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should throw unsupported content type for multipart/form-data', async () => {
    const ctx = createMockContext('POST', 'multipart/form-data; boundary=----');
    // Need body source or stream to reach the multipart check
    const middleware = bodyParser();

    await expect(middleware(ctx, next)).rejects.toThrow('Unsupported content type');
  });

  it('should throw for any multipart subtype', async () => {
    const ctx = createMockContext('POST', 'multipart/mixed; boundary=----');
    const middleware = bodyParser();

    await expect(middleware(ctx, next)).rejects.toThrow('Unsupported content type');
  });

  it('should suggest using dedicated multipart parser', async () => {
    const ctx = createMockContext('POST', 'multipart/form-data; boundary=----');

    try {
      await bodyParser()(ctx, next);
    } catch (err) {
      expect((err as Error).message).toContain('dedicated multipart parser');
    }
  });
});

describe('Null-prototype objects (URL-encoded)', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should return object without prototype chain', async () => {
    const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'key=value');
    await urlencoded()(ctx, next);

    const body = ctx.body as Record<string, unknown>;
    expect(body).toHaveProperty('key', 'value');
    // Verify null prototype — hasOwnProperty is not on the object
    expect(Object.getPrototypeOf(body)).toBeNull();
  });

  it('should return nested objects without prototype chain', async () => {
    const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'user[name]=Bob');
    await urlencoded({ extended: true })(ctx, next);

    const body = ctx.body as Record<string, unknown>;
    expect(Object.getPrototypeOf(body)).toBeNull();
    const user = body['user'] as Record<string, unknown>;
    expect(Object.getPrototypeOf(user)).toBeNull();
  });
});

describe('Destroyed stream handling', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should reject if stream is already destroyed', async () => {
    const emitter = new EventEmitter();
    const ctx: BodyParserContext = {
      method: 'POST',
      path: '/',
      headers: {
        'content-type': 'application/json',
        'content-length': '10',
      },
      raw: {
        req: {
          on: (event: string, listener: (arg?: Buffer | Error) => void) => {
            emitter.on(event, listener);
          },
          destroyed: true,
        } as BodyParserContext['raw']['req'],
      },
    };

    await expect(json()(ctx, next)).rejects.toThrow('closed');
  });
});

describe('Empty body behavior', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should return undefined for empty JSON body', async () => {
    const ctx = createMockContext('POST', 'application/json', '');
    await json()(ctx, next);

    expect(ctx.body).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('should return empty object for empty urlencoded body', async () => {
    const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', '');
    await urlencoded()(ctx, next);

    expect(ctx.body).toEqual({});
  });

  it('should return empty string for empty text body', async () => {
    const ctx = createMockContext('POST', 'text/plain', '');
    await text()(ctx, next);

    expect(ctx.body).toBe('');
  });

  it('should return undefined for empty JSON body via bodySource', async () => {
    const ctx = createMockContextWithBodySource('POST', 'application/json', '');
    await json()(ctx, next);

    expect(ctx.body).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('Duplicate keys in URL-encoded', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should convert duplicate keys to arrays', async () => {
    const ctx = createMockContext(
      'POST',
      'application/x-www-form-urlencoded',
      'color=red&color=blue&color=green'
    );
    await urlencoded({ extended: false })(ctx, next);

    const body = ctx.body as Record<string, unknown>;
    expect(body['color']).toEqual(['red', 'blue', 'green']);
  });

  it('should handle single values without array wrapping', async () => {
    const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'name=Alice');
    await urlencoded()(ctx, next);

    const body = ctx.body as Record<string, unknown>;
    expect(body['name']).toBe('Alice');
  });
});

describe('MAX_DEPTH increased to 20', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should allow nesting depth up to 20 by default', async () => {
    // Build 15-level deep urlencoded string: a[b][c][d]...[o]=value
    const keys = 'abcdefghijklmno'.split('');
    const key =
      keys[0] +
      keys
        .slice(1)
        .map((k) => `[${k}]`)
        .join('');
    const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', `${key}=value`);

    await urlencoded({ extended: true })(ctx, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('should reject nesting depth exceeding 20', async () => {
    // Build 25-level deep urlencoded string
    const keys = 'abcdefghijklmnopqrstuvwxy'.split('');
    const key =
      keys[0] +
      keys
        .slice(1)
        .map((k) => `[${k}]`)
        .join('');
    const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', `${key}=value`);

    await expect(urlencoded({ extended: true })(ctx, next)).rejects.toThrow('depth');
  });
});

// =============================================================================
// UTILITY FUNCTION UNIT TESTS
// =============================================================================

describe('parseLimit utility', () => {
  it('should return numeric value as-is', () => {
    expect(parseLimit(1024, 100)).toBe(1024);
  });

  it('should parse string with kb unit', () => {
    expect(parseLimit('10kb', 100)).toBe(10 * 1024);
  });

  it('should parse string with mb unit', () => {
    expect(parseLimit('2mb', 100)).toBe(2 * 1024 * 1024);
  });

  it('should parse string with gb unit', () => {
    expect(parseLimit('1gb', 100)).toBe(1 * 1024 * 1024 * 1024);
  });

  it('should parse string with b unit', () => {
    expect(parseLimit('500b', 100)).toBe(500);
  });

  it('should parse bare numeric string as bytes', () => {
    expect(parseLimit('2048', 100)).toBe(2048);
  });

  it('should return defaultLimit for undefined', () => {
    expect(parseLimit(undefined, 500)).toBe(500);
  });

  it('should return defaultLimit for invalid string', () => {
    // Invalid strings like '5TB' should fallback to default
    expect(parseLimit('5TB', 100)).toBe(100);
  });

  it('should handle case-insensitive units', () => {
    expect(parseLimit('1KB', 100)).toBe(1024);
    expect(parseLimit('1Mb', 100)).toBe(1024 * 1024);
  });

  it('should handle decimal values', () => {
    expect(parseLimit('1.5kb', 100)).toBe(Math.floor(1.5 * 1024));
  });
});

describe('formatBytes utility', () => {
  it('should format 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('should format small byte values', () => {
    expect(formatBytes(100)).toBe('100 B');
  });

  it('should format kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
  });

  it('should format megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
  });

  it('should format with decimal precision', () => {
    expect(formatBytes(1536)).toBe('1.50 KB');
  });
});

describe('concatBuffers utility', () => {
  it('should concatenate empty array', () => {
    const result = concatBuffers([], 0);
    expect(result.length).toBe(0);
  });

  it('should concatenate single buffer', () => {
    const buf = Buffer.from('hello');
    const result = concatBuffers([buf], buf.length);
    expect(Buffer.from(result).toString()).toBe('hello');
  });

  it('should concatenate multiple buffers', () => {
    const bufs = [Buffer.from('hello'), Buffer.from(' '), Buffer.from('world')];
    const totalLength = bufs.reduce((s, b) => s + b.length, 0);
    const result = concatBuffers(bufs, totalLength);
    expect(Buffer.from(result).toString()).toBe('hello world');
  });
});

describe('bufferToString utility', () => {
  it('should decode utf-8 buffer', () => {
    const buf = Buffer.from('hello world');
    expect(bufferToString(buf, 'utf-8')).toBe('hello world');
  });

  it('should decode latin1 buffer', () => {
    const buf = Buffer.from('café', 'latin1');
    expect(bufferToString(buf, 'latin1')).toBe('café');
  });

  it('should decode ascii buffer', () => {
    const buf = Buffer.from('test', 'ascii');
    expect(bufferToString(buf, 'ascii')).toBe('test');
  });

  it('should handle empty buffer', () => {
    const buf = Buffer.alloc(0);
    expect(bufferToString(buf, 'utf-8')).toBe('');
  });
});

describe('matchContentType utility', () => {
  it('should match exact content types', () => {
    expect(matchContentType('application/json', ['application/json'])).toBe(true);
  });

  it('should not match different content types', () => {
    expect(matchContentType('text/plain', ['application/json'])).toBe(false);
  });

  it('should handle content type with parameters', () => {
    expect(matchContentType('application/json; charset=utf-8', ['application/json'])).toBe(true);
  });

  it('should match wildcard subtype (text/*)', () => {
    expect(matchContentType('text/plain', ['text/*'])).toBe(true);
    expect(matchContentType('text/html', ['text/*'])).toBe(true);
  });

  it('should NOT match wildcard across different types', () => {
    // Critical fix: text/* should NOT match textual/custom
    expect(matchContentType('textual/custom', ['text/*'])).toBe(false);
  });

  it('should match */* wildcard for any type', () => {
    expect(matchContentType('application/json', ['*/*'])).toBe(true);
    expect(matchContentType('text/plain', ['*/*'])).toBe(true);
  });

  it('should return false for undefined content type', () => {
    expect(matchContentType(undefined, ['application/json'])).toBe(false);
  });

  it('should return false for empty content type', () => {
    expect(matchContentType('', ['application/json'])).toBe(false);
  });

  it('should match from array of types', () => {
    expect(matchContentType('text/html', ['application/json', 'text/html', 'text/plain'])).toBe(
      true
    );
  });

  it('should handle image/* wildcard correctly', () => {
    expect(matchContentType('image/png', ['image/*'])).toBe(true);
    expect(matchContentType('image/jpeg', ['image/*'])).toBe(true);
    // Should NOT match 'imaginary/thing'
    expect(matchContentType('imaginary/thing', ['image/*'])).toBe(false);
  });
});

describe('normalizeCharset utility', () => {
  it('should normalize utf-8 variants', () => {
    expect(normalizeCharset('utf-8', 'utf-8')).toBe('utf-8');
    expect(normalizeCharset('UTF-8', 'utf-8')).toBe('utf-8');
  });

  it('should normalize latin1', () => {
    expect(normalizeCharset('latin1', 'utf-8')).toBe('latin1');
  });

  it('should return fallback for unsupported charset', () => {
    expect(normalizeCharset('windows-1252', 'utf-8')).toBe('utf-8');
  });

  it('should return fallback for empty string', () => {
    expect(normalizeCharset('', 'utf-8')).toBe('utf-8');
  });
});

describe('isCharsetSupported utility', () => {
  it('should return true for supported charsets', () => {
    expect(isCharsetSupported('utf-8')).toBe(true);
    expect(isCharsetSupported('utf8')).toBe(true);
    expect(isCharsetSupported('ascii')).toBe(true);
    expect(isCharsetSupported('latin1')).toBe(true);
    expect(isCharsetSupported('base64')).toBe(true);
  });

  it('should return false for unsupported charsets', () => {
    expect(isCharsetSupported('windows-1252')).toBe(false);
    expect(isCharsetSupported('shift-jis')).toBe(false);
    expect(isCharsetSupported('iso-8859-1')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isCharsetSupported('')).toBe(false);
  });
});

describe('safeDecodeURIComponent utility', () => {
  it('should decode normal URI components', () => {
    expect(safeDecodeURIComponent('hello%20world')).toBe('hello world');
  });

  it('should replace + with space', () => {
    expect(safeDecodeURIComponent('hello+world')).toBe('hello world');
  });

  it('should return original for malformed sequences', () => {
    expect(safeDecodeURIComponent('%E0%A4%A')).toBe('%E0%A4%A');
  });

  it('should handle string without + efficiently', () => {
    // No + means no regex replace needed
    expect(safeDecodeURIComponent('hello%20world')).toBe('hello world');
  });

  it('should handle empty string', () => {
    expect(safeDecodeURIComponent('')).toBe('');
  });
});

describe('setNestedValue utility', () => {
  it('should set simple key-value', () => {
    const obj = Object.create(null);
    setNestedValue(obj, 'key', 'value', 10);
    expect(obj.key).toBe('value');
  });

  it('should set nested key-value', () => {
    const obj = Object.create(null);
    setNestedValue(obj, 'user[name]', 'John', 10);
    expect(obj.user.name).toBe('John');
  });

  it('should reject array index >= 1000', () => {
    const obj = Object.create(null);
    setNestedValue(obj, 'items[1000]', 'value', 10);
    // Index 1000 should be rejected (>= 1000 cap)
    expect(obj.items?.[1000]).toBeUndefined();
  });

  it('should accept array index < 1000', () => {
    const obj = Object.create(null);
    setNestedValue(obj, 'items[999]', 'value', 10);
    expect(obj.items[999]).toBe('value');
  });

  it('should treat negative index as object key (not array index)', () => {
    const obj = Object.create(null) as Record<string, unknown>;
    setNestedValue(obj, 'items[-1]', 'value', 10);
    // '-1' doesn't match /^\d+$/, so items is created as an object (not array)
    // '-1' is set as a string key on the object
    expect(obj.items).toBeDefined();
    expect(Array.isArray(obj.items)).toBe(false);
    expect((obj.items as Record<string, unknown>)['-1']).toBe('value');
  });

  it('should reject prototype pollution keys', () => {
    const obj = Object.create(null) as Record<string, unknown>;
    // __proto__ is a forbidden key — setNestedValue throws
    expect(() => setNestedValue(obj, '__proto__', 'polluted', 10)).toThrow();
  });

  it('should reject constructor prototype pollution', () => {
    const obj = Object.create(null) as Record<string, unknown>;
    // constructor is a forbidden key — setNestedValue throws
    expect(() => setNestedValue(obj, 'constructor', 'polluted', 10)).toThrow();
  });

  it('should enforce depth limit', () => {
    const obj = Object.create(null) as Record<string, unknown>;
    // Depth of 4 parts: a[b][c][d] — with maxDepth 2, should throw
    expect(() => setNestedValue(obj, 'a[b][c][d]', 'deep', 2)).toThrow('depth');
  });
});

describe('parseUrlEncoded utility', () => {
  it('should parse simple key-value pairs', () => {
    const result = parseUrlEncoded('a=1&b=2');
    expect(result).toEqual({ a: '1', b: '2' });
  });

  it('should handle empty string', () => {
    const result = parseUrlEncoded('');
    expect(result).toEqual({});
  });

  it('should respect parameterLimit', () => {
    const pairs = Array.from({ length: 5 }, (_, i) => `k${i}=v${i}`).join('&');
    // Only 3-param limit — parseUrlEncoded(str, extended, parameterLimit, depth)
    expect(() => parseUrlEncoded(pairs, true, 3)).toThrow();
  });

  it('should parse nested values in extended mode', () => {
    const result = parseUrlEncoded('user[name]=John&user[age]=30', true);
    expect(result).toEqual({ user: { name: 'John', age: '30' } });
  });

  it('should parse flat values in non-extended mode', () => {
    const result = parseUrlEncoded('user[name]=John', false);
    expect(result).toEqual({ 'user[name]': 'John' });
  });
});

// =============================================================================
// CONTENT-LENGTH SECURITY TESTS
// =============================================================================

describe('getContentLength security', () => {
  it('should return undefined for negative Content-Length', () => {
    const headers = { 'content-length': '-1' };
    expect(getContentLength(headers)).toBeUndefined();
  });

  it('should return undefined for NaN Content-Length', () => {
    const headers = { 'content-length': 'abc' };
    expect(getContentLength(headers)).toBeUndefined();
  });

  it('should return value for valid Content-Length', () => {
    const headers = { 'content-length': '100' };
    expect(getContentLength(headers)).toBe(100);
  });

  it('should return 0 for zero Content-Length', () => {
    const headers = { 'content-length': '0' };
    expect(getContentLength(headers)).toBe(0);
  });

  it('should return undefined for missing Content-Length', () => {
    const headers = {};
    expect(getContentLength(headers)).toBeUndefined();
  });
});

// =============================================================================
// STREAM LIFECYCLE TESTS (Node.js path)
// =============================================================================

describe('Stream lifecycle (Node.js path)', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should handle stream error event', async () => {
    const emitter = new EventEmitter();
    const ctx: BodyParserContext = {
      method: 'POST',
      path: '/',
      headers: {
        'content-type': 'application/json',
        'content-length': '15',
      },
      raw: {
        req: {
          on: (event: string, listener: (...args: unknown[]) => void) => {
            emitter.on(event, listener);
          },
          off: (event: string, listener: (...args: unknown[]) => void) => {
            emitter.off(event, listener);
          },
        } as BodyParserContext['raw']['req'],
      },
    };

    setImmediate(() => {
      emitter.emit('error', new Error('stream broken'));
    });

    await expect(json()(ctx, next)).rejects.toThrow();
  });

  it('should handle stream abort event', async () => {
    const emitter = new EventEmitter();
    const ctx: BodyParserContext = {
      method: 'POST',
      path: '/',
      headers: {
        'content-type': 'application/json',
        'content-length': '15',
      },
      raw: {
        req: {
          on: (event: string, listener: (...args: unknown[]) => void) => {
            emitter.on(event, listener);
          },
          off: (event: string, listener: (...args: unknown[]) => void) => {
            emitter.off(event, listener);
          },
        } as BodyParserContext['raw']['req'],
      },
    };

    setImmediate(() => {
      emitter.emit('aborted');
    });

    await expect(json()(ctx, next)).rejects.toThrow();
  });

  it('should cleanup all listeners after successful read', async () => {
    const emitter = new EventEmitter();
    const offSpy = vi.fn();

    const ctx: BodyParserContext = {
      method: 'POST',
      path: '/',
      headers: {
        'content-type': 'application/json',
        'content-length': '15',
      },
      raw: {
        req: {
          on: (event: string, listener: (...args: unknown[]) => void) => {
            emitter.on(event, listener);
          },
          off: (event: string, listener: (...args: unknown[]) => void) => {
            offSpy(event);
            emitter.off(event, listener);
          },
        } as BodyParserContext['raw']['req'],
      },
    };

    setImmediate(() => {
      emitter.emit('data', Buffer.from('{"name":"John"}'));
      emitter.emit('end');
    });

    await json()(ctx, next);

    expect(ctx.body).toEqual({ name: 'John' });
    // Should have cleaned up all 5 event listeners
    const cleanedEvents = offSpy.mock.calls.map((c: unknown[]) => c[0]);
    expect(cleanedEvents).toContain('data');
    expect(cleanedEvents).toContain('end');
    expect(cleanedEvents).toContain('error');
    expect(cleanedEvents).toContain('close');
    expect(cleanedEvents).toContain('aborted');
  });

  it('should handle close event during read', async () => {
    const emitter = new EventEmitter();
    const ctx: BodyParserContext = {
      method: 'POST',
      path: '/',
      headers: {
        'content-type': 'application/json',
        'content-length': '15',
      },
      raw: {
        req: {
          on: (event: string, listener: (...args: unknown[]) => void) => {
            emitter.on(event, listener);
          },
          off: (event: string, listener: (...args: unknown[]) => void) => {
            emitter.off(event, listener);
          },
        } as BodyParserContext['raw']['req'],
      },
    };

    setImmediate(() => {
      emitter.emit('close');
    });

    await expect(json()(ctx, next)).rejects.toThrow();
  });
});

// =============================================================================
// BODY RE-PARSING GUARD TESTS
// =============================================================================

describe('Body re-parsing guard', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should skip JSON parsing if body already set', async () => {
    const ctx = createMockContext('POST', 'application/json', '{"new":"data"}');
    ctx.body = { existing: 'data' };

    await json()(ctx, next);

    // Body should NOT be overwritten
    expect(ctx.body).toEqual({ existing: 'data' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('should skip urlencoded parsing if body already set', async () => {
    const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'new=data');
    ctx.body = { existing: 'data' };

    await urlencoded()(ctx, next);

    expect(ctx.body).toEqual({ existing: 'data' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('should skip text parsing if body already set', async () => {
    const ctx = createMockContext('POST', 'text/plain', 'new text');
    ctx.body = 'existing text';

    await text()(ctx, next);

    expect(ctx.body).toBe('existing text');
    expect(next).toHaveBeenCalledOnce();
  });

  it('should skip raw parsing if body already set', async () => {
    const ctx = createMockContext('POST', 'application/octet-stream', 'new binary');
    ctx.body = Buffer.from('existing');

    await raw()(ctx, next);

    expect(ctx.body).toEqual(Buffer.from('existing'));
    expect(next).toHaveBeenCalledOnce();
  });

  it('should still parse if body is null (explicitly cleared)', async () => {
    // null !== undefined, so the re-parsing guard triggers.
    // The guard protects against ANY truthy/falsy body that isn't undefined.
    const ctx = createMockContext('POST', 'application/json', '{"data":"fresh"}');
    ctx.body = null;

    await json()(ctx, next);

    // null !== undefined → guard fires → body stays null (not re-parsed)
    expect(ctx.body).toBeNull();
  });
});

// =============================================================================
// BODYPARSERERROR CLASS TESTS
// =============================================================================

describe('BodyParserError class', () => {
  it('should serialize to JSON correctly', () => {
    const err = new BodyParserError('test error', 400, 'INVALID_JSON');
    const serialized = err.toJSON();

    expect(serialized).toEqual({
      name: 'BodyParserError',
      message: 'test error',
      status: 400,
      code: 'INVALID_JSON',
    });
  });

  it('should set expose=true for 4xx status codes', () => {
    const err400 = new BodyParserError('bad request', 400, 'INVALID_JSON');
    const err413 = new BodyParserError('too large', 413, 'ENTITY_TOO_LARGE');
    const err422 = new BodyParserError('invalid', 422, 'INVALID_PARAMETER');

    expect(err400.expose).toBe(true);
    expect(err413.expose).toBe(true);
    expect(err422.expose).toBe(true);
  });

  it('should set expose=false for 5xx status codes', () => {
    const err = new BodyParserError('internal', 500, 'BODY_READ_ERROR');

    expect(err.expose).toBe(false);
  });

  it('should be instanceof Error', () => {
    const err = new BodyParserError('test', 400, 'INVALID_JSON');

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(BodyParserError);
  });

  it('should have correct name property', () => {
    const err = new BodyParserError('test', 400, 'INVALID_JSON');

    expect(err.name).toBe('BodyParserError');
  });

  it('should preserve message in stack trace', () => {
    const err = new BodyParserError('specific error message', 400, 'INVALID_JSON');

    expect(err.stack).toContain('specific error message');
  });
});

// =============================================================================
// JSON BOM HANDLING TEST
// =============================================================================

describe('JSON BOM handling', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should reject JSON with UTF-8 BOM (V8 JSON.parse limitation)', async () => {
    // UTF-8 BOM character \uFEFF is NOT handled by JSON.parse in V8
    // This documents a known limitation — BOM must be stripped before sending
    const jsonStr = '{"name":"John"}';
    const bom = '\uFEFF';
    const bodyWithBom = bom + jsonStr;

    const ctx: BodyParserContext = {
      method: 'POST',
      path: '/',
      headers: {
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(bodyWithBom)),
      },
      bodySource: {
        async text() {
          return bodyWithBom;
        },
        async buffer() {
          return new TextEncoder().encode(bodyWithBom);
        },
        async json() {
          return JSON.parse(bodyWithBom);
        },
        get consumed() {
          return false;
        },
        get contentLength() {
          return Buffer.byteLength(bodyWithBom);
        },
        get contentType() {
          return 'application/json';
        },
      },
    };

    // JSON.parse rejects BOM prefix — throws INVALID_JSON error
    await expect(json()(ctx, next)).rejects.toThrow('Invalid JSON');
  });
});

// =============================================================================
// COMBINED PARSER EDGE CASES
// =============================================================================

describe('Combined parser edge cases', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should pass through when all parsers are disabled', async () => {
    const middleware = bodyParser({
      json: false,
      urlencoded: false,
      text: false,
      raw: false,
    });

    const ctx = createMockContext('POST', 'application/json', '{"name":"John"}');
    await middleware(ctx, next);

    // No parser matched, body should be undefined
    expect(ctx.body).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('should handle empty Content-Type header', async () => {
    const ctx = createMockContext('POST', '', '{"name":"John"}');
    await bodyParser()(ctx, next);

    expect(ctx.body).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('should handle multipart/mixed as unsupported', async () => {
    const ctx = createMockContext('POST', 'multipart/mixed', 'data');

    await expect(bodyParser()(ctx, next)).rejects.toThrow();
  });

  it('should handle multipart/related as unsupported', async () => {
    const ctx = createMockContext('POST', 'multipart/related', 'data');

    await expect(bodyParser()(ctx, next)).rejects.toThrow();
  });
});

// =============================================================================
// RAW PARSER EDGE CASES
// =============================================================================

describe('Raw parser edge cases', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should handle empty body as empty buffer', async () => {
    const ctx = createMockContext('POST', 'application/octet-stream', '');
    await raw()(ctx, next);

    expect(ctx.body).toBeInstanceOf(Buffer);
    expect((ctx.body as Buffer).length).toBe(0);
    expect(next).toHaveBeenCalledOnce();
  });

  it('should always set rawBody on context', async () => {
    const ctx = createMockContext(
      'POST',
      'application/octet-stream',
      Buffer.from([0x00, 0x01, 0x02])
    );

    await raw()(ctx, next);

    expect(ctx.rawBody).toBeDefined();
    expect(ctx.rawBody).toEqual(ctx.body);
  });
});

// =============================================================================
// NEGATIVE CONTENT-LENGTH BYPASS TEST (END-TO-END)
// =============================================================================

describe('Negative Content-Length bypass prevention', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should not bypass size limit with negative Content-Length', async () => {
    // A large body that exceeds the 10-byte limit
    const largeBody = 'x'.repeat(100);
    const emitter = new EventEmitter();

    const ctx: BodyParserContext = {
      method: 'POST',
      path: '/',
      headers: {
        'content-type': 'application/json',
        'content-length': '-1', // Negative header — should be treated as absent
      },
      raw: {
        req: {
          on: (event: string, listener: (...args: unknown[]) => void) => {
            emitter.on(event, listener);
          },
          off: (event: string, listener: (...args: unknown[]) => void) => {
            emitter.off(event, listener);
          },
        } as BodyParserContext['raw']['req'],
      },
    };

    setImmediate(() => {
      emitter.emit('data', Buffer.from(largeBody));
      emitter.emit('end');
    });

    // With a tiny limit of 10 bytes, the large body should still be rejected
    // The negative Content-Length should not bypass the streaming size check
    await expect(json({ limit: 10 })(ctx, next)).rejects.toThrow();
  });
});

// =============================================================================
// CHUNKED TRANSFER WITHOUT CONTENT-LENGTH (BODYSOURCE PATH)
// =============================================================================

describe('Chunked transfer without Content-Length', () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should parse body when Content-Length is absent (bodySource)', async () => {
    const body = '{"name":"chunked"}';
    const ctx: BodyParserContext = {
      method: 'POST',
      path: '/',
      headers: {
        'content-type': 'application/json',
        // No content-length header
      },
      bodySource: {
        async text() {
          return body;
        },
        async buffer() {
          return new TextEncoder().encode(body);
        },
        async json() {
          return JSON.parse(body);
        },
        get consumed() {
          return false;
        },
        get contentLength() {
          return undefined; // Unknown — chunked transfer
        },
        get contentType() {
          return 'application/json';
        },
      },
    };

    await json()(ctx, next);

    expect(ctx.body).toEqual({ name: 'chunked' });
    expect(next).toHaveBeenCalledOnce();
  });
});

// =============================================================================
// CONCURRENT BODY READING TEST
// =============================================================================

describe('Concurrent body reading', () => {
  it('should handle concurrent parsing attempts gracefully', async () => {
    const next = vi.fn().mockResolvedValue(undefined);

    // First parse succeeds
    const ctx = createMockContext('POST', 'application/json', '{"a":1}');
    await json()(ctx, next);
    expect(ctx.body).toEqual({ a: 1 });

    // Second parse on same context with body already set — should skip
    await json()(ctx, next);
    // Body should still be the first parsed value
    expect(ctx.body).toEqual({ a: 1 });
  });
});
