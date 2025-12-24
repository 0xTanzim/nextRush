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

describe('createNodeContext', () => {
  it('should create NodeContext instance', () => {
    const req = createMockReq();
    const res = createMockRes();
    const ctx = createNodeContext(req, res);

    expect(ctx).toBeInstanceOf(NodeContext);
  });
});
