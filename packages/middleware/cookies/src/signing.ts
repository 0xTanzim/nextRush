/**
 * @nextrush/cookies - Signing Utilities
 *
 * Cryptographic cookie signing using HMAC-SHA256, with a context-bound
 * message construction (RFC-031 / ADR-0019, SEC-07): the HMAC input binds
 * the cookie name so a value signed for one cookie cannot verify under
 * another, and an issue time so a signed value can expire independent of
 * the cookie's own `Max-Age`. Message construction lives in
 * `signing-message.ts`; base64url/HMAC plumbing lives in `signing-codec.ts`.
 *
 * @packageDocumentation
 */

import { SIGNATURE_SEPARATOR } from './constants.js';
import { importHmacKey, toBase64Url, verifyHmac } from './signing-codec.js';
import {
  buildLegacyMessage,
  buildSignedMessage,
  splitLegacyFormat,
  splitNewFormat,
  warnLegacyAcceptanceOnce,
} from './signing-message.js';

export { resetLegacyAcceptanceWarning } from './signing-message.js';

// ============================================================================
// Types
// ============================================================================

/** Key rotation support - multiple secrets. */
export interface SigningKeys {
  /** Primary key for signing new cookies */
  current: string;
  /** Previous keys for verifying old cookies during rotation */
  previous?: string[];
}

/** Options for {@link signCookie}. */
export interface SignCookieOptions {
  /**
   * Bounds the signed value's lifetime in seconds, embedded in the signed
   * message as an issue time. Verification only enforces this when the same
   * `maxAge` is passed to {@link unsignCookie}.
   */
  maxAge?: number;
}

/** Options for {@link unsignCookie}. */
export interface UnsignCookieOptions {
  /**
   * Enforces the embedded issue time against this lifetime (seconds). When
   * omitted, a present issue time is not checked for expiry.
   */
  maxAge?: number;
  /**
   * Accepts the pre-RFC-031 value-only signature format (no name/issuedAt
   * binding) as a rotation fallback. Off by default — see the cookies
   * README's signed-cookie format migration section. Logs once per process
   * when exercised.
   */
  acceptLegacySignatures?: boolean;
}

// ============================================================================
// Key Management
// ============================================================================

/** Bounded cache to avoid re-importing the same secret on every operation. */
const KEY_CACHE = new Map<string, CryptoKey>();
const MAX_CACHED_KEYS = 10;

async function importKey(secret: string): Promise<CryptoKey> {
  const cached = KEY_CACHE.get(secret);
  if (cached) return cached;

  const key = await importHmacKey(secret);

  if (KEY_CACHE.size >= MAX_CACHED_KEYS) {
    const firstKey = KEY_CACHE.keys().next().value;
    if (firstKey !== undefined) KEY_CACHE.delete(firstKey);
  }

  KEY_CACHE.set(secret, key);
  return key;
}

/**
 * Clear the internal CryptoKey cache. Exposed for testing.
 * @internal
 */
export function clearKeyCache(): void {
  KEY_CACHE.clear();
}

// ============================================================================
// Cookie Signing
// ============================================================================

/**
 * Sign a cookie value with HMAC-SHA256, binding the signature to the
 * cookie's name and an issue time.
 *
 * @param name - Cookie name the value is bound to (SEC-07)
 * @param value - Value to sign
 * @param secret - Secret key for signing
 * @param _options - See {@link SignCookieOptions}. Reserved for a future
 *   sign-time expiry policy; verification enforces `maxAge`, not signing.
 * @returns Signed value in wire format: `value.issuedAt.signature`
 *
 * @example
 * ```typescript
 * const signed = await signCookie('tier', 'premium', 'my-secret');
 * ```
 */
export async function signCookie(
  name: string,
  value: string,
  secret: string,
  _options: SignCookieOptions = {}
): Promise<string> {
  if (!name || typeof name !== 'string') {
    throw new TypeError('Cookie name must be a non-empty string');
  }
  if (!value || typeof value !== 'string') {
    throw new TypeError('Cookie value must be a non-empty string');
  }
  if (!secret || typeof secret !== 'string') {
    throw new TypeError('Secret must be a non-empty string');
  }

  const issuedAt = Date.now();
  const message = buildSignedMessage(name, value, issuedAt);

  const encoder = new TextEncoder();
  const key = await importKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const signatureBase64 = toBase64Url(new Uint8Array(signature));

  return `${value}${SIGNATURE_SEPARATOR}${String(issuedAt)}${SIGNATURE_SEPARATOR}${signatureBase64}`;
}

