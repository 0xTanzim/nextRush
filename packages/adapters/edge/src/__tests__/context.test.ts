/**
 * @nextrush/adapter-edge - Context Tests
 *
 * Tests for EdgeContext using Web API Request/Response.
 * Edge runtimes (Cloudflare Workers, Vercel Edge, Netlify Edge) all use
 * standard Web APIs, so we can test with Node.js/vitest.
 */

import { HttpError } from '@nextrush/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EdgeContext, createEdgeContext, type EdgeExecutionContext } from '../context';

/**
 * Create a mock Web Request
 */
function createMockRequest(url: string = 'http://localhost/', init?: RequestInit): Request {
  return new Request(url, init);
}

/**
 * Create a mock execution context (like Cloudflare Workers)
 */
function createMockExecutionContext(): EdgeExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  };
}

describe('EdgeContext', () => {
  let request: Request;
  let ctx: EdgeContext;

  beforeEach(() => {
    request = createMockRequest('http://localhost/');
    ctx = new EdgeContext(request);
  });

  describe('constructor', () => {
    it('should create context with default values', () => {
      expect(ctx.method).toBe('GET');
      expect(ctx.path).toBe('/');
      expect(ctx.status).toBe(200);
      expect(ctx.params).toEqual({});
      expect(ctx.body).toBeUndefined();
      expect(ctx.runtime).toBe('edge');
    });

    it('should parse URL path', () => {
      request = createMockRequest('http://localhost/users/123');
      ctx = new EdgeContext(request);

      expect(ctx.path).toBe('/users/123');
      expect(ctx.url).toBe('/users/123');
    });

    it('should parse query string', () => {
      request = createMockRequest('http://localhost/search?q=test&limit=10');
      ctx = new EdgeContext(request);

      expect(ctx.path).toBe('/search');
      expect(ctx.query).toEqual({ q: 'test', limit: '10' });
    });

    it('should handle URL without query string', () => {
      request = createMockRequest('http://localhost/users');
      ctx = new EdgeContext(request);

      expect(ctx.path).toBe('/users');
      expect(ctx.query).toEqual({});
    });

    it('should get HTTP method', () => {
      request = createMockRequest('http://localhost/', { method: 'POST' });
      ctx = new EdgeContext(request);

      expect(ctx.method).toBe('POST');
    });

    it('should uppercase method', () => {
      request = createMockRequest('http://localhost/', { method: 'post' });
      ctx = new EdgeContext(request);

      expect(ctx.method).toBe('POST');
    });

    it('should extract headers', () => {
      request = createMockRequest('http://localhost/', {
        headers: { 'Content-Type': 'application/json', 'X-Custom': 'value' },
      });
      ctx = new EdgeContext(request);

      expect(ctx.headers['content-type']).toBe('application/json');
      expect(ctx.headers['x-custom']).toBe('value');
    });

    it('should extract IP from cf-connecting-ip header (Cloudflare)', () => {
      request = createMockRequest('http://localhost/', {
        headers: { 'cf-connecting-ip': '192.168.1.100' },
      });
      ctx = new EdgeContext(request);

      expect(ctx.ip).toBe('192.168.1.100');
    });

    it('should extract IP from x-forwarded-for header', () => {
      request = createMockRequest('http://localhost/', {
        headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' },
      });
      ctx = new EdgeContext(request);

      expect(ctx.ip).toBe('10.0.0.1');
    });

    it('should extract IP from x-real-ip header', () => {
      request = createMockRequest('http://localhost/', {
        headers: { 'x-real-ip': '172.16.0.1' },
      });
      ctx = new EdgeContext(request);

      expect(ctx.ip).toBe('172.16.0.1');
    });

    it('should store execution context', () => {
      const execCtx = createMockExecutionContext();
      ctx = new EdgeContext(request, execCtx);

      expect(ctx.executionContext).toBe(execCtx);
    });
  });

  describe('json()', () => {
    it('should build JSON response', () => {
      ctx.json({ message: 'hello' });

      const response = ctx.getResponse();
      expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
      expect(response.status).toBe(200);
    });

    it('should set status code', () => {
      ctx.status = 201;
      ctx.json({ created: true });

      const response = ctx.getResponse();
      expect(response.status).toBe(201);
    });

    it('should not send response twice', () => {
      ctx.json({ first: true });
      ctx.json({ second: true });

      expect(ctx.responded).toBe(true);
    });

    it('should serialize data correctly', async () => {
      ctx.json({ users: [1, 2, 3] });

      const response = ctx.getResponse();
      const body = await response.json();
      expect(body).toEqual({ users: [1, 2, 3] });
    });
  });

  describe('send()', () => {
    it('should send string response', async () => {
      ctx.send('Hello World');

      const response = ctx.getResponse();
      expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');

      const text = await response.text();
      expect(text).toBe('Hello World');
    });

    it('should send Uint8Array response', () => {
      const buffer = new Uint8Array([72, 101, 108, 108, 111]);
      ctx.send(buffer);

      const response = ctx.getResponse();
      expect(response.headers.get('Content-Type')).toBe('application/octet-stream');
    });

    it('should handle null response', async () => {
      ctx.send(null);

      const response = ctx.getResponse();
      const text = await response.text();
      expect(text).toBe('');
    });

    it('should handle undefined response', async () => {
      ctx.send(undefined);

      const response = ctx.getResponse();
      const text = await response.text();
      expect(text).toBe('');
    });

    it('should send object as JSON', async () => {
      ctx.send({ data: 'test' });

      const response = ctx.getResponse();
      const body = await response.json();
      expect(body).toEqual({ data: 'test' });
    });
  });

  describe('html()', () => {
    it('should send HTML response', async () => {
      ctx.html('<h1>Hello</h1>');

      const response = ctx.getResponse();
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');

      const text = await response.text();
      expect(text).toBe('<h1>Hello</h1>');
    });
  });

  describe('redirect()', () => {
    it('should redirect with default 302 status', () => {
      ctx.redirect('/login');

      const response = ctx.getResponse();
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/login');
    });

    it('should redirect with custom status', () => {
      ctx.redirect('/new-page', 301);

      const response = ctx.getResponse();
      expect(response.status).toBe(301);
    });
  });

  describe('set()', () => {
    it('should set response header', () => {
      ctx.set('X-Custom', 'value');

      const response = ctx.getResponse();
      expect(response.headers.get('X-Custom')).toBe('value');
    });

    it('should set numeric header value', () => {
      ctx.set('X-Count', 100);

      const response = ctx.getResponse();
      expect(response.headers.get('X-Count')).toBe('100');
    });
  });

  describe('get()', () => {
    it('should get request header', () => {
      request = createMockRequest('http://localhost/', {
        headers: { 'content-type': 'application/json' },
      });
      ctx = new EdgeContext(request);

      expect(ctx.get('content-type')).toBe('application/json');
    });

    it('should be case-insensitive', () => {
      request = createMockRequest('http://localhost/', {
        headers: { 'Content-Type': 'application/json' },
      });
      ctx = new EdgeContext(request);

      expect(ctx.get('content-type')).toBe('application/json');
    });

    it('should return undefined for missing header', () => {
      expect(ctx.get('x-missing')).toBeUndefined();
    });
  });

  describe('next()', () => {
    it('should call next function when set', async () => {
      const nextFn = vi.fn().mockResolvedValue(undefined);
      ctx.setNext(nextFn);

      await ctx.next();

      expect(nextFn).toHaveBeenCalled();
    });

    it('should not throw when next is not set', async () => {
      await expect(ctx.next()).resolves.toBeUndefined();
    });
  });

  describe('state', () => {
    it('should allow storing state', () => {
      ctx.state.user = { id: 1, name: 'John' };

      expect(ctx.state.user).toEqual({ id: 1, name: 'John' });
    });
  });

  describe('raw', () => {
    it('should provide access to raw request', () => {
      expect(ctx.raw.req).toBe(request);
      expect(ctx.raw.res).toBeUndefined();
    });
  });

  describe('responded', () => {
    it('should be false initially', () => {
      expect(ctx.responded).toBe(false);
    });

    it('should be true after json()', () => {
      ctx.json({});
      expect(ctx.responded).toBe(true);
    });

    it('should be true after send()', () => {
      ctx.send('test');
      expect(ctx.responded).toBe(true);
    });

    it('should be true after html()', () => {
      ctx.html('<p>test</p>');
      expect(ctx.responded).toBe(true);
    });

    it('should be true after redirect()', () => {
      ctx.redirect('/');
      expect(ctx.responded).toBe(true);
    });

    it('should be true after markResponded()', () => {
      ctx.markResponded();
      expect(ctx.responded).toBe(true);
    });
  });

  describe('getResponse()', () => {
    it('should return Response object', () => {
      ctx.json({ test: true });

      const response = ctx.getResponse();
      expect(response).toBeInstanceOf(Response);
    });

    it('should sync status from context', () => {
      ctx.status = 404;

      const response = ctx.getResponse();
      expect(response.status).toBe(404);
    });
  });

  describe('waitUntil()', () => {
    it('should call execution context waitUntil', () => {
      const execCtx = createMockExecutionContext();
      ctx = new EdgeContext(request, execCtx);

      const promise = Promise.resolve();
      ctx.waitUntil(promise);

      expect(execCtx.waitUntil).toHaveBeenCalledWith(promise);
    });

    it('should not throw when execution context is not available', () => {
      ctx = new EdgeContext(request);
      const promise = Promise.resolve();

      expect(() => ctx.waitUntil(promise)).not.toThrow();
    });
  });
});

