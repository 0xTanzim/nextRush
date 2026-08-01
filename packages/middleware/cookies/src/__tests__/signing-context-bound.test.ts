/**
 * @nextrush/cookies - Context-bound signature tests (SEC-07, RFC-031)
 *
 * RED tests for tasks 6.1-6.5: name-bound signing, embedded expiry, legacy
 * rotation, and separator round-tripping. Written before any implementation
 * change — see openspec/changes/harden-security-boundaries/tasks.md §6.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearKeyCache,
  resetLegacyAcceptanceWarning,
  signCookie,
  unsignCookie,
  unsignCookieWithRotation,
} from '../signing.js';

afterEach(() => {
  clearKeyCache();
  resetLegacyAcceptanceWarning();
});

describe('SEC-07: name-bound signatures', () => {
  it('rejects a value signed for one cookie name when presented under another', async () => {
    const signed = await signCookie('tier', 'premium', 'secret');
    const result = await unsignCookie('user', signed, 'secret');
    expect(result).toBeUndefined();
  });

  it('verifies when the same name is used at sign and verify time', async () => {
    const signed = await signCookie('tier', 'premium', 'secret');
    const result = await unsignCookie('tier', signed, 'secret');
    expect(result).toBe('premium');
  });

  it('rejects when the name differs by case (names are not folded)', async () => {
    const signed = await signCookie('Tier', 'premium', 'secret');
    const result = await unsignCookie('tier', signed, 'secret');
    expect(result).toBeUndefined();
  });
});

describe('SEC-07: embedded expiry', () => {
  it('rejects a signed payload past its configured maxAge', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const signed = await signCookie('session', 'abc', 'secret', { maxAge: 10 });
    vi.setSystemTime(11_001);
    const result = await unsignCookie('session', signed, 'secret', { maxAge: 10 });
    expect(result).toBeUndefined();
    vi.useRealTimers();
  });

  it('accepts a signed payload within its configured maxAge', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const signed = await signCookie('session', 'abc', 'secret', { maxAge: 10 });
    vi.setSystemTime(9_000);
    const result = await unsignCookie('session', signed, 'secret', { maxAge: 10 });
    expect(result).toBe('abc');
    vi.useRealTimers();
  });

  it('does not enforce expiry when maxAge is not passed at verify time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const signed = await signCookie('session', 'abc', 'secret', { maxAge: 10 });
    vi.setSystemTime(999_999);
    const result = await unsignCookie('session', signed, 'secret');
    expect(result).toBe('abc');
    vi.useRealTimers();
  });
});

describe('SEC-07: separator round-trip', () => {
  it('round-trips a value containing the signature separator character byte-for-byte', async () => {
    const original = 'user.data.here';
    const signed = await signCookie('session', original, 'secret');
    const result = await unsignCookie('session', signed, 'secret');
    expect(result).toBe(original);
  });

  it('round-trips a value that looks like a numeric issuedAt segment', async () => {
    const original = '1700000000000';
    const signed = await signCookie('session', original, 'secret');
    const result = await unsignCookie('session', signed, 'secret');
    expect(result).toBe(original);
  });

  it('round-trips a value containing multiple consecutive separators', async () => {
    const original = 'a...b';
    const signed = await signCookie('session', original, 'secret');
    const result = await unsignCookie('session', signed, 'secret');
    expect(result).toBe(original);
  });
});

describe('SEC-07: legacy value-only signature rejection', () => {
  it('rejects a legacy (bare-value HMAC) signature by default', async () => {
    // Simulate a cookie signed under the pre-RFC-031 format: HMAC(value) with
    // no name/issuedAt binding. We reconstruct it via the crypto primitives
    // directly to avoid depending on removed code.
    const legacySigned = await legacySignForTest('hello', 'secret');
    const result = await unsignCookie('session', legacySigned, 'secret');
    expect(result).toBeUndefined();
  });

  it('accepts a legacy signature only when acceptLegacySignatures is explicitly set', async () => {
    const legacySigned = await legacySignForTest('hello', 'secret');
    const result = await unsignCookie('session', legacySigned, 'secret', {
      acceptLegacySignatures: true,
    });
    expect(result).toBe('hello');
  });

  it('logs once per process when legacy acceptance is exercised', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const legacySigned = await legacySignForTest('hello', 'secret');

    await unsignCookie('session', legacySigned, 'secret', { acceptLegacySignatures: true });
    await unsignCookie('session', legacySigned, 'secret', { acceptLegacySignatures: true });
    await unsignCookie('session', legacySigned, 'secret', { acceptLegacySignatures: true });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});

describe('SEC-07: key rotation across both formats', () => {
  it('verifies a new-format signature with the current key via rotation', async () => {
    const signed = await signCookie('session', 'abc', 'new-secret');
    const result = await unsignCookieWithRotation('session', signed, { current: 'new-secret' });
    expect(result).toBe('abc');
  });

  it('verifies a new-format signature with a previous key via rotation', async () => {
    const signed = await signCookie('session', 'abc', 'old-secret');
    const result = await unsignCookieWithRotation('session', signed, {
      current: 'new-secret',
      previous: ['old-secret'],
    });
    expect(result).toBe('abc');
  });

  it('verifies a legacy-format signature across rotation when acceptLegacySignatures is set', async () => {
    const legacySigned = await legacySignForTest('abc', 'old-secret');
    const result = await unsignCookieWithRotation(
      'session',
      legacySigned,
      { current: 'new-secret', previous: ['old-secret'] },
      { acceptLegacySignatures: true }
    );
    expect(result).toBe('abc');
  });
});

/**
 * Reconstructs a pre-RFC-031 legacy signature (`value.signature`, HMAC over
 * the bare value only) using the same primitives the old `signCookie`
 * implementation used, so tests do not depend on retaining the removed code
 * path in the module under test.
 */
async function legacySignForTest(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  const bytes = new Uint8Array(signature);
  let base64 = btoa(String.fromCharCode(...bytes));
  base64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${value}.${base64}`;
}
