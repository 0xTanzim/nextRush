/**
 * @nextrush/cookies - Parser Tests
 *
 * Tests for cookie parsing functionality.
 */

import { describe, expect, it } from 'vitest';
import { getCookie, getCookieNames, hasCookie, parseCookies } from '../parser.js';

describe('parseCookies', () => {
  it('should parse simple cookies', () => {
    const cookies = parseCookies('name=value');
    expect(cookies).toEqual({ name: 'value' });
  });

  it('should parse multiple cookies', () => {
    const cookies = parseCookies('name1=value1; name2=value2; name3=value3');
    expect(cookies).toEqual({
      name1: 'value1',
      name2: 'value2',
      name3: 'value3'
    });
  });

  it('should handle whitespace', () => {
    const cookies = parseCookies('name1=value1;  name2=value2 ; name3=value3');
    expect(cookies).toEqual({
      name1: 'value1',
      name2: 'value2',
      name3: 'value3'
    });
  });

  it('should handle empty values', () => {
    const cookies = parseCookies('empty=');
    expect(cookies).toEqual({ empty: '' });
  });

  it('should handle values with equals sign', () => {
    const cookies = parseCookies('token=abc=123=xyz');
    expect(cookies).toEqual({ token: 'abc=123=xyz' });
  });

  it('should decode URL-encoded values', () => {
    const cookies = parseCookies('data=hello%20world');
    expect(cookies).toEqual({ data: 'hello world' });
  });

  it('should handle quoted values', () => {
    const cookies = parseCookies('quoted="hello world"');
    expect(cookies).toEqual({ quoted: 'hello world' });
  });

  it('should return empty object for null/undefined', () => {
    expect(parseCookies(null)).toEqual({});
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('')).toEqual({});
  });

  it('should use first occurrence for duplicate names', () => {
    const cookies = parseCookies('name=first; name=second');
    expect(cookies).toEqual({ name: 'first' });
  });

  it('should skip invalid pairs', () => {
    const cookies = parseCookies('valid=value; invalid; another=test');
    expect(cookies).toEqual({ valid: 'value', another: 'test' });
  });

  it('should handle special characters in values', () => {
    const cookies = parseCookies('special=a+b&c');
    expect(cookies).toEqual({ special: 'a+b&c' });
  });

  it('should skip decoding when disabled', () => {
    const cookies = parseCookies('data=hello%20world', { decode: false });
    expect(cookies).toEqual({ data: 'hello%20world' });
  });

  it('should sanitize values by default', () => {
    const cookies = parseCookies('evil=hello%0d%0aworld');
    expect(cookies.evil).not.toContain('\r');
    expect(cookies.evil).not.toContain('\n');
  });

  it('should skip sanitizing when disabled', () => {
    const cookies = parseCookies('test=hello\nworld', { sanitize: false });
    expect(cookies.test).toBe('hello\nworld');
  });

  it('should handle malformed URL encoding gracefully', () => {
    const cookies = parseCookies('bad=%invalid%');
    expect(cookies).toEqual({ bad: '%invalid%' });
  });
});

describe('getCookie', () => {
  it('should get a single cookie value', () => {
    expect(getCookie('name=value', 'name')).toBe('value');
  });

  it('should return undefined for missing cookie', () => {
    expect(getCookie('name=value', 'other')).toBeUndefined();
  });

  it('should return undefined for empty header', () => {
    expect(getCookie('', 'name')).toBeUndefined();
    expect(getCookie(null, 'name')).toBeUndefined();
  });

  it('should get correct cookie from multiple', () => {
    const header = 'a=1; b=2; c=3';
    expect(getCookie(header, 'a')).toBe('1');
    expect(getCookie(header, 'b')).toBe('2');
    expect(getCookie(header, 'c')).toBe('3');
  });
});

describe('hasCookie', () => {
  it('should return true for existing cookie', () => {
    expect(hasCookie('name=value', 'name')).toBe(true);
  });

  it('should return false for missing cookie', () => {
    expect(hasCookie('name=value', 'other')).toBe(false);
  });

  it('should return false for empty header', () => {
    expect(hasCookie('', 'name')).toBe(false);
    expect(hasCookie(null, 'name')).toBe(false);
  });

  it('should return true for empty value cookies', () => {
    expect(hasCookie('empty=', 'empty')).toBe(true);
  });
});

describe('getCookieNames', () => {
  it('should return all cookie names', () => {
    const names = getCookieNames('a=1; b=2; c=3');
    expect(names).toEqual(['a', 'b', 'c']);
  });

  it('should return empty array for empty header', () => {
    expect(getCookieNames('')).toEqual([]);
    expect(getCookieNames(null)).toEqual([]);
  });

  it('should return single name', () => {
    expect(getCookieNames('only=one')).toEqual(['only']);
  });
});
