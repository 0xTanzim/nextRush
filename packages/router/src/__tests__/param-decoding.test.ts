/**
 * @nextrush/router - Param decoding & the `decode` option
 *
 * By default the router percent-decodes param and wildcard values (like Express,
 * Koa, Hono, find-my-way). `decode: false` opts out and preserves raw values.
 * Malformed encoding never throws — the raw value is returned.
 */

import type { RouteHandler } from '@nextrush/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, Router } from '../router';

const h = (): RouteHandler => vi.fn();

describe('param decoding — default (decode: true)', () => {
  let router: Router;
  beforeEach(() => {
    router = createRouter();
  });

  it('decodes a percent-encoded space', () => {
    router.get('/u/:name', h());
    expect(router.match('GET', '/u/hello%20world')?.params.name).toBe('hello world');
  });

  it('decodes percent-encoded unicode', () => {
    router.get('/u/:name', h());
    expect(router.match('GET', '/u/jos%C3%A9')?.params.name).toBe('josé');
  });

  it('leaves an unencoded value unchanged (fast path)', () => {
    router.get('/u/:name', h());
    expect(router.match('GET', '/u/plain-value.txt')?.params.name).toBe('plain-value.txt');
  });

  it('decodes reserved characters like %2F inside a single param', () => {
    router.get('/u/:name', h());
    expect(router.match('GET', '/u/a%2Fb')?.params.name).toBe('a/b');
  });

  it('decodes the wildcard remainder', () => {
    router.get('/s/*', h());
    expect(router.match('GET', '/s/a%20b/c')?.params['*']).toBe('a b/c');
  });

  it('returns the raw value on malformed encoding without throwing', () => {
    router.get('/u/:name', h());
    expect(() => router.match('GET', '/u/%E0%A4%A')).not.toThrow();
    expect(router.match('GET', '/u/%E0%A4%A')?.params.name).toBe('%E0%A4%A');
  });

  it('decodes params in case-insensitive mode while preserving decoded case', () => {
    router.get('/u/:name', h());
    expect(router.match('GET', '/u/Hello%20World')?.params.name).toBe('Hello World');
  });

  it('decodes each param independently in a multi-param route', () => {
    router.get('/:a/:b', h());
    expect(router.match('GET', '/a%20b/c%2Fd')?.params).toEqual({ a: 'a b', b: 'c/d' });
  });
});

describe('param decoding — opt-out (decode: false)', () => {
  let router: Router;
  beforeEach(() => {
    router = createRouter({ decode: false });
  });

  it('preserves the raw percent-encoded param value', () => {
    router.get('/u/:name', h());
    expect(router.match('GET', '/u/hello%20world')?.params.name).toBe('hello%20world');
  });

  it('preserves the raw wildcard remainder', () => {
    router.get('/s/*', h());
    expect(router.match('GET', '/s/a%20b')?.params['*']).toBe('a%20b');
  });
});
