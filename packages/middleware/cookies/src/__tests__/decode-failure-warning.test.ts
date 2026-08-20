/**
 * @nextrush/cookies — custom `decode` failure warning test
 *
 * When a custom `decode` function throws, the middleware retains the
 * parser-sanitized value and continues the request (unchanged behavior),
 * but now emits a once-per-process warning so the silently-degraded decode
 * is observable (previously written to the never-read
 * `ctx.state.cookieDecodeErrors` slot).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UNINITIALIZED_COOKIES } from '@nextrush/runtime';
import { cookies } from '../middleware';
import { resetStateCookiesDeprecationWarning } from '../deprecation';

function createMockContext(cookieHeader: string) {
  return {
    method: 'GET',
    url: '/',
    path: '/',
    query: {},
    headers: { cookie: cookieHeader },
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
    set: vi.fn(),
    get: vi.fn(() => cookieHeader),
    _responseHeaders: {},
  };
}

const createNext = () => vi.fn().mockResolvedValue(undefined);

describe('cookies() custom decode failure warning', () => {
  beforeEach(() => {
    resetStateCookiesDeprecationWarning();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retains the parser-sanitized value and warns when decode throws', async () => {
    const brokenDecode = () => {
      throw new Error('decode failed');
    };

    const middleware = cookies({ decode: brokenDecode });
    const ctx = createMockContext('name=value');

    await middleware(ctx as never, createNext());

    // Value comes from parser (already sanitized) — unchanged fallback behavior.
    expect(ctx.cookies.get('name')).toBe('value');
    // The failure is now observable via a one-time warning.
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('custom decode threw for cookie "name"')
    );
  });

  it('warns about a decode failure at most once per process across requests', async () => {
    const brokenDecode = () => {
      throw new Error('decode failed');
    };
    const middleware = cookies({ decode: brokenDecode });

    await middleware(createMockContext('a=1') as never, createNext());
    await middleware(createMockContext('b=2') as never, createNext());

    const decodeWarnings = (console.warn as ReturnType<typeof vi.fn>).mock.calls.filter(([msg]) =>
      String(msg).includes('custom decode threw')
    );
    expect(decodeWarnings).toHaveLength(1);
  });
});
