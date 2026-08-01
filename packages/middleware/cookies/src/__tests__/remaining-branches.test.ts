/**
 * @nextrush/cookies - Remaining branch coverage (task 6.10 gate)
 *
 * Closes coverage gaps left after the main SEC-07/SEC-08/SEC-18 test files:
 * `normalizeSameSite`'s boolean branches, `isTransportEncrypted`'s
 * `req.encrypted` fallback and array-header forwarded-proto parsing,
 * `splitNewFormat`/`splitLegacyFormat`'s malformed-input branches, and the
 * signed-cookie middleware's array-valued Cookie header path (mirroring the
 * plain `cookies()` middleware's CK-9 coverage).
 */

import { describe, expect, it } from 'vitest';
import type { Context, Middleware } from '@nextrush/types';
import { serializeCookie } from '../serializer.js';
import { resolveSecureOption } from '../secure-resolution.js';
import { splitLegacyFormat, splitNewFormat } from '../signing-message.js';
import { signedCookies } from '../signed-middleware.js';
import type { SignedCookieContext } from '../middleware-types.js';

describe('normalizeSameSite boolean forms', () => {
  it('serializes sameSite: true as SameSite=Strict', () => {
    const cookie = serializeCookie('name', 'value', { sameSite: true });
    expect(cookie).toMatch(/SameSite=Strict/);
  });

  it('serializes sameSite: false as SameSite=None', () => {
    const cookie = serializeCookie('name', 'value', { sameSite: false, secure: true });
    expect(cookie).toMatch(/SameSite=None/);
  });
});

describe('resolveSecureOption transport detection edge cases', () => {
  function contextWith(raw: unknown, ip: string, headers: Record<string, string> = {}) {
    return {
      ip,
      headers,
      get(name: string) {
        return headers[name.toLowerCase()];
      },
      raw,
    } as unknown as Context;
  }

  it('recognizes req.encrypted (not just req.socket.encrypted) as TLS', () => {
    const ctx = contextWith({ req: { encrypted: true } }, '203.0.113.5');
    expect(resolveSecureOption(ctx, {}, false)).toBe(true);
  });

  it('falls through to loopback carve-out when raw.req is absent entirely', () => {
    const ctx = contextWith(undefined, '127.0.0.1');
    expect(resolveSecureOption(ctx, {}, false)).toBe(false);
  });

  it('reads a forwarded-proto claim from an array header via ctx.headers fallback', () => {
    const ctx = {
      ip: '203.0.113.5',
      headers: { 'x-forwarded-proto': ['https', 'http'] },
      get() {
        return undefined;
      },
      raw: { req: {} },
    } as unknown as Context;
    expect(resolveSecureOption(ctx, {}, true)).toBe(true);
  });
});

describe('splitNewFormat malformed-input branches', () => {
  it('rejects a value with no separator at all', () => {
    expect(splitNewFormat('novalueseparator')).toBeUndefined();
  });

  it('rejects a value with only one separator (no issuedAt segment)', () => {
    expect(splitNewFormat('value.signature')).toBeUndefined();
  });

  it('rejects a value whose issuedAt segment is not all digits', () => {
    expect(splitNewFormat('value.notanumber.signature')).toBeUndefined();
  });

  it('rejects a value with an empty signature segment', () => {
    expect(splitNewFormat('value.123.')).toBeUndefined();
  });

  it('rejects a value with an empty value segment', () => {
    expect(splitNewFormat('.123.signature')).toBeUndefined();
  });
});

describe('splitLegacyFormat malformed-input branches', () => {
  it('rejects a value with no separator', () => {
    expect(splitLegacyFormat('novalueseparator')).toBeUndefined();
  });

  it('rejects a value with an empty signature segment', () => {
    expect(splitLegacyFormat('value.')).toBeUndefined();
  });

  it('rejects a value with an empty value segment', () => {
    expect(splitLegacyFormat('.signature')).toBeUndefined();
  });

  it('splits a well-formed legacy value', () => {
    expect(splitLegacyFormat('value.signature')).toEqual({
      value: 'value',
      signature: 'signature',
    });
  });
});

describe('signedCookies middleware: array-valued Cookie header (CK-9 parity)', () => {
  it('parses signed cookies when the Cookie header arrives as an array', async () => {
    const middleware: Middleware = signedCookies({ secret: 'secret' });
    const state: Record<string, unknown> = {};
    const ctx = {
      method: 'GET',
      headers: { cookie: ['a=1', 'b=2'] },
      state,
      get: () => undefined,
      set: () => undefined,
    } as unknown as Context;

    await middleware(ctx, async () => {
      /* no-op next */
    });

    const api = state.signedCookies as SignedCookieContext;
    // Neither value is a valid signed format, so both resolve to undefined —
    // this exercises the array-join parse path, not signature verification.
    await expect(api.get('a')).resolves.toBeUndefined();
    await expect(api.get('b')).resolves.toBeUndefined();
  });
});
