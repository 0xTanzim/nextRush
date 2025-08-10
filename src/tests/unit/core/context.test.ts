/**
 * Context Tests
 *
 * @packageDocumentation
 */

import { createContext } from '@/core/app/context';
import type { ApplicationOptions } from '@/types/http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Context Creation', () => {
  let mockReq: IncomingMessage;
  let mockRes: ServerResponse;
  let options: Required<ApplicationOptions>;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      url: '/test?param=value',
      headers: {
        host: 'localhost:3000',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'x-forwarded-for': '192.168.1.1',
        'x-forwarded-proto': 'https',
        cookie: 'sessionId=abc123; theme=dark',
        'content-type': 'application/json',
        accept: 'application/json, text/html',
      },
      socket: {
        remoteAddress: '127.0.0.1',
      },
    } as unknown as IncomingMessage;

    mockRes = {
      statusCode: 200,
      setHeader: vi.fn(),
      getHeader: vi.fn(),
      removeHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;

    options = {
      port: 3000,
      host: 'localhost',
      trustProxy: true,
      debug: false,
      cors: false,
    } as Required<ApplicationOptions>;
  });

  describe('Basic Context Properties', () => {
    it('should create context with basic properties', () => {
      const ctx = createContext(mockReq, mockRes, options);

      expect(ctx.req).toBeDefined();
      expect(ctx.res).toBeDefined();
      expect(ctx.body).toBeUndefined();
      expect(ctx.method).toBe('GET');
      expect(ctx.url).toBe('/test?param=value');
      expect(ctx.path).toBe('/test');
      expect(ctx.headers).toEqual(mockReq.headers);
      expect(ctx.query).toEqual({ param: 'value' });
      expect(ctx.params).toEqual({});
      expect(ctx.id).toBeDefined();
      expect(ctx.state).toEqual({});
      expect(ctx.startTime).toBeDefined();
    });

    it('should have enhanced request properties', () => {
      const ctx = createContext(mockReq, mockRes, options);

      expect(ctx.ip).toBe('192.168.1.1');
      expect(ctx.secure).toBe(true);
      expect(ctx.protocol).toBe('https');
      expect(ctx.hostname).toBe('localhost');
      expect(ctx.host).toBe('localhost:3000');
      expect(ctx.origin).toBe('https://localhost:3000');
      expect(ctx.href).toBe('https://localhost:3000/test?param=value');
      expect(ctx.search).toBe('?param=value');
      expect(ctx.searchParams).toBeDefined();
      expect(ctx.status).toBe(200);
      expect(ctx.responseHeaders).toEqual({});
    });
  });

  describe('Context Methods', () => {
    it('should have throw method', () => {
      const ctx = createContext(mockReq, mockRes, options);

      expect(() => ctx.throw(404, 'Not Found')).toThrow('Not Found');
    });

    it('should have assert method', () => {
      const ctx = createContext(mockReq, mockRes, options);

      // Should not throw when condition is true
      expect(() => ctx.assert(true, 400, 'Bad Request')).not.toThrow();

      // Should throw when condition is false
      expect(() => ctx.assert(false, 400, 'Bad Request')).toThrow(
        'Bad Request'
      );
    });

    it('should have fresh method', () => {
      const ctx = createContext(mockReq, mockRes, options);

      // GET request should be fresh
      expect(ctx.fresh()).toBe(true);

      // POST request should not be fresh
      const postReq = { ...mockReq, method: 'POST' } as IncomingMessage;
      const postCtx = createContext(postReq, mockRes, options);
      expect(postCtx.fresh()).toBe(false);
    });

    it('should have stale method', () => {
      const ctx = createContext(mockReq, mockRes, options);

      // GET request should not be stale
      expect(ctx.stale()).toBe(false);

      // POST request should be stale
      const postReq = { ...mockReq, method: 'POST' } as IncomingMessage;
      const postCtx = createContext(postReq, mockRes, options);
      expect(postCtx.stale()).toBe(true);
    });

    it('should have idempotent method', () => {
      const ctx = createContext(mockReq, mockRes, options);

      // GET should be idempotent
      expect(ctx.idempotent()).toBe(true);

      // POST should not be idempotent
      const postReq = { ...mockReq, method: 'POST' } as IncomingMessage;
      const postCtx = createContext(postReq, mockRes, options);
      expect(postCtx.idempotent()).toBe(false);
    });

    it('should have cacheable method', () => {
      const ctx = createContext(mockReq, mockRes, options);

      // GET with 200 status should be cacheable
      expect(ctx.cacheable()).toBe(true);

      // POST should not be cacheable
      const postReq = { ...mockReq, method: 'POST' } as IncomingMessage;
      const postCtx = createContext(postReq, mockRes, options);
      expect(postCtx.cacheable()).toBe(false);
    });
  });

  describe('Enhanced Request Integration', () => {
    it('should have enhanced request properties', () => {
      const ctx = createContext(mockReq, mockRes, options);

      expect(ctx.req.params).toEqual({});
      expect(ctx.req.query).toEqual({});
      expect(ctx.req.originalUrl).toBe('/test?param=value');
      expect(ctx.req.path).toBe('/test');
      expect(ctx.ip).toBe('192.168.1.1');
      expect(ctx.secure).toBe(true);
      expect(ctx.protocol).toBe('https');
      expect(ctx.hostname).toBe('localhost');
    });

    it('should have enhanced request properties', () => {
      const ctx = createContext(mockReq, mockRes, options);

      expect(ctx.req.params).toEqual({});
      expect(ctx.req.query).toEqual({});
      expect(ctx.req.originalUrl).toBe('/test?param=value');
      expect(ctx.req.path).toBe('/test');
      // Test that these are properties (from request enhancer)
      expect(typeof ctx.req.ip).toBe('string');
      expect(typeof ctx.req.secure).toBe('boolean');
      expect(typeof ctx.req.protocol).toBe('string');
    });
  });

  describe('Enhanced Response Integration', () => {
    it('should have enhanced response methods', () => {
      const ctx = createContext(mockReq, mockRes, options);
      expect(typeof ctx.res.json).toBe('function');
      expect(typeof ctx.res.html).toBe('function');
      expect(typeof ctx.res.text).toBe('function');
      expect(typeof ctx.res.xml).toBe('function');
      expect(typeof ctx.res.csv).toBe('function');
      expect(typeof ctx.res.download).toBe('function');
      expect(typeof ctx.res.redirect).toBe('function');
      expect(typeof ctx.res.status).toBe('function');
      expect(typeof ctx.res.set).toBe('function');
      expect(typeof ctx.res.get).toBe('function');
    });
  });

  describe('URL Parsing', () => {
    it('should parse URL correctly', () => {
      const req = {
        ...mockReq,
        url: '/users/123?page=1&limit=10',
      } as IncomingMessage;

      const ctx = createContext(req, mockRes, options);

      expect(ctx.path).toBe('/users/123');
      expect(ctx.query).toEqual({
        page: '1',
        limit: '10',
      });
      expect(ctx.search).toBe('?page=1&limit=10');
    });

    it('should handle URL without query parameters', () => {
      const req = {
        ...mockReq,
        url: '/api/users',
      } as IncomingMessage;

      const ctx = createContext(req, mockRes, options);

      expect(ctx.path).toBe('/api/users');
      expect(ctx.query).toEqual({});
      expect(ctx.search).toBe('');
    });

    it('should handle undefined URL', () => {
      const req = {
        ...mockReq,
        url: undefined,
      } as IncomingMessage;

      const ctx = createContext(req, mockRes, options);

      expect(ctx.path).toBe('/');
      expect(ctx.url).toBe('/');
    });
  });

  describe('IP Detection', () => {
    it('should detect IP from X-Forwarded-For', () => {
      const req = {
        ...mockReq,
        headers: {
          ...mockReq.headers,
          'x-forwarded-for': '203.0.113.1, 192.168.1.1',
        },
      } as unknown as IncomingMessage;

      const ctx = createContext(req, mockRes, options);
      expect(ctx.ip).toBe('203.0.113.1');
    });

    it('should fallback to X-Real-IP', () => {
      const req = {
        ...mockReq,
        headers: { 'x-real-ip': '10.0.0.1' },
      } as unknown as IncomingMessage;
      const ctx = createContext(req, mockRes, options);
      expect(ctx.ip).toBe('10.0.0.1');
    });

    it('should fallback to socket remote address', () => {
      const req = {
        ...mockReq,
        headers: {},
      } as IncomingMessage;

      const ctx = createContext(req, mockRes, options);
      expect(ctx.ip).toBe('127.0.0.1');
    });
  });

  describe('Security Detection', () => {
    it('should detect HTTPS from X-Forwarded-Proto', () => {
      const req = {
        ...mockReq,
        headers: {
          ...mockReq.headers,
          'x-forwarded-proto': 'https',
        },
      } as unknown as IncomingMessage;

      const ctx = createContext(req, mockRes, options);
      expect(ctx.secure).toBe(true);
      expect(ctx.protocol).toBe('https');
    });

    it('should detect HTTP from X-Forwarded-Proto', () => {
      const req = {
        ...mockReq,
        headers: {
          ...mockReq.headers,
          'x-forwarded-proto': 'http',
        },
      } as unknown as IncomingMessage;

      const ctx = createContext(req, mockRes, options);
      expect(ctx.secure).toBe(false);
      expect(ctx.protocol).toBe('http');
    });
  });

  describe('Hostname Detection', () => {
    it('should extract hostname from host header', () => {
      const req = {
        ...mockReq,
        headers: {
          ...mockReq.headers,
          host: 'example.com:8080',
        },
      } as IncomingMessage;

      const ctx = createContext(req, mockRes, options);
      expect(ctx.hostname).toBe('example.com');
    });

    it('should fallback to localhost', () => {
      const req = {
        ...mockReq,
        headers: {},
      } as IncomingMessage;

      const ctx = createContext(req, mockRes, options);
      expect(ctx.hostname).toBe('localhost');
    });
  });

  describe('Unique ID Generation', () => {
    it('should generate unique IDs', () => {
      const ctx1 = createContext(mockReq, mockRes, options);
      const ctx2 = createContext(mockReq, mockRes, options);

      expect(ctx1.id).toBeDefined();
      expect(ctx2.id).toBeDefined();
      expect(ctx1.id).not.toBe(ctx2.id);
    });
  });

  describe('Timing', () => {
    it('should set start time', () => {
      const before = Date.now();
      const ctx = createContext(mockReq, mockRes, options);
      const after = Date.now();

      expect(ctx.startTime).toBeGreaterThanOrEqual(before);
      expect(ctx.startTime).toBeLessThanOrEqual(after);
    });
  });
});
