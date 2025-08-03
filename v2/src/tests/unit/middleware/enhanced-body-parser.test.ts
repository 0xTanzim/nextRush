/**
 * Enhanced Body Parser Middleware Tests
 *
 * @packageDocumentation
 */

import {
  EnhancedBodyParser,
  enhancedBodyParser,
} from '@/core/middleware/enhanced-body-parser';
import type { Context } from '@/types/context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Enhanced Body Parser', () => {
  let parser: EnhancedBodyParser;
  let mockContext: Context;

  beforeEach(() => {
    parser = new EnhancedBodyParser({ debug: false });
    mockContext = {
      req: {
        method: 'POST',
        url: '/test',
        headers: {},
        body: null,
        on: vi.fn(),
      } as any,
      res: {
        statusCode: 200,
        headers: {},
        setHeader: vi.fn(),
        json: vi.fn(),
        status: vi.fn().mockReturnThis(), // Add status method
      } as any,
      status: 200,
      body: null,
      params: {},
      query: {},
      set: vi.fn(),
    };
  });

  afterEach(() => {
    EnhancedBodyParser.cleanup();
  });

  describe('JSON Parsing', () => {
    it('should parse valid JSON data', async () => {
      const testData = { name: 'John', age: 30 };
      const buffer = Buffer.from(JSON.stringify(testData));

      const result = await parser.parse({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/json' },
        body: buffer,
      } as any);

      expect(result.parser).toBe('json');
      expect(result.data).toEqual(testData);
      expect(result.contentType).toBe('application/json');
      expect(result.hasFiles).toBe(false);
      expect(result.isEmpty).toBe(false);
    });

    it('should handle malformed JSON with proper error', async () => {
      const buffer = Buffer.from('{ invalid json }');

      await expect(
        parser.parse({
          method: 'POST',
          url: '/test',
          headers: { 'content-type': 'application/json' },
          body: buffer,
        } as any)
      ).rejects.toThrow('JSON parse error');
    });

    it('should handle empty JSON body', async () => {
      const buffer = Buffer.from('');

      const result = await parser.parse({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/json' },
        body: buffer,
      } as any);

      expect(result.parser).toBe('empty');
      expect(result.data).toBeNull();
      expect(result.isEmpty).toBe(true);
    });

    it('should validate JSON structure with fast validation', async () => {
      const parserWithValidation = new EnhancedBodyParser({
        fastValidation: true,
      });
      const buffer = Buffer.from('invalid json');

      await expect(
        parserWithValidation.parse({
          method: 'POST',
          url: '/test',
          headers: { 'content-type': 'application/json' },
          body: buffer,
        } as any)
      ).rejects.toThrow('Invalid JSON structure detected');
    });
  });

  describe('URL-Encoded Parsing', () => {
    it('should parse URL-encoded data', async () => {
      const testData = 'name=John&age=30&city=New%20York';
      const buffer = Buffer.from(testData);

      const result = await parser.parse({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: buffer,
      } as any);

      expect(result.parser).toBe('urlencoded');
      expect(result.data).toEqual({
        name: 'John',
        age: '30',
        city: 'New York',
      });
      expect(result.fields).toEqual({
        name: 'John',
        age: '30',
        city: 'New York',
      });
    });

    it('should handle nested form data', async () => {
      const testData = 'user[name]=John&user[age]=30&settings[theme]=dark';
      const buffer = Buffer.from(testData);

      const result = await parser.parse({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: buffer,
      } as any);

      expect(result.data).toEqual({
        user: {
          name: 'John',
          age: '30',
        },
        settings: {
          theme: 'dark',
        },
      });
    });

    it('should handle empty URL-encoded data', async () => {
      const buffer = Buffer.from('');

      const result = await parser.parse({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: buffer,
      } as any);

      expect(result.data).toEqual({});
      expect(result.isEmpty).toBe(true);
    });
  });

  describe('Text Parsing', () => {
    it('should parse text data', async () => {
      const testData = 'Hello, World!';
      const buffer = Buffer.from(testData);

      const result = await parser.parse({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'text/plain' },
        body: buffer,
      } as any);

      expect(result.parser).toBe('text');
      expect(result.data).toBe(testData);
      expect(result.isEmpty).toBe(false);
    });

    it('should handle empty text data', async () => {
      const buffer = Buffer.from('');

      const result = await parser.parse({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'text/plain' },
        body: buffer,
      } as any);

      expect(result.data).toBe('');
      expect(result.isEmpty).toBe(true);
    });
  });

  describe('Raw Parsing', () => {
    it('should parse raw binary data', async () => {
      const testData = Buffer.from([0x01, 0x02, 0x03, 0x04]);

      const result = await parser.parse({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/octet-stream' },
        body: testData,
      } as any);

      expect(result.parser).toBe('raw');
      expect(result.data).toEqual(testData);
      expect(result.isEmpty).toBe(false);
    });
  });

  describe('Content Type Detection', () => {
    it('should cache content type detection', async () => {
      const request1 = {
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/json' },
        body: Buffer.from('{}'),
      } as any;

      const request2 = {
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/json' },
        body: Buffer.from('{}'),
      } as any;

      await parser.parse(request1);
      const metrics1 = parser.getMetrics();

      await parser.parse(request2);
      const metrics2 = parser.getMetrics();

      // Cache hit ratio should increase
      expect(metrics2.cacheHitRatio).toBeGreaterThan(metrics1.cacheHitRatio);
    });

    it('should auto-detect content type when enabled', async () => {
      const parserWithAutoDetect = new EnhancedBodyParser({
        autoDetectContentType: true,
      });

      const result = await parserWithAutoDetect.parse({
        method: 'POST',
        url: '/test',
        headers: {}, // No content-type header
        body: Buffer.from('Hello World'),
      } as any);

      expect(result.contentType).toBe('text/plain');
    });
  });

  describe('Performance Optimizations', () => {
    it('should use optimized buffer concatenation', async () => {
      const chunks = [
        Buffer.from('Hello'),
        Buffer.from(' '),
        Buffer.from('World'),
      ];

      const result = await parser.parse({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'text/plain' },
        body: Buffer.concat(chunks),
      } as any);

      expect(result.data).toBe('Hello World');
    });

    it('should reuse StringDecoder from pool', async () => {
      const testData = 'Test data for decoder pooling';
      const buffer = Buffer.from(testData);

      // Make multiple requests to test decoder pooling
      for (let i = 0; i < 5; i++) {
        const result = await parser.parse({
          method: 'POST',
          url: '/test',
          headers: { 'content-type': 'text/plain' },
          body: buffer,
        } as any);

        expect(result.data).toBe(testData);
      }
    });

    it('should handle large payloads efficiently', async () => {
      const largeData = 'x'.repeat(1024 * 1024); // 1MB
      const buffer = Buffer.from(largeData);

      const startTime = process.hrtime.bigint();
      const result = await parser.parse({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'text/plain' },
        body: buffer,
      } as any);
      const endTime = process.hrtime.bigint();

      const parseTime = Number(endTime - startTime) / 1000000; // Convert to ms

      expect(result.data).toBe(largeData);
      expect(parseTime).toBeLessThan(100); // Should parse 1MB in less than 100ms
    });
  });

  describe('Error Handling', () => {
    it('should handle body size limits', async () => {
      const largeData = 'x'.repeat(11 * 1024 * 1024); // 11MB (over 10MB limit)
      const buffer = Buffer.from(largeData);

      await expect(
        parser.parse({
          method: 'POST',
          url: '/test',
          headers: { 'content-type': 'text/plain' },
          body: buffer,
        } as any)
      ).rejects.toThrow('Request body too large');
    });

    it('should handle timeout errors', async () => {
      const parserWithShortTimeout = new EnhancedBodyParser({ timeout: 1 });

      // Create a request that would take longer than 1ms
      const request = {
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'text/plain' },
        body: undefined, // No body to trigger streaming
        on: vi.fn(),
        readableEnded: false,
      } as any;

      // Mock the request to not emit 'data' or 'end' events
      request.on.mockImplementation((event, _handler) => {
        if (event === 'data') {
          // Don't call the handler, simulating a slow request
        }
      });

      await expect(parserWithShortTimeout.parse(request)).rejects.toThrow(
        'Request timeout'
      );
    });
  });

  describe('Metrics Collection', () => {
    it('should collect performance metrics when enabled', async () => {
      const parserWithMetrics = new EnhancedBodyParser({ enableMetrics: true });

      const testData = { name: 'John', age: 30 };
      const buffer = Buffer.from(JSON.stringify(testData));

      await parserWithMetrics.parse({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/json' },
        body: buffer,
      } as any);

      const metrics = parserWithMetrics.getMetrics();

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.totalBytesProcessed).toBeGreaterThan(0);
      expect(metrics.averageParseTime).toBeGreaterThan(0);
      expect(metrics.successRate).toBe(1);
    });

    it('should track cache hit ratio', async () => {
      const parserWithMetrics = new EnhancedBodyParser({ enableMetrics: true });

      const request = {
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/json' },
        body: Buffer.from('{}'),
      } as any;

      // First request
      await parserWithMetrics.parse(request);
      const metrics1 = parserWithMetrics.getMetrics();

      // Second request (should hit cache)
      await parserWithMetrics.parse(request);
      const metrics2 = parserWithMetrics.getMetrics();

      expect(metrics2.cacheHitRatio).toBeGreaterThan(metrics1.cacheHitRatio);
    });
  });

  describe('Middleware Integration', () => {
    it('should work as middleware', async () => {
      const middleware = enhancedBodyParser();
      let nextCalled = false;

      mockContext.req.headers['content-type'] = 'application/json';
      mockContext.req.body = Buffer.from('{"name":"John"}');

      await middleware(mockContext, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(mockContext.body).toEqual({ name: 'John' });
    });

    it('should skip GET requests', async () => {
      const middleware = enhancedBodyParser();
      let nextCalled = false;

      mockContext.req.method = 'GET';

      await middleware(mockContext, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(mockContext.body).toBeNull();
    });

    it('should handle parsing errors in middleware', async () => {
      const middleware = enhancedBodyParser();
      let nextCalled = false;

      mockContext.req.headers['content-type'] = 'application/json';
      mockContext.req.body = Buffer.from('invalid json');

      await middleware(mockContext, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(mockContext.status).toBe(400);
      expect(mockContext.body).toHaveProperty('error');
      expect(mockContext.body.error.code).toBe('INVALID_JSON');
    });

    it('should set bodyParserResult in context', async () => {
      const middleware = enhancedBodyParser();

      mockContext.req.headers['content-type'] = 'application/json';
      mockContext.req.body = Buffer.from('{"name":"John"}');

      await middleware(mockContext, async () => {
        // Continue
      });

      expect((mockContext as any).bodyParserResult).toBeDefined();
      expect((mockContext as any).bodyParserResult.parser).toBe('json');
      expect((mockContext as any).bodyParserResult.parseTime).toBeGreaterThan(
        0
      );
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should work with string body (Bun compatibility)', async () => {
      const result = await parser.parse({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/json' },
        body: '{"name":"John"}',
      } as any);

      expect(result.data).toEqual({ name: 'John' });
    });

    it('should work with Buffer body (Node.js compatibility)', async () => {
      const result = await parser.parse({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/json' },
        body: Buffer.from('{"name":"John"}'),
      } as any);

      expect(result.data).toEqual({ name: 'John' });
    });

    it('should work with object body (Deno compatibility)', async () => {
      const result = await parser.parse({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/json' },
        body: { name: 'John' },
      } as any);

      expect(result.data).toEqual({ name: 'John' });
    });
  });

  describe('Configuration Options', () => {
    it('should respect maxSize option', async () => {
      const parserWithSmallLimit = new EnhancedBodyParser({ maxSize: 1024 }); // 1KB
      const largeData = 'x'.repeat(1025); // 1KB + 1 byte
      const buffer = Buffer.from(largeData);

      await expect(
        parserWithSmallLimit.parse({
          method: 'POST',
          url: '/test',
          headers: { 'content-type': 'text/plain' },
          body: buffer,
        } as any)
      ).rejects.toThrow('Request body too large');
    });

    it('should respect timeout option', async () => {
      const parserWithTimeout = new EnhancedBodyParser({ timeout: 1 });

      const request = {
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'text/plain' },
        body: undefined, // No body to trigger streaming
        on: vi.fn(),
        readableEnded: false,
      } as any;

      request.on.mockImplementation(() => {}); // Don't emit events

      await expect(parserWithTimeout.parse(request)).rejects.toThrow(
        'Request timeout'
      );
    });

    it('should respect debug option', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const debugParser = new EnhancedBodyParser({ debug: true });

      await debugParser.parse({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/json' },
        body: Buffer.from('{}'),
      } as any);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup static resources', () => {
      // Use the parser to populate static pools
      const testData = 'test data';
      const buffer = Buffer.from(testData);

      return parser
        .parse({
          method: 'POST',
          url: '/test',
          headers: { 'content-type': 'text/plain' },
          body: buffer,
        } as any)
        .then(() => {
          // Cleanup should not throw
          expect(() => EnhancedBodyParser.cleanup()).not.toThrow();
        });
    });
  });
});
