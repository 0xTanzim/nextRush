/**
 * @nextrush/cookies — deprecated alias tests (RFC-034)
 *
 * `ctx.state.cookies` / `ctx.state.signedCookies` remain working aliases for
 * one release cycle, and the deprecation warning is emitted at most once per
 * process.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { UNINITIALIZED_COOKIES } from '@nextrush/runtime';
import { cookies } from '../middleware';
import { resetStateCookiesDeprecationWarning } from '../deprecation';

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

afterEach(() => {
  resetStateCookiesDeprecationWarning();
});

describe('deprecated ctx.state.cookies alias (RFC-034)', () => {
  it('the alias serves the same store as ctx.cookies', async () => {
    const ctx = createMockContext('a=1');
    await cookies()(ctx as never, createNext());

    ctx.cookies.set('b', '2');
    const alias = ctx.state.cookies as { get(name: string): string | undefined };
    expect(alias.get('a')).toBe('1');
    expect(alias.get('b')).toBe('2');
  });

  it('emits the deprecation warning exactly once per process', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const middleware = cookies();

    await middleware(createMockContext() as never, createNext());
    await middleware(createMockContext() as never, createNext());
    await middleware(createMockContext() as never, createNext());

    const deprecationCalls = warn.mock.calls.filter((args) =>
      String(args[0]).includes('ctx.state.cookies is deprecated')
    );
    expect(deprecationCalls).toHaveLength(1);
    warn.mockRestore();
  });

  it('the warning names ctx.cookies and the docs', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await cookies()(createMockContext() as never, createNext());

    const message = String(warn.mock.calls[0][0]);
    expect(message).toContain('ctx.cookies');
    expect(message).toContain('docs/reference/cookies');
    warn.mockRestore();
  });
});