describe('HttpError', () => {
  it('should create error with status and message', () => {
    const error = new HttpError(404, 'User not found');

    expect(error.message).toBe('User not found');
    expect(error.status).toBe(404);
    expect(error.name).toBe('HttpError');
  });

  it('should use default message for status', () => {
    const error = new HttpError(401);

    expect(error.message).toBe('Unauthorized');
    expect(error.status).toBe(401);
  });

  it('should set expose=true for client errors (4xx)', () => {
    const error = new HttpError(400);
    expect(error.expose).toBe(true);

    const notFound = new HttpError(404);
    expect(notFound.expose).toBe(true);
  });

  it('should set expose=false for server errors (5xx)', () => {
    const error = new HttpError(500);
    expect(error.expose).toBe(false);

    const unavailable = new HttpError(503);
    expect(unavailable.expose).toBe(false);
  });
});

describe('throw()', () => {
  let ctx: EdgeContext;

  beforeEach(() => {
    ctx = new EdgeContext(createMockRequest());
  });

  it('should throw HttpError with status and message', () => {
    expect(() => ctx.throw(404, 'User not found')).toThrow('User not found');
  });

  it('should throw HttpError with default message', () => {
    try {
      ctx.throw(401);
    } catch (error) {
      expect((error as Error).message).toBe('Unauthorized');
      expect((error as HttpError).status).toBe(401);
    }
  });

  it('should throw correct status codes', () => {
    const codes = [400, 401, 403, 404, 500, 502, 503];

    for (const code of codes) {
      try {
        ctx.throw(code);
      } catch (error) {
        expect((error as HttpError).status).toBe(code);
      }
    }
  });
});

