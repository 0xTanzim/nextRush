/**
 * @nextrush/adapter-node - Utility Tests
 */

import { describe, expect, it } from 'vitest';
import { getContentLength, getContentType, parseQueryString } from '../utils';

describe('parseQueryString', () => {
  it('should parse simple query string', () => {
    const result = parseQueryString('a=1&b=2');

    expect(result).toEqual({ a: '1', b: '2' });
  });

  it('should handle empty string', () => {
    const result = parseQueryString('');

    expect(result).toEqual({});
  });

  it('should handle key without value', () => {
    const result = parseQueryString('flag');

    expect(result).toEqual({ flag: '' });
  });

  it('should handle URL encoded values', () => {
    const result = parseQueryString('q=hello%20world');

    expect(result).toEqual({ q: 'hello world' });
  });

  it('should handle multiple same keys as array', () => {
    const result = parseQueryString('color=red&color=blue');

    expect(result).toEqual({ color: ['red', 'blue'] });
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
    const result = parseQueryString('a=&b=2');

    expect(result).toEqual({ a: '', b: '2' });
  });
});

describe('getContentLength', () => {
  it('should parse content-length header', () => {
    const result = getContentLength({ 'content-length': '100' });

    expect(result).toBe(100);
  });

  it('should return undefined for missing header', () => {
    const result = getContentLength({});

    expect(result).toBeUndefined();
  });

  it('should return undefined for non-numeric value', () => {
    const result = getContentLength({ 'content-length': 'abc' });

    expect(result).toBeUndefined();
  });
});

describe('getContentType', () => {
  it('should parse content-type header', () => {
    const result = getContentType({ 'content-type': 'application/json' });

    expect(result).toBe('application/json');
  });

  it('should strip charset from content-type', () => {
    const result = getContentType({ 'content-type': 'text/html; charset=utf-8' });

    expect(result).toBe('text/html');
  });

  it('should return undefined for missing header', () => {
    const result = getContentType({});

    expect(result).toBeUndefined();
  });
});
