/**
 * Content Negotiator Unit Tests
 */

import {
  acceptsType,
  getMimeType,
  isContentType,
  parseAcceptHeader,
} from '@/core/enhancers/request/content-negotiator';
import { describe, expect, it } from 'vitest';

describe('Content Negotiator', () => {
  describe('isContentType', () => {
    it('should match JSON content type', () => {
      const headers = { 'content-type': 'application/json' };
      expect(isContentType(headers, 'json')).toBe(true);
      expect(isContentType(headers, 'application/json')).toBe(true);
    });

    it('should match HTML content type', () => {
      const headers = { 'content-type': 'text/html; charset=utf-8' };
      expect(isContentType(headers, 'html')).toBe(true);
    });

    it('should match form content type', () => {
      const headers = {
        'content-type': 'application/x-www-form-urlencoded',
      };
      expect(isContentType(headers, 'form')).toBe(true);
    });

    it('should match multipart content type', () => {
      const headers = {
        'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary',
      };
      expect(isContentType(headers, 'multipart')).toBe(true);
    });

    it('should return false for non-matching type', () => {
      const headers = { 'content-type': 'application/json' };
      expect(isContentType(headers, 'html')).toBe(false);
    });

    it('should handle missing content-type header', () => {
      expect(isContentType({}, 'json')).toBe(false);
    });

    it('should be case-insensitive', () => {
      const headers = { 'content-type': 'APPLICATION/JSON' };
      expect(isContentType(headers, 'json')).toBe(true);
    });
  });

  describe('acceptsType', () => {
    it('should return accepted type from array', () => {
      const headers = { accept: 'application/json, text/html' };
      expect(acceptsType(headers, ['json', 'html'])).toBe('json');
    });

    it('should return first matching type', () => {
      const headers = { accept: 'text/html' };
      expect(acceptsType(headers, ['json', 'html'])).toBe('html');
    });

    it('should accept wildcard', () => {
      const headers = { accept: '*/*' };
      expect(acceptsType(headers, ['json'])).toBe('json');
    });

    it('should return false when no match', () => {
      const headers = { accept: 'text/html' };
      expect(acceptsType(headers, ['json'])).toBe(false);
    });

    it('should handle single type string', () => {
      const headers = { accept: 'application/json' };
      expect(acceptsType(headers, 'json')).toBe('json');
    });

    it('should default to wildcard when no accept header', () => {
      expect(acceptsType({}, ['json'])).toBe('json');
    });
  });

  describe('getMimeType', () => {
    it('should return MIME type for known shortcuts', () => {
      expect(getMimeType('json')).toBe('application/json');
      expect(getMimeType('html')).toBe('text/html');
      expect(getMimeType('xml')).toBe('application/xml');
      expect(getMimeType('text')).toBe('text/plain');
      expect(getMimeType('form')).toBe('application/x-www-form-urlencoded');
      expect(getMimeType('multipart')).toBe('multipart/form-data');
    });

    it('should return input for unknown types', () => {
      expect(getMimeType('application/octet-stream')).toBe(
        'application/octet-stream'
      );
      expect(getMimeType('custom/type')).toBe('custom/type');
    });
  });

  describe('parseAcceptHeader', () => {
    it('should parse simple accept header', () => {
      const result = parseAcceptHeader('application/json');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'application/json', quality: 1 });
    });

    it('should parse multiple types', () => {
      const result = parseAcceptHeader('application/json, text/html');
      expect(result).toHaveLength(2);
      expect(result[0]?.type).toBe('application/json');
      expect(result[1]?.type).toBe('text/html');
    });

    it('should parse quality values', () => {
      const result = parseAcceptHeader('text/html;q=0.9, application/json;q=1.0');
      expect(result).toHaveLength(2);
      // Should be sorted by quality (highest first)
      expect(result[0]).toEqual({ type: 'application/json', quality: 1 });
      expect(result[1]).toEqual({ type: 'text/html', quality: 0.9 });
    });

    it('should sort by quality descending', () => {
      const result = parseAcceptHeader(
        'text/html;q=0.5, application/xml;q=0.9, application/json'
      );
      expect(result[0]?.type).toBe('application/json');
      expect(result[1]?.type).toBe('application/xml');
      expect(result[2]?.type).toBe('text/html');
    });

    it('should handle empty accept header', () => {
      const result = parseAcceptHeader('');
      expect(result).toEqual([{ type: '*/*', quality: 1 }]);
    });
  });
});
