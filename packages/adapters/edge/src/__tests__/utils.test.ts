/**
 * @nextrush/adapter-edge - Utils Tests
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
    detectEdgeRuntime,
    getContentLength,
    getContentType,
    parseQueryString,
} from '../utils';

describe('parseQueryString', () => {
  it('should parse simple query string', () => {
    const result = parseQueryString('name=John&age=30');
    expect(result).toEqual({ name: 'John', age: '30' });
  });

  it('should return empty object for empty string', () => {
    const result = parseQueryString('');
    expect(result).toEqual({});
  });

  it('should decode URI components', () => {
    const result = parseQueryString('name=John%20Doe&city=New%20York');
    expect(result).toEqual({ name: 'John Doe', city: 'New York' });
  });

  it('should handle keys without values', () => {
    const result = parseQueryString('key=');
    expect(result).toEqual({ key: '' });
  });

  it('should handle multiple values for same key', () => {
    const result = parseQueryString('tag=a&tag=b&tag=c');
    expect(result).toEqual({ tag: ['a', 'b', 'c'] });
  });

  it('should handle special characters', () => {
    const result = parseQueryString('email=test%40example.com');
    expect(result).toEqual({ email: 'test@example.com' });
  });

  it('should handle keys without equals sign', () => {
    const result = parseQueryString('key');
    expect(result).toEqual({ key: '' });
  });

  it('should skip empty keys', () => {
    const result = parseQueryString('=value&key=test');
    expect(result).toEqual({ key: 'test' });
  });
});

describe('detectEdgeRuntime', () => {
  const originalNavigator = globalThis.navigator;
  const originalProcess = globalThis.process;
  const originalDeno = (globalThis as { Deno?: unknown }).Deno;

  afterEach(() => {
    // Restore original globals
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    (globalThis as { process?: unknown }).process = originalProcess;
    (globalThis as { Deno?: unknown }).Deno = originalDeno;
  });

  it('should detect generic edge runtime by default', () => {
    const info = detectEdgeRuntime();
    expect(info.runtime).toBe('edge');
    expect(info.isGenericEdge).toBe(true);
    expect(info.isCloudflare).toBe(false);
    expect(info.isVercel).toBe(false);
    expect(info.isNetlify).toBe(false);
  });

  it('should detect Cloudflare Workers', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Cloudflare-Workers' },
      writable: true,
      configurable: true,
    });

    const info = detectEdgeRuntime();
    expect(info.runtime).toBe('cloudflare-workers');
    expect(info.isCloudflare).toBe(true);
    expect(info.isGenericEdge).toBe(false);
  });

  it('should detect Vercel Edge', () => {
    (globalThis as { process?: { env?: { VERCEL_REGION?: string } } }).process = {
      env: { VERCEL_REGION: 'iad1' },
    };

    const info = detectEdgeRuntime();
    expect(info.runtime).toBe('vercel-edge');
    expect(info.isVercel).toBe(true);
    expect(info.isGenericEdge).toBe(false);
  });

  it('should detect Netlify Edge', () => {
    (globalThis as { Deno?: unknown }).Deno = {};
    (globalThis as { process?: { env?: { NETLIFY?: string } } }).process = {
      env: { NETLIFY: 'true' },
    };

    const info = detectEdgeRuntime();
    expect(info.isNetlify).toBe(true);
  });
});

describe('getContentType', () => {
  it('should return content-type header value', () => {
    const headers = new Headers({ 'content-type': 'application/json' });
    expect(getContentType(headers)).toBe('application/json');
  });

  it('should return undefined when header is missing', () => {
    const headers = new Headers();
    expect(getContentType(headers)).toBeUndefined();
  });
});

describe('getContentLength', () => {
  it('should return content-length as number', () => {
    const headers = new Headers({ 'content-length': '1024' });
    expect(getContentLength(headers)).toBe(1024);
  });

  it('should return undefined when header is missing', () => {
    const headers = new Headers();
    expect(getContentLength(headers)).toBeUndefined();
  });

  it('should return undefined for invalid number', () => {
    const headers = new Headers({ 'content-length': 'invalid' });
    expect(getContentLength(headers)).toBeUndefined();
  });
});
