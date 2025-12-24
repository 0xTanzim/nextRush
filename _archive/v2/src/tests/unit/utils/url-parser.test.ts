/**
 * Tests for URL Parser Utility
 */

import { describe, expect, it } from 'vitest';
import {
  buildURL,
  detectProtocol,
  extractHostname,
  extractPath,
  extractSearch,
  joinPaths,
  matchesPattern,
  normalizePath,
  parseURLComponents,
} from '../../../core/utils/url-parser';

describe('URL Parser', () => {
  describe('extractPath', () => {
    it('should extract path without query string', () => {
      expect(extractPath('/users?page=1')).toBe('/users');
      expect(extractPath('/api/v1/data')).toBe('/api/v1/data');
      expect(extractPath('/')).toBe('/');
    });

    it('should handle empty and undefined input', () => {
      expect(extractPath('')).toBe('/');
      expect(extractPath(undefined as any)).toBe('/');
    });

    it('should handle paths without query string', () => {
      expect(extractPath('/users/123')).toBe('/users/123');
    });

    it('should handle complex query strings', () => {
      expect(extractPath('/search?q=hello&page=1&sort=desc')).toBe('/search');
    });
  });

  describe('extractSearch', () => {
    it('should extract query string with ?', () => {
      expect(extractSearch('/users?page=1')).toBe('?page=1');
      expect(extractSearch('/search?q=test&sort=asc')).toBe('?q=test&sort=asc');
    });

    it('should return empty string when no query', () => {
      expect(extractSearch('/users')).toBe('');
      expect(extractSearch('/')).toBe('');
    });

    it('should handle empty input', () => {
      expect(extractSearch('')).toBe('');
    });
  });

  describe('extractHostname', () => {
    it('should extract hostname without port', () => {
      expect(extractHostname('example.com:3000')).toBe('example.com');
      expect(extractHostname('localhost:8080')).toBe('localhost');
    });

    it('should return hostname when no port', () => {
      expect(extractHostname('example.com')).toBe('example.com');
      expect(extractHostname('localhost')).toBe('localhost');
    });

    it('should return default when undefined', () => {
      expect(extractHostname(undefined)).toBe('localhost');
    });
  });

  describe('detectProtocol', () => {
    it('should detect https from X-Forwarded-Proto', () => {
      const headers = { 'x-forwarded-proto': 'https' };
      expect(detectProtocol(headers, false)).toBe('https');
    });

    it('should detect https from encrypted socket', () => {
      expect(detectProtocol({}, true)).toBe('https');
    });

    it('should default to http', () => {
      expect(detectProtocol({}, false)).toBe('http');
    });

    it('should ignore proxy headers when trustProxy is false', () => {
      const headers = { 'x-forwarded-proto': 'https' };
      expect(detectProtocol(headers, false, { trustProxy: false })).toBe('http');
    });
  });

  describe('parseURLComponents', () => {
    it('should parse all URL components', () => {
      const result = parseURLComponents('/users?page=1', { host: 'example.com:3000' });

      expect(result.url).toBe('/users?page=1');
      expect(result.path).toBe('/users');
      expect(result.search).toBe('?page=1');
      expect(result.queryString).toBe('page=1');
      expect(result.hostname).toBe('example.com');
      expect(result.host).toBe('example.com:3000');
      expect(result.protocol).toBe('http');
      expect(result.secure).toBe(false);
      expect(result.origin).toBe('http://example.com:3000');
      expect(result.href).toBe('http://example.com:3000/users?page=1');
    });

    it('should handle HTTPS', () => {
      const result = parseURLComponents('/', { host: 'example.com' }, true);
      expect(result.protocol).toBe('https');
      expect(result.secure).toBe(true);
    });
  });

  describe('buildURL', () => {
    it('should build URL with query parameters', () => {
      const url = buildURL('/users', { page: '1', limit: '10' });
      expect(url).toBe('/users?page=1&limit=10');
    });

    it('should build URL with origin', () => {
      const url = buildURL('/users', { id: '123' }, 'http://localhost:3000');
      expect(url).toBe('http://localhost:3000/users?id=123');
    });

    it('should handle empty query', () => {
      const url = buildURL('/users');
      expect(url).toBe('/users');
    });

    it('should handle array values', () => {
      const url = buildURL('/search', { tags: ['a', 'b', 'c'] });
      expect(url).toBe('/search?tags=a&tags=b&tags=c');
    });

    it('should skip undefined values', () => {
      const url = buildURL('/users', { page: '1', filter: undefined });
      expect(url).toBe('/users?page=1');
    });
  });

  describe('normalizePath', () => {
    it('should remove double slashes', () => {
      expect(normalizePath('//users//')).toBe('/users');
      expect(normalizePath('/api//v1//data')).toBe('/api/v1/data');
    });

    it('should remove trailing slash', () => {
      expect(normalizePath('/users/')).toBe('/users');
    });

    it('should keep root path', () => {
      expect(normalizePath('/')).toBe('/');
    });

    it('should add leading slash', () => {
      expect(normalizePath('users')).toBe('/users');
    });

    it('should handle empty input', () => {
      expect(normalizePath('')).toBe('/');
    });
  });

  describe('joinPaths', () => {
    it('should join path segments', () => {
      expect(joinPaths('/api', 'v1', 'users')).toBe('/api/v1/users');
      expect(joinPaths('/api/', '/v1/', '/users')).toBe('/api/v1/users');
    });

    it('should handle empty segments', () => {
      expect(joinPaths('', '/api', '', 'users')).toBe('/api/users');
    });
  });

  describe('matchesPattern', () => {
    it('should match static routes', () => {
      expect(matchesPattern('/users', '/users')).toBe(true);
      expect(matchesPattern('/api/v1', '/api/v1')).toBe(true);
    });

    it('should match parameterized routes', () => {
      expect(matchesPattern('/users/:id', '/users/123')).toBe(true);
      expect(matchesPattern('/api/:version/users/:id', '/api/v1/users/456')).toBe(true);
    });

    it('should not match different lengths', () => {
      expect(matchesPattern('/users/:id', '/users')).toBe(false);
      expect(matchesPattern('/users', '/users/123')).toBe(false);
    });

    it('should not match different paths', () => {
      expect(matchesPattern('/users', '/posts')).toBe(false);
    });
  });
});
