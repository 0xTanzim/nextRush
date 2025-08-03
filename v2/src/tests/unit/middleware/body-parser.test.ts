/**
 * Body Parser Middleware Tests
 *
 * Tests for JSON, URL-encoded, raw, and text body parsing
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bodyParserUtils,
  json,
  raw,
  text,
  urlencoded,
} from '../../../core/middleware/body-parser';
import type { Context } from '../../../types/context';

function createMockContext(overrides: Partial<Context> = {}): Context {
  return {
    req: {
      headers: {},
      method: 'POST',
      url: '/test',
      body: undefined,
      on: vi.fn(),
      pipe: vi.fn(),
    } as any,
    res: {
      statusCode: 200,
      headers: {},
      setHeader: vi.fn(),
      getHeader: vi.fn(),
      end: vi.fn(),
      write: vi.fn(),
    } as any,
    method: 'POST',
    path: '/test',
    query: {},
    params: {},
    body: undefined,
    status: 200,
    json: vi.fn(),
    ...overrides,
  };
}

describe('Body Parser Middleware', () => {
  let ctx: Context;
  let next: () => Promise<void>;

  beforeEach(() => {
    ctx = createMockContext();
    next = async () => {};
  });

  describe('JSON Parser', () => {
    it('should parse JSON body', async () => {
      const middleware = json();
      const jsonData = { name: 'John', age: 30 };

      ctx.req.headers['content-type'] = 'application/json';
      ctx.req.body = JSON.stringify(jsonData);

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.body).toEqual(jsonData);
    });

    it('should handle malformed JSON', async () => {
      const middleware = json();

      ctx.req.headers['content-type'] = 'application/json';
      ctx.req.body = '{ invalid json }';

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.status).toBe(400);
      expect(ctx.body).toBeUndefined();
    });

    it('should respect size limit', async () => {
      const middleware = json({ limit: '10b' });
      const largeData = 'a'.repeat(20);

      ctx.req.headers['content-type'] = 'application/json';
      ctx.req.body = JSON.stringify({ data: largeData });

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.body).toBeUndefined();
    });

    it('should handle custom content type', async () => {
      const middleware = json({ type: 'application/custom+json' });

      ctx.req.headers['content-type'] = 'application/custom+json';
      ctx.req.body = JSON.stringify({ test: true });

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.body).toEqual({ test: true });
    });

    it('should skip non-matching content type', async () => {
      const middleware = json();

      ctx.req.headers['content-type'] = 'text/plain';
      ctx.req.body = 'not json';

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.body).toBeUndefined();
    });
  });

  describe('URL-encoded Parser', () => {
    it('should parse URL-encoded body', async () => {
      const middleware = urlencoded();
      const formData = 'name=John&age=30';

      ctx.req.headers['content-type'] = 'application/x-www-form-urlencoded';
      ctx.req.body = formData;

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.body).toEqual({ name: 'John', age: '30' });
    });

    it('should handle extended mode', async () => {
      const middleware = urlencoded({ extended: true });
      const formData = 'user[name]=John&user[age]=30';

      ctx.req.headers['content-type'] = 'application/x-www-form-urlencoded';
      ctx.req.body = formData;

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.body).toEqual({ user: { name: 'John', age: '30' } });
    });

    it('should respect parameter limit', async () => {
      const middleware = urlencoded({ parameterLimit: 2 });
      const formData = 'a=1&b=2&c=3';

      ctx.req.headers['content-type'] = 'application/x-www-form-urlencoded';
      ctx.req.body = formData;

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.body).toEqual({ a: '1', b: '2' });
    });

    it('should handle size limit', async () => {
      const middleware = urlencoded({ limit: '10b' });
      const largeData = 'a=1&b=2&c=3&d=4&e=5';

      ctx.req.headers['content-type'] = 'application/x-www-form-urlencoded';
      ctx.req.body = largeData;

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.body).toBeUndefined();
    });
  });

  describe('Raw Parser', () => {
    it('should parse raw body as buffer', async () => {
      const middleware = raw();
      const rawData = Buffer.from('Hello World');

      ctx.req.headers['content-type'] = 'application/octet-stream';
      ctx.req.body = rawData;

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.body).toBeInstanceOf(Buffer);
      expect(ctx.body.toString()).toBe('Hello World');
    });

    it('should handle custom content type', async () => {
      const middleware = raw({ type: 'application/custom' });

      ctx.req.headers['content-type'] = 'application/custom';
      ctx.req.body = Buffer.from('custom data');

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.body).toBeInstanceOf(Buffer);
    });

    it('should respect size limit', async () => {
      const middleware = raw({ limit: '10b' });
      const largeData = Buffer.alloc(20);

      ctx.req.headers['content-type'] = 'application/octet-stream';
      ctx.req.body = largeData;

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.body).toBeUndefined();
    });
  });

  describe('Text Parser', () => {
    it('should parse text body', async () => {
      const middleware = text();
      const textData = 'Hello World';

      ctx.req.headers['content-type'] = 'text/plain';
      ctx.req.body = textData;

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.body).toBe(textData);
    });

    it('should handle custom content type', async () => {
      const middleware = text({ type: 'text/custom' });

      ctx.req.headers['content-type'] = 'text/custom';
      ctx.req.body = 'custom text';

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.body).toBe('custom text');
    });

    it('should respect size limit', async () => {
      const middleware = text({ limit: '10b' });
      const largeText = 'a'.repeat(20);

      ctx.req.headers['content-type'] = 'text/plain';
      ctx.req.body = largeText;

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.body).toBeUndefined();
    });
  });

  describe('Body Parser Utilities', () => {
    it('should parse size strings correctly', () => {
      expect(bodyParserUtils.parseSize('1kb')).toBe(1024);
      expect(bodyParserUtils.parseSize('1mb')).toBe(1024 * 1024);
      expect(bodyParserUtils.parseSize('1gb')).toBe(1024 * 1024 * 1024);
      expect(bodyParserUtils.parseSize('100')).toBe(100);
    });

    it('should handle invalid size strings', () => {
      expect(bodyParserUtils.parseSize('invalid')).toBe(0);
      expect(bodyParserUtils.parseSize('')).toBe(0);
    });

    it('should parse JSON body correctly', async () => {
      const jsonString = JSON.stringify({ test: true });
      const result = await bodyParserUtils.parseJsonBody(
        { body: jsonString } as any,
        1024
      );
      expect(result).toEqual({ test: true });
    });

    it('should parse URL-encoded body correctly', async () => {
      const formData = 'name=John&age=30';
      const result = await bodyParserUtils.parseUrlencodedBody(
        { body: formData } as any,
        1024,
        false
      );
      expect(result).toEqual({ name: 'John', age: '30' });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing content-type', async () => {
      const middleware = json();

      ctx.req.body = JSON.stringify({ test: true });

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.body).toBeUndefined();
    });

    it('should handle empty body', async () => {
      const middleware = json();

      ctx.req.headers['content-type'] = 'application/json';
      ctx.req.body = '';

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.body).toBeUndefined();
    });

    it('should handle null body', async () => {
      const middleware = json();

      ctx.req.headers['content-type'] = 'application/json';
      ctx.req.body = null;

      await middleware(ctx, () => Promise.resolve());

      expect(ctx.body).toBeUndefined();
    });
  });

  describe('Performance', () => {
    it('should handle large JSON payloads efficiently', async () => {
      const middleware = json({ limit: '1mb' });
      const largeData = { data: 'a'.repeat(10000) };

      ctx.req.headers['content-type'] = 'application/json';
      ctx.req.body = JSON.stringify(largeData);

      const start = Date.now();
      await middleware(ctx, () => Promise.resolve());
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should complete within 100ms
      expect(ctx.body).toEqual(largeData);
    });

    it('should handle multiple middleware efficiently', async () => {
      const jsonMiddleware = json();
      const urlencodedMiddleware = urlencoded();

      ctx.req.headers['content-type'] = 'application/json';
      ctx.req.body = JSON.stringify({ test: true });

      const start = Date.now();
      await jsonMiddleware(ctx, next);
      await urlencodedMiddleware(ctx, next);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50); // Should complete within 50ms
    });
  });
});
