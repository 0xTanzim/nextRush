/**
 * @nextrush/cookies — `ctx.cookies.signed` activation tests (RFC-034)
 *
 * The `signedCookies()` middleware activates the `ctx.cookies.signed`
 * sub-capability, requires `cookies()` to have run first, and enforces the
 * 10-key rotation bound at configuration time.
 */

import { describe, expect, it, vi } from 'vitest';
import { CapabilityNotInitializedError } from '@nextrush/errors';
import { UNINITIALIZED_COOKIES } from '@nextrush/runtime';
import { cookies, signedCookies } from '../middleware';

const SECRET = 'test-secret-0123456789';
const OLD_SECRET = 'old-secret-9876543210';

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

describe('signedCookies() activation of ctx.cookies.signed (RFC-034)', () => {
  it('round-trips a signed cookie within the request', async () => {
    const ctx = createMockContext();
    await cookies()(ctx as never, createNext());
    await signedCookies({ secret: SECRET })(ctx as never, createNext());

    await ctx.cookies.signed.set('user', 'u1');
    await expect(ctx.cookies.signed.get('user')).resolves.toBe('u1');
  });

  it('returns undefined for a tampered signed value', async () => {
    const ctx = createMockContext();
    await cookies()(ctx as never, createNext());
    await signedCookies({ secret: SECRET })(ctx as never, createNext());

    await ctx.cookies.signed.set('user', 'u1');
    const wire = (ctx._responseHeaders['set-cookie'] as string[])[0];
    const tampered = `${wire.replace(/^user=/, 'user=FORGED')}`;
    // Present a corrupted value directly in a fresh request.
    const ctx2 = createMockContext(tampered.split(';')[0]);
    await cookies()(ctx2 as never, createNext());
    await signedCookies({ secret: SECRET })(ctx2 as never, createNext());
    await expect(ctx2.cookies.signed.get('user')).resolves.toBeUndefined();
  });

  it('binds the signature to the cookie name', async () => {
    const ctx = createMockContext();
    await cookies()(ctx as never, createNext());
    await signedCookies({ secret: SECRET })(ctx as never, createNext());

    await ctx.cookies.signed.set('tier', 'premium');
    const wire = (ctx._responseHeaders['set-cookie'] as string[])[0];

    // Present the value signed for `tier` under the name `role`.
    const crossName = wire.replace(/^tier=/, 'role=');
    const ctx2 = createMockContext(crossName.split(';')[0]);
    await cookies()(ctx2 as never, createNext());
    await signedCookies({ secret: SECRET })(ctx2 as never, createNext());
    await expect(ctx2.cookies.signed.get('role')).resolves.toBeUndefined();
  });

  it('verifies with a previous secret during rotation, signs with current', async () => {
    const ctx = createMockContext();
    await cookies()(ctx as never, createNext());
    await signedCookies({ secret: OLD_SECRET })(ctx as never, createNext());
    await ctx.cookies.signed.set('user', 'u1');
    const wire = (ctx._responseHeaders['set-cookie'] as string[])[0];

    const ctx2 = createMockContext(wire.split(';')[0]);
    await cookies()(ctx2 as never, createNext());
    await signedCookies({ secret: SECRET, previousSecrets: [OLD_SECRET] })(ctx2 as never, createNext());
    await expect(ctx2.cookies.signed.get('user')).resolves.toBe('u1');
  });

  it('throws COOKIES_NOT_INITIALIZED when cookies() never ran', async () => {
    const ctx = createMockContext();
    const middleware = signedCookies({ secret: SECRET });
    await expect(middleware(ctx as never, createNext())).rejects.toThrow(
      CapabilityNotInitializedError
    );
    await expect(middleware(ctx as never, createNext())).rejects.toThrowError(
      expect.objectContaining({ code: 'COOKIES_NOT_INITIALIZED' })
    );
  });

  it('rejects more than 10 previous secrets at configuration time', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `secret-${String(i)}`);
    expect(() =>
      signedCookies({ secret: SECRET, previousSecrets: eleven })
    ).toThrow();
  });

  it('accepts exactly 10 previous secrets', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `secret-${String(i)}`);
    expect(() => signedCookies({ secret: SECRET, previousSecrets: ten })).not.toThrow();
  });
});
