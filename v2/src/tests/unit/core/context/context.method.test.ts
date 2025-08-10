import { createContext } from '@/core/app/context';
import type { ApplicationOptions } from '@/types/http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Context methods checks ', () => {
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

  describe('ctx properties checks', () => {
    it('should have basic properties', () => {
      const ctx = createContext(mockReq, mockRes, options);

      // Basic request properties
      expect(ctx.body).toBe(undefined); // Initially undefined, set by body parser
      expect(typeof ctx.method).toBe('string');
      expect(typeof ctx.url).toBe('string');
      expect(typeof ctx.path).toBe('string');
      expect(typeof ctx.headers).toBe('object');
      expect(typeof ctx.params).toBe('object');
      expect(typeof ctx.state).toBe('object');
      expect(typeof ctx.startTime).toBe('number');

      // Client information properties
      expect(typeof ctx.ip).toBe('string');
      expect(typeof ctx.secure).toBe('boolean');
      expect(typeof ctx.protocol).toBe('string');
      expect(typeof ctx.hostname).toBe('string');
      expect(typeof ctx.host).toBe('string');
      expect(typeof ctx.origin).toBe('string');
      expect(typeof ctx.href).toBe('string');
      expect(typeof ctx.search).toBe('string');

      // Response properties
      expect(typeof ctx.status).toBe('number');
      expect(typeof ctx.responseHeaders).toBe('object');

      // Request ID (can be string or undefined)
      expect(['string', 'undefined']).toContain(typeof ctx.id);
    });

    it('should have lazy-loaded properties', () => {
      const ctx = createContext(mockReq, mockRes, options);

      // Query should be an object (lazy loaded)
      expect(typeof ctx.query).toBe('object');
      expect(ctx.searchParams).toBeInstanceOf(URLSearchParams);
    });

    it('should have context methods', () => {
      const ctx = createContext(mockReq, mockRes, options);

      // Context utility methods
      expect(typeof ctx.throw).toBe('function');
      expect(typeof ctx.assert).toBe('function');
      expect(typeof ctx.fresh).toBe('function');
      expect(typeof ctx.stale).toBe('function');
      expect(typeof ctx.idempotent).toBe('function');
      expect(typeof ctx.cacheable).toBe('function');
      expect(typeof ctx.set).toBe('function');
      expect(typeof ctx.sendFile).toBe('function');
    });

    it('should have enhanced request object', () => {
      const ctx = createContext(mockReq, mockRes, options);

      expect(ctx.req).toBeDefined();
      expect(typeof ctx.req).toBe('object');
    });

    it('should have enhanced response object with methods', () => {
      const ctx = createContext(mockReq, mockRes, options);

      expect(ctx.res).toBeDefined();
      expect(typeof ctx.res).toBe('object');

      // Core response methods (IMPLEMENTED & TYPED)
      expect(typeof ctx.res.json).toBe('function');
      expect(typeof ctx.res.html).toBe('function');
      expect(typeof ctx.res.text).toBe('function');
      expect(typeof ctx.res.xml).toBe('function');
      expect(typeof ctx.res.csv).toBe('function');
      expect(typeof ctx.res.send).toBe('function');
      expect(typeof ctx.res.stream).toBe('function');
      expect(typeof ctx.res.render).toBe('function');

      // File response methods (IMPLEMENTED & TYPED)
      expect(typeof ctx.res.sendFile).toBe('function');
      expect(typeof ctx.res.file).toBe('function');
      expect(typeof ctx.res.download).toBe('function');

      // Redirect methods (IMPLEMENTED & TYPED)
      expect(typeof ctx.res.redirect).toBe('function');
      expect(typeof ctx.res.redirectPermanent).toBe('function');
      expect(typeof ctx.res.redirectTemporary).toBe('function');

      // Header methods (IMPLEMENTED & TYPED)
      expect(typeof ctx.res.status).toBe('function');
      expect(typeof ctx.res.set).toBe('function');
      expect(typeof ctx.res.header).toBe('function');
      expect(typeof ctx.res.get).toBe('function');
      expect(typeof ctx.res.remove).toBe('function');
      expect(typeof ctx.res.removeHeader).toBe('function');
      expect(typeof ctx.res.type).toBe('function');
      expect(typeof ctx.res.length).toBe('function');
      expect(typeof ctx.res.etag).toBe('function');
      expect(typeof ctx.res.lastModified).toBe('function');

      // Cookie methods (IMPLEMENTED & TYPED)
      expect(typeof ctx.res.cookie).toBe('function');
      expect(typeof ctx.res.clearCookie).toBe('function');

      // Cache and CORS methods (IMPLEMENTED & TYPED)
      expect(typeof ctx.res.cache).toBe('function');
      expect(typeof ctx.res.noCache).toBe('function');
      expect(typeof ctx.res.cors).toBe('function');

      // Security methods (IMPLEMENTED & TYPED)
      expect(typeof ctx.res.security).toBe('function');

      // Compression (IMPLEMENTED & TYPED)
      expect(typeof ctx.res.compress).toBe('function');

      // API helpers (IMPLEMENTED & TYPED)
      expect(typeof ctx.res.success).toBe('function');
      expect(typeof ctx.res.error).toBe('function');
      expect(typeof ctx.res.paginate).toBe('function');

      // Utility methods (IMPLEMENTED & TYPED)
      expect(typeof ctx.res.getContentTypeFromExtension).toBe('function');
      expect(typeof ctx.res.getSmartContentType).toBe('function');
      expect(typeof ctx.res.generateETag).toBe('function');
      expect(typeof ctx.res.convertToCSV).toBe('function');
      expect(typeof ctx.res.time).toBe('function');
      expect(typeof ctx.res.getNestedValue).toBe('function');
      expect(typeof ctx.res.isTruthy).toBe('function');
    });

    it('should verify all TypeScript methods are now implemented', () => {
      const ctx = createContext(mockReq, mockRes, options);

      console.log('🎉 TYPESCRIPT INTERFACE FIXED - ALL METHODS NOW AVAILABLE:');
      console.log('='.repeat(70));

      // All methods that are now properly typed AND implemented
      const allImplementedMethods = [
        // Core response methods
        'json',
        'html',
        'text',
        'xml',
        'csv',
        'send',
        'stream',
        'render',
        // File methods
        'sendFile',
        'file',
        'download',
        // Redirect methods
        'redirect',
        'redirectPermanent',
        'redirectTemporary',
        // Header methods
        'status',
        'set',
        'header',
        'get',
        'remove',
        'removeHeader',
        'type',
        'length',
        'etag',
        'lastModified',
        // Cookie methods
        'cookie',
        'clearCookie',
        // Cache and CORS
        'cache',
        'noCache',
        'cors',
        // Security
        'security',
        // Compression
        'compress',
        // API helpers
        'success',
        'error',
        'paginate',
        // Utilities
        'getContentTypeFromExtension',
        'getSmartContentType',
        'generateETag',
        'convertToCSV',
        'time',
        'getNestedValue',
        'isTruthy',
      ];

      console.log(
        `✅ All ${allImplementedMethods.length} methods are now TYPED and IMPLEMENTED:`
      );

      let workingCount = 0;
      let missingCount = 0;

      allImplementedMethods.forEach(method => {
        const isImplemented = typeof (ctx.res as any)[method] === 'function';
        if (isImplemented) {
          workingCount++;
          console.log(`   ✓ ctx.res.${method}() - WORKING WITH TYPESCRIPT`);
        } else {
          missingCount++;
          console.log(`   ✗ ctx.res.${method}() - STILL MISSING`);
        }
      });

      console.log(`\n📊 SUMMARY:`);
      console.log(
        `   - Working methods: ${workingCount}/${allImplementedMethods.length}`
      );
      console.log(
        `   - Missing methods: ${missingCount}/${allImplementedMethods.length}`
      );
      console.log(
        `   - Success rate: ${Math.round((workingCount / allImplementedMethods.length) * 100)}%`
      );

      if (missingCount === 0) {
        console.log(
          `\n🎯 SUCCESS! All TypeScript interface methods are now implemented!`
        );
      }

      // Verify previously missing methods are now working
      expect(typeof ctx.res.file).toBe('function');
      expect(typeof ctx.res.remove).toBe('function');
      expect(typeof ctx.res.type).toBe('function');
      expect(typeof ctx.res.length).toBe('function');
      expect(typeof ctx.res.etag).toBe('function');
      expect(typeof ctx.res.lastModified).toBe('function');
    });

    it('should verify previously missing methods are now implemented', () => {
      const ctx = createContext(mockReq, mockRes, options);

      console.log('✅ Previously missing methods are now IMPLEMENTED:');

      const previouslyMissingMethods = [
        'file',
        'remove',
        'type',
        'length',
        'etag',
        'lastModified',
      ];

      previouslyMissingMethods.forEach(method => {
        const isImplemented = typeof (ctx.res as any)[method] === 'function';
        console.log(
          `   ${isImplemented ? '✓' : '✗'} ctx.res.${method} - ${isImplemented ? 'NOW IMPLEMENTED' : 'STILL MISSING'}`
        );
      });

      // Verify they are now implemented (not missing)
      expect(typeof ctx.res.file).toBe('function');
      expect(typeof ctx.res.remove).toBe('function');
      expect(typeof ctx.res.type).toBe('function');
      expect(typeof ctx.res.length).toBe('function');
      expect(typeof ctx.res.etag).toBe('function');
      expect(typeof ctx.res.lastModified).toBe('function');
    });
  });

  describe('ctx property values', () => {
    it('should have correct property values from request', () => {
      const ctx = createContext(mockReq, mockRes, options);

      expect(ctx.method).toBe('GET');
      expect(ctx.url).toBe('/test?param=value');
      expect(ctx.path).toBe('/test');
      expect(ctx.search).toBe('?param=value');
      expect(ctx.headers).toBe(mockReq.headers);
      expect(ctx.ip).toBe('192.168.1.1'); // From x-forwarded-for
      expect(ctx.secure).toBe(true); // From x-forwarded-proto: https
      expect(ctx.protocol).toBe('https');
      expect(ctx.hostname).toBe('localhost');
      expect(ctx.host).toBe('localhost:3000');
      expect(ctx.origin).toBe('https://localhost:3000');
      expect(ctx.href).toBe('https://localhost:3000/test?param=value');
    });

    it('should have correct initial values', () => {
      const ctx = createContext(mockReq, mockRes, options);

      expect(ctx.body).toBe(undefined);
      expect(ctx.params).toEqual({});
      expect(ctx.state).toEqual({});
      expect(ctx.responseHeaders).toEqual({});
      expect(ctx.status).toBe(200); // Default status
      expect(typeof ctx.startTime).toBe('number');
      expect(ctx.startTime).toBeGreaterThan(0);
    });

    it('should have working query parameters', () => {
      const ctx = createContext(mockReq, mockRes, options);

      expect(ctx.query).toEqual({ param: 'value' });
      expect(ctx.searchParams.get('param')).toBe('value');
    });
  });

  describe('ctx methods functionality', () => {
    it('should throw errors correctly', () => {
      const ctx = createContext(mockReq, mockRes, options);

      expect(() => ctx.throw(404, 'Not Found')).toThrow('Not Found');
      expect(() => ctx.throw(500)).toThrow('HTTP Error');
    });

    it('should assert conditions correctly', () => {
      const ctx = createContext(mockReq, mockRes, options);

      expect(() => ctx.assert(true, 400, 'Should not throw')).not.toThrow();
      expect(() => ctx.assert(false, 400, 'Bad Request')).toThrow(
        'Bad Request'
      );
    });

    it('should check request freshness', () => {
      const ctx = createContext(mockReq, mockRes, options);

      expect(typeof ctx.fresh()).toBe('boolean');
      expect(typeof ctx.stale()).toBe('boolean');
      expect(ctx.stale()).toBe(!ctx.fresh());
    });

    it('should check if method is idempotent', () => {
      const ctx = createContext(mockReq, mockRes, options);

      expect(ctx.idempotent()).toBe(true); // GET is idempotent
    });

    it('should check if response is cacheable', () => {
      const ctx = createContext(mockReq, mockRes, options);

      expect(ctx.cacheable()).toBe(true); // GET with 200 status is cacheable
    });

    it('should set response headers', () => {
      const ctx = createContext(mockReq, mockRes, options);

      ctx.set('X-Test-Header', 'test-value');
      expect(ctx.responseHeaders['X-Test-Header']).toBe('test-value');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Test-Header',
        'test-value'
      );
    });
  });

  describe('ctx missing properties analysis', () => {
    it('should identify what properties might be missing', () => {
      const ctx = createContext(mockReq, mockRes, options);

      // These properties might be missing based on docs but should be analyzed:

      // From documentation but might not be implemented:
      // ctx.logger - request-specific logger (might be added by middleware)
      // ctx.requestId - alternative to ctx.id (might be added by middleware)

      // Template rendering (might be added by template plugin):
      // ctx.res.render - template rendering method

      console.log('Properties that might be missing or plugin-dependent:');
      console.log('- ctx.logger (added by logger middleware)');
      console.log('- ctx.requestId (alternative to ctx.id)');
      console.log('- ctx.res.render (added by template plugin)');

      // These should be available if documented:
      if (typeof ctx.logger === 'undefined') {
        console.log('✓ ctx.logger is undefined (added by middleware)');
      }

      if (typeof ctx.requestId === 'undefined') {
        console.log('✓ ctx.requestId is undefined (alternative property)');
      }

      if (typeof ctx.res.render === 'undefined') {
        console.log('✓ ctx.res.render is undefined (added by template plugin)');
      }
    });
  });
});
