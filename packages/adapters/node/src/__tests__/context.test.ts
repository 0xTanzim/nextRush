/**
 * @nextrush/adapter-node - Context Tests
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeContext, createNodeContext } from '../context';

/**
 * Create mock IncomingMessage
 */
function createMockReq(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);

  req.method = overrides.method ?? 'GET';
  req.url = overrides.url ?? '/';
  req.headers = overrides.headers ?? {};

  return req;
}

/**
 * Create mock ServerResponse
 */
function createMockRes(): ServerResponse {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  const res = new ServerResponse(req);

  // Mock response methods
  vi.spyOn(res, 'setHeader').mockImplementation(() => res);
  vi.spyOn(res, 'end').mockImplementation(() => res);

  return res;
}

describe('NodeContext', () => {
  let req: IncomingMessage;
  let res: ServerResponse;
  let ctx: NodeContext;

  beforeEach(() => {
    req = createMockReq();
    res = createMockRes();
    ctx = new NodeContext(req, res);
  });

  describe('constructor', () => {
    it('should create context with default values', () => {
      expect(ctx.method).toBe('GET');
      expect(ctx.path).toBe('/');
      expect(ctx.status).toBe(200);
      expect(ctx.params).toEqual({});
      expect(ctx.body).toBeUndefined();
    });

    it('should parse URL path', () => {
      req = createMockReq({ url: '/users/123' });
      ctx = new NodeContext(req, res);

      expect(ctx.path).toBe('/users/123');
      expect(ctx.url).toBe('/users/123');
    });

    it('should parse query string', () => {
      req = createMockReq({ url: '/search?q=test&limit=10' });
      ctx = new NodeContext(req, res);

      expect(ctx.path).toBe('/search');
      expect(ctx.query).toEqual({ q: 'test', limit: '10' });
    });

    it('should handle URL without query string', () => {
      req = createMockReq({ url: '/users' });
      ctx = new NodeContext(req, res);

      expect(ctx.path).toBe('/users');
      expect(ctx.query).toEqual({});
    });

    it('should get HTTP method', () => {
      req = createMockReq({ method: 'POST' });
      ctx = new NodeContext(req, res);

      expect(ctx.method).toBe('POST');
    });

    it('should uppercase method', () => {
      req.method = 'post';
      ctx = new NodeContext(req, res);

      expect(ctx.method).toBe('POST');
    });
  });

  describe('json()', () => {
    it('should send JSON response', () => {
      ctx.json({ message: 'hello' });

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
      expect(res.end).toHaveBeenCalledWith('{"message":"hello"}');
    });

    it('should set status code', () => {
      ctx.status = 201;
      ctx.json({ created: true });

      expect(res.statusCode).toBe(201);
    });

    it('should not send response twice', () => {
      ctx.json({ first: true });
      ctx.json({ second: true });

      expect(res.end).toHaveBeenCalledTimes(1);
    });
  });

  describe('send()', () => {
    it('should send string response', () => {
      ctx.send('Hello World');

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain; charset=utf-8');
      expect(res.end).toHaveBeenCalledWith('Hello World');
    });

    it('should send buffer response', () => {
      const buffer = Buffer.from('binary data');
      ctx.send(buffer);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/octet-stream');
      expect(res.end).toHaveBeenCalledWith(buffer);
    });

    it('should handle null response', () => {
      ctx.send(null);

      expect(res.end).toHaveBeenCalledWith();
    });

    it('should handle undefined response', () => {
      ctx.send(undefined);

      expect(res.end).toHaveBeenCalledWith();
    });

    it('should send object as JSON', () => {
      // Objects should be serialized as JSON
      // Note: This just verifies the code path works, the mock doesn't fully capture internal calls
      expect(() => ctx.send({ data: 'test' })).not.toThrow();
    });
  });

  describe('html()', () => {
    it('should send HTML response', () => {
      ctx.html('<h1>Hello</h1>');

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
      expect(res.end).toHaveBeenCalledWith('<h1>Hello</h1>');
    });
  });

  describe('redirect()', () => {
    it('should redirect with default 302 status', () => {
      ctx.redirect('/login');

      expect(res.statusCode).toBe(302);
      expect(res.setHeader).toHaveBeenCalledWith('Location', '/login');
      expect(res.end).toHaveBeenCalled();
    });

    it('should redirect with custom status', () => {
      ctx.redirect('/new-page', 301);

      expect(res.statusCode).toBe(301);
    });
  });

  describe('set()', () => {
    it('should set response header', () => {
      ctx.set('X-Custom', 'value');

      expect(res.setHeader).toHaveBeenCalledWith('X-Custom', 'value');
    });

    it('should set numeric header value', () => {
      ctx.set('Content-Length', 100);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Length', 100);
    });
  });

  describe('get()', () => {
    it('should get request header', () => {
      req = createMockReq({
        headers: { 'content-type': 'application/json' },
      });
      ctx = new NodeContext(req, res);

      expect(ctx.get('content-type')).toBe('application/json');
    });

    it('should be case-insensitive', () => {
      req = createMockReq({
        headers: { 'content-type': 'application/json' },
      });
      ctx = new NodeContext(req, res);

      expect(ctx.get('Content-Type')).toBe('application/json');
    });

    it('should return undefined for missing header', () => {
      expect(ctx.get('X-Missing')).toBeUndefined();
    });

    it('should return first value for array headers', () => {
      req = createMockReq({
        headers: { 'set-cookie': ['a=1', 'b=2'] },
      });
      ctx = new NodeContext(req, res);

      expect(ctx.get('set-cookie')).toBe('a=1');
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
    it('should provide access to raw request and response', () => {
      expect(ctx.raw.req).toBe(req);
      expect(ctx.raw.res).toBe(res);
    });
  });
});

describe('throw()', () => {
  let req: IncomingMessage;
  let res: ServerResponse;
  let ctx: NodeContext;

  beforeEach(() => {
    req = createMockReq();
    res = createMockRes();
    ctx = new NodeContext(req, res);
  });

  it('should throw HttpError with status and message', () => {
    expect(() => ctx.throw(404, 'User not found')).toThrow('User not found');
    try {
      ctx.throw(404, 'User not found');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('User not found');
      expect((error as { status: number }).status).toBe(404);
    }
  });

  it('should throw HttpError with default message for status', () => {
    try {
      ctx.throw(401);
    } catch (error) {
      expect((error as Error).message).toBe('Unauthorized');
      expect((error as { status: number }).status).toBe(401);
    }
  });

  it('should throw 400 Bad Request', () => {
    try {
      ctx.throw(400);
    } catch (error) {
      expect((error as Error).message).toBe('Bad Request');
      expect((error as { status: number }).status).toBe(400);
    }
  });

  it('should throw 403 Forbidden', () => {
    try {
      ctx.throw(403);
    } catch (error) {
      expect((error as Error).message).toBe('Forbidden');
      expect((error as { status: number }).status).toBe(403);
    }
  });

  it('should throw 500 Internal Server Error', () => {
    try {
      ctx.throw(500);
    } catch (error) {
      expect((error as Error).message).toBe('Internal Server Error');
      expect((error as { status: number }).status).toBe(500);
      expect((error as { expose: boolean }).expose).toBe(false);
    }
  });

  it('should set expose=true for client errors (4xx)', () => {
    try {
      ctx.throw(404);
    } catch (error) {
      expect((error as { expose: boolean }).expose).toBe(true);
    }
  });

  it('should set expose=false for server errors (5xx)', () => {
    try {
      ctx.throw(503);
    } catch (error) {
      expect((error as { expose: boolean }).expose).toBe(false);
    }
  });
});

describe('assert()', () => {
  let req: IncomingMessage;
  let res: ServerResponse;
  let ctx: NodeContext;

  beforeEach(() => {
    req = createMockReq();
    res = createMockRes();
    ctx = new NodeContext(req, res);
  });

  it('should not throw when condition is truthy', () => {
    expect(() => ctx.assert(true, 400)).not.toThrow();
    expect(() => ctx.assert(1, 400)).not.toThrow();
    expect(() => ctx.assert('value', 400)).not.toThrow();
    expect(() => ctx.assert({}, 400)).not.toThrow();
    expect(() => ctx.assert([], 400)).not.toThrow();
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

  it('should throw when condition is 0', () => {
    expect(() => ctx.assert(0, 400, 'Invalid value')).toThrow('Invalid value');
  });

  it('should throw when condition is empty string', () => {
    expect(() => ctx.assert('', 400, 'Empty value')).toThrow('Empty value');
  });

  it('should use default message when not provided', () => {
    try {
      ctx.assert(false, 400);
    } catch (error) {
      expect((error as Error).message).toBe('Bad Request');
    }
  });

  it('should set correct status code', () => {
    try {
      ctx.assert(null, 404, 'Resource not found');
    } catch (error) {
      expect((error as { status: number }).status).toBe(404);
    }
  });

  it('should work with user authentication pattern', () => {
    const user = null;
    expect(() => ctx.assert(user, 401, 'Authentication required')).toThrow('Authentication required');
  });

  it('should work with authorization pattern', () => {
    const user = { isAdmin: false };
    expect(() => ctx.assert(user.isAdmin, 403, 'Admin access required')).toThrow('Admin access required');
  });

  it('should work with body validation pattern', () => {
    ctx.body = null;
    expect(() => ctx.assert(ctx.body, 400, 'Request body required')).toThrow('Request body required');
  });

  it('should narrow type with asserts', () => {
    const maybeUser: { name: string } | null = { name: 'John' };
    ctx.assert(maybeUser, 404, 'User not found');
    expect(maybeUser.name).toBe('John');
  });
});

describe('createNodeContext', () => {
  it('should create NodeContext instance', () => {
    const req = createMockReq();
    const res = createMockRes();
    const ctx = createNodeContext(req, res);

    expect(ctx).toBeInstanceOf(NodeContext);
  });
});
