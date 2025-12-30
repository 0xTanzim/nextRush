/**
 * @nextrush/adapter-bun - Utils Tests
 */

import { describe, expect, it } from 'vitest';
import { getContentLength, getContentType, parseQueryString } from '../utils';

describe('parseQueryString', () => {
  it('should parse simple query string', () => {
    const result = parseQueryString('name=John&age=30');
    expect(result).toEqual({ name: 'John', age: '30' });
  });

  it('should handle empty string', () => {
    const result = parseQueryString('');
    expect(result).toEqual({});
  });

  it('should handle key without value', () => {
    const result = parseQueryString('enabled&name=test');
    expect(result).toEqual({ enabled: '', name: 'test' });
  });

  it('should handle URL encoded values', () => {
    const result = parseQueryString('name=John%20Doe&city=New%20York');
    expect(result).toEqual({ name: 'John Doe', city: 'New York' });
  });

  it('should handle multiple same keys as array', () => {
    const result = parseQueryString('color=red&color=blue&color=green');
    expect(result).toEqual({ color: ['red', 'blue', 'green'] });
  });

  it('should handle complex query string', () => {
    const result = parseQueryString('page=1&limit=10&sort=name&order=asc');
    expect(result).toEqual({
      page: '1',
      limit: '10',
      sort: 'name',
      order: 'asc',
    });
  });

  it('should handle empty values', () => {
    const result = parseQueryString('name=&email=test@example.com');
    expect(result).toEqual({ name: '', email: 'test@example.com' });
  });

  it('should handle special characters', () => {
    const result = parseQueryString('email=test%40example.com');
    expect(result).toEqual({ email: 'test@example.com' });
  });
});

describe('getContentLength', () => {
  it('should return content-length from headers', () => {
    const headers = new Headers({ 'content-length': '100' });
    expect(getContentLength(headers)).toBe(100);
  });

  it('should return undefined for missing header', () => {
    const headers = new Headers();
    expect(getContentLength(headers)).toBeUndefined();
  });

  it('should return undefined for non-numeric value', () => {
    const headers = new Headers({ 'content-length': 'invalid' });
    expect(getContentLength(headers)).toBeUndefined();
  });

  it('should handle zero', () => {
    const headers = new Headers({ 'content-length': '0' });
    expect(getContentLength(headers)).toBe(0);
  });
});

describe('getContentType', () => {
  it('should return content-type from headers', () => {
    const headers = new Headers({ 'content-type': 'application/json' });
    expect(getContentType(headers)).toBe('application/json');
  });

  it('should return full content-type with charset', () => {
    const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' });
    expect(getContentType(headers)).toBe('application/json; charset=utf-8');
  });

  it('should return undefined for missing header', () => {
    const headers = new Headers();
    expect(getContentType(headers)).toBeUndefined();
  });

  it('should handle multipart content type', () => {
    const headers = new Headers({ 'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary' });
    expect(getContentType(headers)).toBe('multipart/form-data; boundary=----WebKitFormBoundary');
  });
});
