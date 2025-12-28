import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    bodyParser,
    BodyParserError,
    json,
    raw,
    text,
    urlencoded,
    type BodyParserContext,
} from '../index';

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

      expect(ctx.body).toEqual({});
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
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'name=John&age=30');
      await urlencoded()(ctx, next);

      expect(ctx.body).toEqual({ name: 'John', age: '30' });
    });

    it('should handle empty body', async () => {
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', '');
      await urlencoded()(ctx, next);

      expect(ctx.body).toEqual({});
    });

    it('should decode URL-encoded values', async () => {
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'message=Hello%20World');
      await urlencoded()(ctx, next);

      expect(ctx.body).toEqual({ message: 'Hello World' });
    });

    it('should handle + as space', async () => {
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'message=Hello+World');
      await urlencoded()(ctx, next);

      expect(ctx.body).toEqual({ message: 'Hello World' });
    });

    it('should handle special characters', async () => {
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'email=test%40example.com');
      await urlencoded()(ctx, next);

      expect(ctx.body).toEqual({ email: 'test@example.com' });
    });
  });

  describe('array handling', () => {
    it('should handle duplicate keys as arrays', async () => {
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'color=red&color=blue');
      await urlencoded()(ctx, next);

      expect(ctx.body).toEqual({ color: ['red', 'blue'] });
    });
  });

  describe('extended mode', () => {
    it('should parse nested objects when extended=true', async () => {
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'user[name]=John&user[age]=30');
      await urlencoded({ extended: true })(ctx, next);

      expect(ctx.body).toEqual({ user: { name: 'John', age: '30' } });
    });

    it('should parse arrays when extended=true', async () => {
      const ctx = createMockContext('POST', 'application/x-www-form-urlencoded', 'items[0]=a&items[1]=b');
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

      await expect(urlencoded({ parameterLimit: 5 })(ctx, next)).rejects.toThrow('Too many parameters');
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
    const ctx = createMockContext('POST', 'image/png', Buffer.from([0x89, 0x50, 0x4E, 0x47]));
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

    const [, ] = await Promise.all([
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

      await expect(urlencoded({ extended: true })(ctx, next)).rejects.toThrow(
        BodyParserError
      );
    });

    it('should reject constructor key', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        'constructor[prototype][polluted]=true'
      );

      await expect(urlencoded({ extended: true })(ctx, next)).rejects.toThrow(
        BodyParserError
      );
    });

    it('should reject prototype key', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        'prototype[polluted]=true'
      );

      await expect(urlencoded({ extended: true })(ctx, next)).rejects.toThrow(
        BodyParserError
      );
    });

    it('should reject deeply nested __proto__', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        'a[b][__proto__][polluted]=true'
      );

      await expect(urlencoded({ extended: true })(ctx, next)).rejects.toThrow(
        BodyParserError
      );
    });

    it('should reject URL-encoded __proto__', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        '__proto__%5Bpolluted%5D=true'
      );

      await expect(urlencoded({ extended: true })(ctx, next)).rejects.toThrow(
        BodyParserError
      );
    });

    it('should have INVALID_PARAMETER error code for prototype pollution', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        '__proto__[x]=y'
      );

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
      const ctx = createMockContext(
        'POST',
        'application/json',
        '{"__proto__":{"polluted":true}}'
      );

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

      await expect(json({ limit: 1000 })(ctx, next)).rejects.toThrow(
        BodyParserError
      );
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

      await expect(json({ limit: 1000 })(ctx, next)).rejects.toThrow(
        'Request body too large'
      );
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
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        params
      );

      await expect(urlencoded({ parameterLimit: 1000 })(ctx, next)).rejects.toThrow(
        BodyParserError
      );
    });

    it('should have TOO_MANY_PARAMETERS error code', async () => {
      const params = 'a=1&b=2&c=3&d=4&e=5&f=6';
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        params
      );

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
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        'a[b][c][d][e]=v'
      );

      try {
        await urlencoded({ extended: true, depth: 2 })(ctx, next);
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as BodyParserError).code).toBe('DEPTH_EXCEEDED');
        expect((err as BodyParserError).status).toBe(400);
      }
    });

    it('should allow nesting within depth limit', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        'a[b][c]=value'
      );

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
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        'name=%ZZ'
      );

      // Should not throw, should return original string
      await urlencoded()(ctx, next);
      expect(ctx.body).toBeDefined();
    });

    it('should handle incomplete percent encoding', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        'name=test%2'
      );

      await urlencoded()(ctx, next);
      expect(ctx.body).toBeDefined();
    });

    it('should handle empty keys gracefully', async () => {
      const ctx = createMockContext(
        'POST',
        'application/x-www-form-urlencoded',
        '=value'
      );

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
    const ctx = createMockContext(
      'POST',
      'application/json; charset=utf-8',
      '{"emoji":"🚀"}'
    );

    await json()(ctx, next);
    expect((ctx.body as Record<string, string>).emoji).toBe('🚀');
  });

  it('should parse UTF-8 (uppercase)', async () => {
    const ctx = createMockContext(
      'POST',
      'application/json; charset=UTF-8',
      '{"name":"Test"}'
    );

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
    const ctx = createMockContext(
      'POST',
      'text/plain; charset=ascii',
      'Hello World'
    );

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
    const ctx = createMockContext(
      'POST',
      'application/json',
      '{"name":"日本語","emoji":"🎉"}'
    );

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
    const ctx = createMockContext(
      'POST',
      'application/json',
      '{"text":"line1\\nline2"}'
    );

    await json()(ctx, next);
    expect((ctx.body as Record<string, string>).text).toBe('line1\nline2');
  });

  it('should handle tabs in JSON strings', async () => {
    const ctx = createMockContext(
      'POST',
      'application/json',
      '{"text":"col1\\tcol2"}'
    );

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
    const ctx = createMockContext(
      'POST',
      'application/vnd.api+json',
      '{"data":[]}'
    );

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
    const ctx = createMockContext(
      'POST',
      'APPLICATION/JSON',
      '{"upper":true}'
    );

    await json()(ctx, next);
    expect(ctx.body).toEqual({ upper: true });
  });

  it('should not match partial type', async () => {
    const ctx = createMockContext(
      'POST',
      'application/jsonx',
      '{"test":true}'
    );

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
    const ctx = createMockContext(
      'POST',
      'application/x-www-form-urlencoded',
      'from=urlencoded'
    );
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
    const ctx = createMockContext(
      'POST',
      'application/vnd.custom+json',
      '{"custom":true}'
    );

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
    const ctx = createMockContext(
      'POST',
      'application/x-www-form-urlencoded',
      body
    );

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
    const ctx = createMockContext(
      'POST',
      'application/json',
      JSON.stringify(largeArray)
    );

    await json({ limit: '10mb' })(ctx, next);
    expect((ctx.body as unknown[]).length).toBe(1000);
  });

  it('should handle many URL-encoded params within limit', async () => {
    const params = Array.from({ length: 500 }, (_, i) => `key${i}=value${i}`).join('&');
    const ctx = createMockContext(
      'POST',
      'application/x-www-form-urlencoded',
      params
    );

    await urlencoded({ parameterLimit: 1000 })(ctx, next);
    expect(Object.keys(ctx.body as object).length).toBe(500);
  });

  it('should handle deeply nested JSON', async () => {
    const nested = { a: { b: { c: { d: { e: { f: 'deep' } } } } } };
    const ctx = createMockContext(
      'POST',
      'application/json',
      JSON.stringify(nested)
    );

    await json()(ctx, next);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((ctx.body as any).a.b.c.d.e.f).toBe('deep');
  });
});
