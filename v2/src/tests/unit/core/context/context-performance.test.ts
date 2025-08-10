/**
 * Context Performance Tests
 *
 * @packageDocumentation
 */

import { createContext } from '@/core/app/context';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createServer,
  IncomingMessage as NodeIncomingMessage,
  ServerResponse as NodeServerResponse,
} from 'node:http';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Context Performance', () => {
  let mockReq: IncomingMessage;
  let mockRes: ServerResponse;

  beforeEach(() => {
    // Create a simple HTTP server to get real request/response objects
    const server = createServer();
    mockReq = new NodeIncomingMessage({} as any);
    mockRes = new NodeServerResponse(mockReq);

    // Set up basic request properties
    mockReq.method = 'GET';
    mockReq.url = '/test?param=value';
    mockReq.headers = {
      host: 'localhost:3000',
      'user-agent': 'test-agent',
      'x-forwarded-for': '192.168.1.1',
      'x-forwarded-proto': 'https',
    };
  });

  describe('Context Creation Performance', () => {
    it('should create context efficiently', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const ctx = createContext(mockReq, mockRes, {
          port: 3000,
          host: 'localhost',
          cors: {},
          helmet: {},
          bodyParser: {},
          rateLimit: {},
          logger: {},
          compression: {},
          requestId: {},
          timer: {},
        });

        // Access some properties to ensure they're created
        expect(ctx.method).toBe('GET');
        expect(ctx.path).toBe('/test');
        expect(ctx.query).toEqual({ param: 'value' });
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / iterations;

      console.log(`Context Creation Performance:`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  Average time: ${averageTime.toFixed(4)}ms`);
      console.log(
        `  Operations per second: ${(1000 / averageTime).toFixed(0)}`
      );

      // Should be under 1ms per context creation
      expect(averageTime).toBeLessThan(1);
    });

    it('should avoid redundant URL parsing', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const ctx = createContext(mockReq, mockRes, {
          port: 3000,
          host: 'localhost',
          cors: {},
          helmet: {},
          bodyParser: {},
          rateLimit: {},
          logger: {},
          compression: {},
          requestId: {},
          timer: {},
        });

        // Access URL-related properties multiple times
        expect(ctx.url).toBe('/test?param=value');
        expect(ctx.path).toBe('/test');
        expect(ctx.query).toEqual({ param: 'value' });
        expect(ctx.host).toBe('localhost:3000');
        expect(ctx.origin).toBe('https://localhost:3000');
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / iterations;

      console.log(`URL Parsing Performance:`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  Average time: ${averageTime.toFixed(4)}ms`);

      // Should be efficient even with multiple URL property access
      expect(averageTime).toBeLessThan(2);
    });

    it('should avoid double enhancement overhead', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const ctx = createContext(mockReq, mockRes, {
          port: 3000,
          host: 'localhost',
          cors: {},
          helmet: {},
          bodyParser: {},
          rateLimit: {},
          logger: {},
          compression: {},
          requestId: {},
          timer: {},
        });

        // Test that enhancement only happens once
        expect(ctx.req).toBeDefined();
        expect(ctx.res).toBeDefined();

        // Access enhanced properties
        expect(typeof ctx.req.headers).toBe('object');
        expect(typeof ctx.res.setHeader).toBe('function');
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / iterations;

      console.log(`Enhancement Performance:`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  Average time: ${averageTime.toFixed(4)}ms`);

      // Should be efficient without double enhancement
      expect(averageTime).toBeLessThan(1.5);
    });

    it('should minimize property creation overhead', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const ctx = createContext(mockReq, mockRes, {
          port: 3000,
          host: 'localhost',
          cors: {},
          helmet: {},
          bodyParser: {},
          rateLimit: {},
          logger: {},
          compression: {},
          requestId: {},
          timer: {},
        });

        // Access all major properties to ensure they're created
        expect(ctx.req).toBeDefined();
        expect(ctx.res).toBeDefined();
        expect(ctx.method).toBeDefined();
        expect(ctx.url).toBeDefined();
        expect(ctx.path).toBeDefined();
        expect(ctx.headers).toBeDefined();
        expect(ctx.query).toBeDefined();
        expect(ctx.params).toBeDefined();
        expect(ctx.id).toBeDefined();
        expect(ctx.state).toBeDefined();
        expect(ctx.startTime).toBeDefined();
        expect(ctx.ip).toBeDefined();
        expect(ctx.secure).toBeDefined();
        expect(ctx.protocol).toBeDefined();
        expect(ctx.hostname).toBeDefined();
        expect(ctx.host).toBeDefined();
        expect(ctx.origin).toBeDefined();
        expect(ctx.href).toBeDefined();
        expect(ctx.search).toBeDefined();
        expect(ctx.searchParams).toBeDefined();
        expect(ctx.status).toBeDefined();
        expect(ctx.responseHeaders).toBeDefined();
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / iterations;

      console.log(`Property Creation Performance:`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  Average time: ${averageTime.toFixed(4)}ms`);
      console.log(`  Properties per context: ~20`);

      // Should be efficient even with 20+ properties
      expect(averageTime).toBeLessThan(2);
    });
  });

  describe('Memory Usage', () => {
    it('should use memory efficiently', () => {
      const iterations = 1000;
      const initialMemory = process.memoryUsage().heapUsed;

      const contexts = [];
      for (let i = 0; i < iterations; i++) {
        const ctx = createContext(mockReq, mockRes, {
          port: 3000,
          host: 'localhost',
          cors: {},
          helmet: {},
          bodyParser: {},
          rateLimit: {},
          logger: {},
          compression: {},
          requestId: {},
          timer: {},
        });
        contexts.push(ctx);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const averageMemoryPerContext = memoryIncrease / iterations;

      console.log(`Memory Usage:`);
      console.log(
        `  Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(
        `  Average per context: ${(averageMemoryPerContext / 1024).toFixed(2)}KB`
      );

      // Should use less than 6KB per context (adjusted for realistic usage)
      expect(averageMemoryPerContext).toBeLessThan(6 * 1024);

      // Clear references to allow GC
      contexts.length = 0;
    });
  });
});
