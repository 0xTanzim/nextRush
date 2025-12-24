/**
 * Cache Control Unit Tests
 */

import {
  setCache,
  setCacheControl,
  setContentLength,
  setContentType,
  setCorsHeaders,
  setETag,
  setLastModified,
  setNoCache,
  setSecurityHeaders,
} from '@/core/enhancers/response/cache-control';
import type { ServerResponse } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Cache Control', () => {
  let mockRes: ServerResponse;
  const headers: Record<string, string> = {};

  beforeEach(() => {
    for (const key of Object.keys(headers)) {
      delete headers[key];
    }
    mockRes = {
      setHeader: vi.fn((key: string, value: string) => {
        headers[key] = value;
      }),
    } as unknown as ServerResponse;
  });

  describe('setCacheControl', () => {
    it('should set max-age directive', () => {
      setCacheControl(mockRes, { maxAge: 3600 });
      expect(headers['Cache-Control']).toContain('max-age=3600');
    });

    it('should set public directive', () => {
      setCacheControl(mockRes, { public: true, maxAge: 3600 });
      expect(headers['Cache-Control']).toContain('public');
    });

    it('should set private directive', () => {
      setCacheControl(mockRes, { private: true, maxAge: 3600 });
      expect(headers['Cache-Control']).toContain('private');
    });

    it('should set immutable directive', () => {
      setCacheControl(mockRes, { maxAge: 31536000, immutable: true });
      expect(headers['Cache-Control']).toContain('immutable');
    });

    it('should set no-cache and no-store', () => {
      setCacheControl(mockRes, { noCache: true, noStore: true });
      expect(headers['Cache-Control']).toContain('no-cache');
      expect(headers['Cache-Control']).toContain('no-store');
    });

    it('should set must-revalidate', () => {
      setCacheControl(mockRes, { mustRevalidate: true });
      expect(headers['Cache-Control']).toContain('must-revalidate');
    });

    it('should set stale-while-revalidate', () => {
      setCacheControl(mockRes, { maxAge: 3600, staleWhileRevalidate: 86400 });
      expect(headers['Cache-Control']).toContain('stale-while-revalidate=86400');
    });

    it('should set stale-if-error', () => {
      setCacheControl(mockRes, { maxAge: 3600, staleIfError: 86400 });
      expect(headers['Cache-Control']).toContain('stale-if-error=86400');
    });
  });

  describe('setCache', () => {
    it('should set cache for specified duration', () => {
      setCache(mockRes, 3600);
      expect(headers['Cache-Control']).toContain('max-age=3600');
      expect(headers['Cache-Control']).toContain('public');
    });
  });

  describe('setNoCache', () => {
    it('should set no-cache headers', () => {
      setNoCache(mockRes);
      expect(headers['Cache-Control']).toContain('no-cache');
      expect(headers['Cache-Control']).toContain('no-store');
      expect(headers['Cache-Control']).toContain('must-revalidate');
      expect(headers['Pragma']).toBe('no-cache');
      expect(headers['Expires']).toBe('0');
    });
  });

  describe('setSecurityHeaders', () => {
    it('should set default security headers', () => {
      setSecurityHeaders(mockRes);
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should allow custom frame options', () => {
      setSecurityHeaders(mockRes, { frameOptions: 'SAMEORIGIN' });
      expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    });

    it('should disable headers when set to false', () => {
      setSecurityHeaders(mockRes, { frameOptions: false, contentTypeOptions: false });
      expect(headers['X-Frame-Options']).toBeUndefined();
      expect(headers['X-Content-Type-Options']).toBeUndefined();
    });

    it('should set CSP when provided', () => {
      setSecurityHeaders(mockRes, {
        contentSecurityPolicy: "default-src 'self'",
      });
      expect(headers['Content-Security-Policy']).toBe("default-src 'self'");
    });

    it('should set HSTS when provided', () => {
      setSecurityHeaders(mockRes, {
        hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      });
      expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
      expect(headers['Strict-Transport-Security']).toContain('includeSubDomains');
      expect(headers['Strict-Transport-Security']).toContain('preload');
    });
  });

  describe('setCorsHeaders', () => {
    it('should set default CORS headers', () => {
      setCorsHeaders(mockRes);
      expect(headers['Access-Control-Allow-Origin']).toBe('*');
      expect(headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(headers['Access-Control-Allow-Headers']).toContain('Content-Type');
    });

    it('should allow custom origin', () => {
      setCorsHeaders(mockRes, 'https://example.com');
      expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
    });

    it('should allow custom methods', () => {
      setCorsHeaders(mockRes, '*', ['GET', 'POST']);
      expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST');
    });

    it('should allow custom headers', () => {
      setCorsHeaders(mockRes, '*', ['GET'], ['X-Custom-Header']);
      expect(headers['Access-Control-Allow-Headers']).toBe('X-Custom-Header');
    });
  });

  describe('setETag', () => {
    it('should set ETag header', () => {
      setETag(mockRes, '"abc123"');
      expect(headers['ETag']).toBe('"abc123"');
    });
  });

  describe('setLastModified', () => {
    it('should set Last-Modified header', () => {
      const date = new Date('2024-01-15T00:00:00Z');
      setLastModified(mockRes, date);
      expect(headers['Last-Modified']).toBe('Mon, 15 Jan 2024 00:00:00 GMT');
    });
  });

  describe('setContentType', () => {
    it('should set Content-Type header', () => {
      setContentType(mockRes, 'application/json');
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('setContentLength', () => {
    it('should set Content-Length header', () => {
      setContentLength(mockRes, 1024);
      expect(headers['Content-Length']).toBe('1024');
    });
  });
});
