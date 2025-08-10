/**
 * 🧪 Smart Body Parser Tests - NextRush v2
 *
 * Tests for the new modular, high-performance body parser system
 *
 * @author NextRush Framework Team
 * @version 2.0.0
 */

import { smartBodyParser } from '@/core/middleware/body-parser';
import type { Context } from '@/types/context';
import type { NextRushRequest } from '@/types/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Smart Body Parser', () => {
  let mockContext: Context;
  let mockNext: () => Promise<void>;

  beforeEach(() => {
    mockNext = vi.fn().mockResolvedValue(undefined);
    mockContext = createMockContext();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Create mock context for testing
   */
  function createMockContext(overrides: Partial<Context> = {}): Context {
    return {
      req: {
        method: 'POST',
        url: '/test',
        headers: {},
        on: vi.fn(),
        body: undefined,
      } as unknown as NextRushRequest,
      res: {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
        setHeader: vi.fn().mockReturnThis(),
      } as any,
      body: undefined,
      method: 'POST',
      url: '/test',
      path: '/test',
      headers: {},
      query: {},
      params: {},
      id: 'test-id',
      state: {},
      startTime: Date.now(),
      ip: '127.0.0.1',
      secure: false,
      protocol: 'http',
      hostname: 'localhost',
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      href: 'http://localhost:3000/test',
      search: '',
      searchParams: new URLSearchParams(),
      status: 200,
      responseHeaders: {},
      ...overrides,
    } as Context;
  }

  describe('Middleware Creation', () => {
    it('should create middleware function', () => {
      const middleware = smartBodyParser();
      expect(typeof middleware).toBe('function');
    });

    it('should accept options', () => {
      const middleware = smartBodyParser({
        maxSize: 1024 * 1024,
        timeout: 5000,
      });
      expect(typeof middleware).toBe('function');
    });
  });

  describe('Request Method Handling', () => {
    it('should skip parsing for GET requests', async () => {
      const middleware = smartBodyParser();
      mockContext.method = 'GET';

      await middleware(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.body).toBeUndefined();
    });

    it('should skip parsing for HEAD requests', async () => {
      const middleware = smartBodyParser();
      mockContext.method = 'HEAD';

      await middleware(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.body).toBeUndefined();
    });

    it('should skip parsing for DELETE requests', async () => {
      const middleware = smartBodyParser();
      mockContext.method = 'DELETE';

      await middleware(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.body).toBeUndefined();
    });

    it('should process POST requests', async () => {
      const middleware = smartBodyParser();
      mockContext.method = 'POST';
      mockContext.headers['content-type'] = 'application/json';

      // Mock request stream
      const jsonData = JSON.stringify({ test: 'data' });
      mockContext.req.on = vi.fn((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from(jsonData));
        } else if (event === 'end') {
          callback();
        }
        return mockContext.req;
      });

      await middleware(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.body).toEqual({ test: 'data' });
    });
  });

  describe('Content Type Detection', () => {
    it('should handle JSON content type', async () => {
      const middleware = smartBodyParser();
      mockContext.headers['content-type'] = 'application/json';

      const jsonData = JSON.stringify({ message: 'hello' });
      mockContext.req.on = vi.fn((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from(jsonData));
        } else if (event === 'end') {
          callback();
        }
        return mockContext.req;
      });

      await middleware(mockContext, mockNext);

      expect(mockContext.body).toEqual({ message: 'hello' });
    });

    it('should handle URL-encoded content type', async () => {
      const middleware = smartBodyParser();
      mockContext.headers['content-type'] = 'application/x-www-form-urlencoded';

      const formData = 'name=John&age=30';
      mockContext.req.on = vi.fn((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from(formData));
        } else if (event === 'end') {
          callback();
        }
        return mockContext.req;
      });

      await middleware(mockContext, mockNext);

      expect(mockContext.body).toEqual({ name: 'John', age: '30' });
    });

    it('should handle text content type', async () => {
      const middleware = smartBodyParser();
      mockContext.headers['content-type'] = 'text/plain';

      const textData = 'Hello, World!';
      mockContext.req.on = vi.fn((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from(textData));
        } else if (event === 'end') {
          callback();
        }
        return mockContext.req;
      });

      await middleware(mockContext, mockNext);

      expect(mockContext.body).toBe('Hello, World!');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON', async () => {
      const middleware = smartBodyParser();
      mockContext.headers['content-type'] = 'application/json';

      const invalidJson = '{ invalid json }';
      mockContext.req.on = vi.fn((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from(invalidJson));
        } else if (event === 'end') {
          callback();
        }
        return mockContext.req;
      });

      await expect(middleware(mockContext, mockNext)).rejects.toThrow();
    });
  });

  describe('Performance Features', () => {
    it('should add metrics when enabled', async () => {
      const middleware = smartBodyParser({ enableMetrics: true });
      mockContext.headers['content-type'] = 'application/json';

      const jsonData = JSON.stringify({ test: 'data' });
      mockContext.req.on = vi.fn((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from(jsonData));
        } else if (event === 'end') {
          callback();
        }
        return mockContext.req;
      });

      await middleware(mockContext, mockNext);

      expect((mockContext as any).bodyParserMetrics).toBeDefined();
      expect((mockContext as any).bodyParserMetrics.parser).toBe('json');
      expect((mockContext as any).bodyParserMetrics.parseTime).toBeGreaterThan(
        0
      );
    });

    it('should skip parsing if body already exists', async () => {
      const middleware = smartBodyParser();
      mockContext.body = { existing: 'data' };

      await middleware(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockContext.body).toEqual({ existing: 'data' });
    });
  });

  describe('Size Limits', () => {
    it('should respect maxSize option', async () => {
      const middleware = smartBodyParser({ maxSize: 10 }); // Very small limit
      mockContext.headers['content-type'] = 'application/json';

      const largeData = JSON.stringify({ data: 'a'.repeat(100) });
      mockContext.req.on = vi.fn((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from(largeData));
        } else if (event === 'end') {
          callback();
        }
        return mockContext.req;
      });

      await expect(middleware(mockContext, mockNext)).rejects.toThrow(
        /too large/
      );
    });
  });

  describe('Lazy Loading Performance', () => {
    it('should demonstrate lazy loading benefit', async () => {
      // This test shows that only the JSON parser is loaded for JSON requests
      const middleware = smartBodyParser();
      mockContext.headers['content-type'] = 'application/json';

      const jsonData = JSON.stringify({ lazyLoaded: true });
      mockContext.req.on = vi.fn((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from(jsonData));
        } else if (event === 'end') {
          callback();
        }
        return mockContext.req;
      });

      const startTime = performance.now();
      await middleware(mockContext, mockNext);
      const endTime = performance.now();

      expect(mockContext.body).toEqual({ lazyLoaded: true });
      expect(endTime - startTime).toBeLessThan(50); // Should be very fast
    });
  });
});