/**
 * Verify and extract a signed cookie value, checking that the signature was
 * issued for `name` and (when `options.maxAge` is given) has not expired.
 *
 * @param name - Cookie name the signature must be bound to (SEC-07)
 * @param signedValue - Signed value in wire format: `value.issuedAt.signature`
 * @param secret - Secret key used for signing
 * @param options - See {@link UnsignCookieOptions}
 * @returns Original value if valid, undefined if tampered, name-mismatched,
 *   expired, or (absent `acceptLegacySignatures`) in the legacy format.
 *
 * @example
 * ```typescript
 * const value = await unsignCookie('tier', signedValue, 'my-secret');
 * if (value === undefined) {
 *   console.log('Cookie was tampered with, replayed under another name, or expired!');
 * }
 * ```
 */
export async function unsignCookie(
  name: string,
  signedValue: string,
  secret: string,
  options: UnsignCookieOptions = {}
): Promise<string | undefined> {
  if (!name || typeof name !== 'string') return undefined;
  if (!signedValue || typeof signedValue !== 'string') return undefined;

  const parsed = splitNewFormat(signedValue);
  if (parsed) {
    const message = buildSignedMessage(name, parsed.value, Number(parsed.issuedAt));
    const key = await importKey(secret);
    const isValid = await verifyHmac(message, parsed.signature, key);
    if (isValid) {
      if (options.maxAge !== undefined) {
        const ageSeconds = (Date.now() - Number(parsed.issuedAt)) / 1000;
        if (ageSeconds > options.maxAge) return undefined;
      }
      return parsed.value;
    }
  }

  if (options.acceptLegacySignatures) {
    const legacy = splitLegacyFormat(signedValue);
    if (legacy) {
      const message = buildLegacyMessage(legacy.value);
      const key = await importKey(secret);
      const isValid = await verifyHmac(message, legacy.signature, key);
      if (isValid) {
        warnLegacyAcceptanceOnce();
        return legacy.value;
      }
    }
  }

  return undefined;
}

/**
 * Verify a signed cookie with key rotation support, threading `name` and
 * `options` through to each attempted key.
 *
 * Tries the current key first, then falls back to previous keys.
 *
 * @param name - Cookie name the signature must be bound to (SEC-07)
 * @param signedValue - Signed value to verify
 * @param keys - Current and previous signing keys
 * @param options - See {@link UnsignCookieOptions}
 * @returns Original value if valid with any key, undefined if invalid
 *
 * @example
 * ```typescript
 * const value = await unsignCookieWithRotation('tier', signedValue, {
 *   current: 'new-secret',
 *   previous: ['old-secret-1', 'old-secret-2']
 * });
 * ```
 */
export async function unsignCookieWithRotation(
  name: string,
  signedValue: string,
  keys: SigningKeys,
  options: UnsignCookieOptions = {}
): Promise<string | undefined> {
  const result = await unsignCookie(name, signedValue, keys.current, options);
  if (result !== undefined) {
    return result;
  }

  if (keys.previous) {
    for (const previousKey of keys.previous) {
      const previousResult = await unsignCookie(name, signedValue, previousKey, options);
      if (previousResult !== undefined) {
        return previousResult;
      }
    }
  }

  return undefined;
}

// ============================================================================
// Timing-Safe Comparison (Fallback)
// ============================================================================

/**
 * Timing-safe string comparison.
 *
 * @note Web Crypto's verify() is already timing-safe. This is provided for
 * cases where manual comparison is needed.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const aLen = a.length;
  const bLen = b.length;

  let result = aLen ^ bLen;
  const len = aLen > bLen ? aLen : bLen;
  for (let i = 0; i < len; i++) {
    const ca = i < aLen ? a.charCodeAt(i) : 0;
    const cb = i < bLen ? b.charCodeAt(i) : 0;
    result |= ca ^ cb;
  }

  return result === 0;
}
