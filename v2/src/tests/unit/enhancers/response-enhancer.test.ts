/**
 * Response Enhancer Tests
 *
 * @packageDocumentation
 */

import {
  ResponseEnhancer,
  type EnhancedResponse,
} from '@/core/enhancers/response-enhancer';
import type { ServerResponse } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fs module
vi.mock('node:fs', () => ({
  createReadStream: vi.fn(() => ({
    pipe: vi.fn(),
  })),
  statSync: vi.fn(() => ({
    size: 1024,
    mtime: new Date('2023-01-01'),
  })),
}));

describe('ResponseEnhancer', () => {
  let mockRes: ServerResponse;
  let enhancedRes: EnhancedResponse;

  beforeEach(() => {
    mockRes = {
      statusCode: 200,
      setHeader: vi.fn(),
      getHeader: vi.fn(),
      removeHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;

    enhancedRes = ResponseEnhancer.enhance(mockRes);
  });

  describe('Basic Properties', () => {
    it('should initialize basic properties', () => {
      expect(enhancedRes.locals).toEqual({});
    });
  });

  describe('Status Management', () => {
    it('should set status code', () => {
      const result = enhancedRes.status(201);
      expect(enhancedRes.statusCode).toBe(201);
      expect(result).toBe(enhancedRes);
    });
  });

  describe('Core Response Methods', () => {
    it('should send JSON response', () => {
      const data = { message: 'Hello World' };
      enhancedRes.json(data);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json'
      );
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify(data));
    });

    it('should send HTML response', () => {
      const html = '<h1>Hello World</h1>';
      enhancedRes.html(html);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html'
      );
      expect(mockRes.end).toHaveBeenCalledWith(html);
    });

    it('should send text response', () => {
      const text = 'Plain text';
      enhancedRes.text(text);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain'
      );
      expect(mockRes.end).toHaveBeenCalledWith(text);
    });

    it('should send XML response', () => {
      const xml = '<?xml version="1.0"?><data></data>';
      enhancedRes.xml(xml);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/xml'
      );
      expect(mockRes.end).toHaveBeenCalledWith(xml);
    });

    it('should send data with auto-detection', () => {
      // Object should be sent as JSON
      enhancedRes.send({ message: 'Hello' });
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json'
      );
      expect(mockRes.end).toHaveBeenCalledWith('{"message":"Hello"}');

      // String should be sent as-is
      enhancedRes.send('Hello World');
      expect(mockRes.end).toHaveBeenCalledWith('Hello World');
    });
  });

  describe('Enhanced Response Methods', () => {
    it('should send CSV response', () => {
      const data = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ];
      enhancedRes.csv(data, 'users.csv');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="users.csv"'
      );
    });

    it('should stream data', () => {
      const stream = { pipe: vi.fn() } as unknown as NodeJS.ReadableStream;
      enhancedRes.stream(stream, 'application/json');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json'
      );
      expect(stream.pipe).toHaveBeenCalledWith(enhancedRes);
    });
  });

  describe('File Operations', () => {
    it('should send file', () => {
      enhancedRes.sendFile('/path/to/file.txt');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Length', 1024);
    });

    it('should download file', () => {
      enhancedRes.download('/path/to/file.pdf', 'document.pdf');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="document.pdf"'
      );
    });
  });

  describe('Smart File Operations', () => {
    it('should get content type from extension', () => {
      expect(enhancedRes.getContentTypeFromExtension('.html')).toBe(
        'text/html'
      );
      expect(enhancedRes.getContentTypeFromExtension('.json')).toBe(
        'application/json'
      );
      expect(enhancedRes.getContentTypeFromExtension('.unknown')).toBe(
        'application/octet-stream'
      );
    });

    it('should generate ETag', () => {
      const stats = { size: 1024, mtime: new Date('2023-01-01') };
      const etag = enhancedRes.generateETag(stats);
      expect(etag).toMatch(/^"[a-f0-9]+"$/);
    });
  });

  describe('Redirect Methods', () => {
    it('should redirect with default status', () => {
      enhancedRes.redirect('/new-page');
      expect(enhancedRes.statusCode).toBe(302);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Location', '/new-page');
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should redirect with custom status', () => {
      enhancedRes.redirect('/new-page', 301);
      expect(enhancedRes.statusCode).toBe(301);
    });

    it('should do permanent redirect', () => {
      enhancedRes.redirectPermanent('/new-page');
      expect(enhancedRes.statusCode).toBe(301);
    });

    it('should do temporary redirect', () => {
      enhancedRes.redirectTemporary('/new-page');
      expect(enhancedRes.statusCode).toBe(307);
    });
  });

  describe('Header Management', () => {
    it('should set single header', () => {
      const result = enhancedRes.set('X-Custom-Header', 'value');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Custom-Header',
        'value'
      );
      expect(result).toBe(enhancedRes);
    });

    it('should set multiple headers', () => {
      const headers = {
        'X-Header-1': 'value1',
        'X-Header-2': 'value2',
      };
      enhancedRes.set(headers);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Header-1', 'value1');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Header-2', 'value2');
    });

    it('should get header value', () => {
      vi.mocked(mockRes.getHeader).mockReturnValue('header-value');
      const value = enhancedRes.get('X-Test-Header');
      expect(mockRes.getHeader).toHaveBeenCalledWith('X-Test-Header');
      expect(value).toBe('header-value');
    });

    it('should remove header', () => {
      // Mock the native removeHeader to return the enhanced response
      vi.mocked(mockRes.removeHeader).mockImplementation(() => enhancedRes);
      const result = enhancedRes.removeHeader('X-Test-Header');
      // The removeHeader method returns the enhanced response for chaining
      expect(result).toBe(enhancedRes);
    });
  });

  describe('Cookie Management', () => {
    it('should set cookie', () => {
      enhancedRes.cookie('sessionId', 'abc123', {
        httpOnly: true,
        secure: true,
        maxAge: 86400000,
      });
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining('sessionId=abc123')
      );
    });

    it('should clear cookie', () => {
      enhancedRes.clearCookie('sessionId');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.stringContaining('sessionId=')
      );
    });
  });

  describe('Template Rendering', () => {
    it('should render template with data', () => {
      const template = '<h1>{{title}}</h1><p>{{message}}</p>';
      const data = { title: 'Hello', message: 'World' };
      enhancedRes.render(template, data);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/html'
      );
      expect(mockRes.end).toHaveBeenCalledWith('<h1>Hello</h1><p>World</p>');
    });

    it('should render template without data', () => {
      const template = '<h1>Hello World</h1>';
      enhancedRes.render(template);
      expect(mockRes.end).toHaveBeenCalledWith('<h1>Hello World</h1>');
    });
  });

  describe('Template Helper Methods', () => {
    it('should get nested value', () => {
      const obj = { user: { profile: { name: 'John' } } };
      const value = enhancedRes.getNestedValue(obj, 'user.profile.name');
      expect(value).toBe('John');
    });

    it('should check if value is truthy', () => {
      expect(enhancedRes.isTruthy('hello')).toBe(true);
      expect(enhancedRes.isTruthy('')).toBe(false);
      expect(enhancedRes.isTruthy(0)).toBe(false);
      expect(enhancedRes.isTruthy(null)).toBe(false);
      expect(enhancedRes.isTruthy(undefined)).toBe(false);
    });
  });

  describe('Cache Control', () => {
    it('should set cache headers', () => {
      const result = enhancedRes.cache(3600);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=3600'
      );
      expect(result).toBe(enhancedRes);
    });

    it('should set no-cache headers', () => {
      const result = enhancedRes.noCache();
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-cache, no-store, must-revalidate'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Expires', '0');
      expect(result).toBe(enhancedRes);
    });
  });

  describe('CORS Support', () => {
    it('should set CORS headers with default origin', () => {
      const result = enhancedRes.cors();
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        '*'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
      );
      expect(result).toBe(enhancedRes);
    });

    it('should set CORS headers with specific origin', () => {
      enhancedRes.cors('https://example.com');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://example.com'
      );
    });
  });

  describe('Security Headers', () => {
    it('should set security headers', () => {
      const result = enhancedRes.security();
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Content-Type-Options',
        'nosniff'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-XSS-Protection',
        '1; mode=block'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Referrer-Policy',
        'strict-origin-when-cross-origin'
      );
      expect(result).toBe(enhancedRes);
    });
  });

  describe('Compression Hint', () => {
    it('should set compression header', () => {
      const result = enhancedRes.compress();
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Encoding',
        'gzip'
      );
      expect(result).toBe(enhancedRes);
    });
  });

  describe('API Response Helpers', () => {
    it('should send success response', () => {
      const data = { id: 1, name: 'John' };
      enhancedRes.success(data, 'User created successfully');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json'
      );
      const actualCall = vi.mocked(mockRes.end).mock.calls[0][0];
      const actualData = JSON.parse(actualCall as string);
      expect(actualData.success).toBe(true);
      expect(actualData.data).toEqual(data);
      expect(actualData.message).toBe('User created successfully');
      expect(actualData.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    it('should send error response', () => {
      enhancedRes.error('User not found', 404, { userId: 123 });
      expect(enhancedRes.statusCode).toBe(404);
      const actualCall = vi.mocked(mockRes.end).mock.calls[0][0];
      const actualData = JSON.parse(actualCall as string);
      expect(actualData.success).toBe(false);
      expect(actualData.error).toBe('User not found');
      expect(actualData.details).toEqual({ userId: 123 });
      expect(actualData.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    it('should send paginated response', () => {
      const data = [{ id: 1 }, { id: 2 }];
      enhancedRes.paginate(data, 1, 10, 25);
      const actualCall = vi.mocked(mockRes.end).mock.calls[0][0];
      const actualData = JSON.parse(actualCall as string);
      expect(actualData.success).toBe(true);
      expect(actualData.data).toEqual(data);
      expect(actualData.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: false,
      });
      expect(actualData.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });
  });

  describe('Content Type Utilities', () => {
    it('should get content type from extension', () => {
      expect(enhancedRes.getContentTypeFromExtension('.html')).toBe(
        'text/html'
      );
      expect(enhancedRes.getContentTypeFromExtension('.css')).toBe('text/css');
      expect(enhancedRes.getContentTypeFromExtension('.js')).toBe(
        'application/javascript'
      );
      expect(enhancedRes.getContentTypeFromExtension('.json')).toBe(
        'application/json'
      );
      expect(enhancedRes.getContentTypeFromExtension('.png')).toBe('image/png');
      expect(enhancedRes.getContentTypeFromExtension('.pdf')).toBe(
        'application/pdf'
      );
      expect(enhancedRes.getContentTypeFromExtension('.unknown')).toBe(
        'application/octet-stream'
      );
    });
  });

  describe('Performance', () => {
    it('should add timing headers', () => {
      const result = enhancedRes.time('api-call');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Response-Time',
        expect.any(String)
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Timing-Label',
        'api-call'
      );
      expect(result).toBe(enhancedRes);
    });
  });

  describe('Method Chaining', () => {
    it('should support method chaining', () => {
      const result = enhancedRes
        .status(201)
        .set('X-Custom-Header', 'value')
        .cache(3600)
        .cors()
        .security();

      expect(enhancedRes.statusCode).toBe(201);
      expect(result).toBe(enhancedRes);
    });
  });
});