describe('assert()', () => {
  let ctx: EdgeContext;

  beforeEach(() => {
    ctx = new EdgeContext(createMockRequest());
  });

  it('should not throw when condition is truthy', () => {
    expect(() => ctx.assert(true, 400)).not.toThrow();
    expect(() => ctx.assert(1, 400)).not.toThrow();
    expect(() => ctx.assert('value', 400)).not.toThrow();
    expect(() => ctx.assert({}, 400)).not.toThrow();
  });

  it('should throw when condition is false', () => {
    expect(() => ctx.assert(false, 400, 'Validation failed')).toThrow('Validation failed');
  });

  it('should throw when condition is null', () => {
    expect(() => ctx.assert(null, 404, 'Not found')).toThrow('Not found');
  });

  it('should throw when condition is undefined', () => {
    expect(() => ctx.assert(undefined, 404, 'Not found')).toThrow('Not found');
  });

  it('should use default message when not provided', () => {
    try {
      ctx.assert(false, 400);
    } catch (error) {
      expect((error as Error).message).toBe('Bad Request');
    }
  });

  it('should narrow type with asserts', () => {
    const maybeUser: { name: string } | null = { name: 'John' };
    ctx.assert(maybeUser, 404, 'User not found');
    expect(maybeUser.name).toBe('John');
  });
});

describe('createEdgeContext', () => {
  it('should create EdgeContext instance', () => {
    const request = createMockRequest();
    const ctx = createEdgeContext(request);

    expect(ctx).toBeInstanceOf(EdgeContext);
  });

  it('should pass execution context', () => {
    const request = createMockRequest();
    const execCtx = createMockExecutionContext();
    const ctx = createEdgeContext(request, execCtx);

    expect(ctx.executionContext).toBe(execCtx);
  });
});
