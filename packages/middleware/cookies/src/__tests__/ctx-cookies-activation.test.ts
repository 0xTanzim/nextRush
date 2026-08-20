/**
 * @nextrush/cookies — `ctx.cookies` activation tests (RFC-034)
 *
 * The `cookies()` middleware activates the first-class `ctx.cookies`
 * capability (a per-request store) and attaches the deprecated
 * `ctx.state.cookies` alias. Parsing/serialization semantics are unchanged
 * from the pre-RFC-034 behavior; these tests assert the activation surface.
 */

import { describe, expect, it, vi } from 'vitest';
import { CapabilityNotInitializedError } from '@nextrush/errors';
import { UNINITIALIZED_COOKIES } from '@nextrush/runtime';
import { cookies } from '../middleware';

function createMockContext(cookieHeader?: string) {
  const responseHeaders: Record<string, string | string[]> = {};
  const ctx = {
    method: 'GET',
    url: '/',
    path: '/',
    query: {},
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    ip: '127.0.0.1',
    body: undefined,
    params: {},
    status: 200,
    state: {} as Record<string, unknown>,
    cookies: UNINITIALIZED_COOKIES,
    raw: { req: {}, res: {} },
    json: vi.fn(),
    send: vi.fn(),
    html: vi.fn(),
    redirect: vi.fn(),
    throw: vi.fn(),
    assert: vi.fn(),
    set: vi.fn((field: string, value: string | number | string[]) => {
      const key = field.toLowerCase();
      if (key === 'set-cookie' && !Array.isArray(value)) {
        const existing = responseHeaders[key];
        if (Array.isArray(existing)) {
          existing.push(String(value));
        } else {
          responseHeaders[key] = [String(value)];
        }
        return;
      }
      responseHeaders[key] = Array.isArray(value) ? value : String(value);
    }),
    get: vi.fn((field: string) => (field.toLowerCase() === 'cookie' ? cookieHeader : undefined)),
    _responseHeaders: responseHeaders,
  };
  return ctx;
}

const createNext = () => vi.fn().mockResolvedValue(undefined);

describe('cookies() activation of ctx.cookies (RFC-034)', () => {
  it('replaces the uninitialized stub with a real store', async () => {
    const ctx = createMockContext('a=1; b=2');
    expect(ctx.cookies).toBe(UNINITIALIZED_COOKIES);

    await cookies()(ctx as never, createNext());

    expect(ctx.cookies).not.toBe(UNINITIALIZED_COOKIES);
    expect(ctx.cookies.get('a')).toBe('1');
    expect(ctx.cookies.get('b')).toBe('2');
  });

  it('serves every read from a single parse', async () => {
    const ctx = createMockContext('a=1; b=2; c=3');
    await cookies()(ctx as never, createNext());

    ctx.cookies.get('a');
    ctx.cookies.get('b');
    ctx.cookies.get('c');
    expect(ctx.get).toHaveBeenCalledTimes(1);
  });

  it('joins repeated Cookie header arrays before parsing', async () => {
    const ctx = createMockContext();
    ctx.get = vi.fn(() => ['a=1', 'b=2']);
    ctx.headers = { cookie: ['a=1', 'b=2'] };
    await cookies()(ctx as never, createNext());

    expect(ctx.cookies.get('a')).toBe('1');
    expect(ctx.cookies.get('b')).toBe('2');
  });

  it('resolves duplicate names first-occurrence-wins', async () => {
    const ctx = createMockContext('session=first; session=second');
    await cookies()(ctx as never, createNext());
    expect(ctx.cookies.get('session')).toBe('first');
  });

  it('distinguishes empty value from missing cookie', async () => {
    const ctx = createMockContext('empty=');
    await cookies()(ctx as never, createNext());
    expect(ctx.cookies.get('empty')).toBe('');
    expect(ctx.cookies.has('empty')).toBe(true);
    expect(ctx.cookies.get('missing')).toBeUndefined();
  });

  it('caps parsing at 50 distinct names', async () => {
    const header = Array.from({ length: 60 }, (_, i) => `c${String(i)}=v`).join('; ');
    const ctx = createMockContext(header);
    await cookies()(ctx as never, createNext());
    expect(Object.keys(ctx.cookies.all())).toHaveLength(50);
  });

  it('read-after-write is visible within the same request', async () => {
    const ctx = createMockContext();
    await cookies()(ctx as never, createNext());
    ctx.cookies.set('a', '1');
    expect(ctx.cookies.get('a')).toBe('1');
  });

  it('delete removes the value from the request set and emits expiry', async () => {
    const ctx = createMockContext('a=1');
    await cookies()(ctx as never, createNext());

    ctx.cookies.delete('a', { path: '/' });

    expect(ctx.cookies.has('a')).toBe(false);
    const setCookies = ctx._responseHeaders['set-cookie'] as string[];
    expect(setCookies.some((c) => c.startsWith('a=') && c.includes('Max-Age=0'))).toBe(true);
  });

  it('emits Set-Cookie eagerly and accumulates multiple headers', async () => {
    const ctx = createMockContext();
    await cookies()(ctx as never, createNext());

    ctx.cookies.set('a', '1', { httpOnly: true });
    ctx.cookies.set('b', '2', { httpOnly: true });

    const setCookies = ctx._responseHeaders['set-cookie'] as string[];
    expect(setCookies).toHaveLength(2);
    expect(setCookies[0]).toContain('a=1');
    expect(setCookies[1]).toContain('b=2');
  });

  it('a non-string value becomes an empty cookie without throwing', async () => {
    const ctx = createMockContext();
    await cookies()(ctx as never, createNext());

    expect(() => ctx.cookies.set('a', { token: 'x' })).not.toThrow();
    const setCookies = ctx._responseHeaders['set-cookie'] as string[];
    expect(setCookies[0]).toMatch(/^a=;/);
  });

  it('the signed sub-slot stays uninitialized after cookies() alone', async () => {
    const ctx = createMockContext();
    await cookies()(ctx as never, createNext());
    expect(() => ctx.cookies.signed.get('u')).toThrow(CapabilityNotInitializedError);
  });
});
