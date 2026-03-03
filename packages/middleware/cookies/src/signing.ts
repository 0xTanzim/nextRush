/**
 * @nextrush/cookies - Signing Utilities
 *
 * Cryptographic cookie signing using HMAC-SHA256.
 * Uses Web Crypto API for cross-runtime compatibility.
 *
 * @packageDocumentation
 */

import { HASH_ALGORITHM, HMAC_ALGORITHM, SIGNATURE_SEPARATOR } from './constants.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Key rotation support - multiple secrets.
 */
export interface SigningKeys {
  /** Primary key for signing new cookies */
  current: string;
  /** Previous keys for verifying old cookies during rotation */
  previous?: string[];
}

// ============================================================================
// Key Management
// ============================================================================

/** Bounded cache to avoid re-importing the same secret on every operation. */
const KEY_CACHE = new Map<string, CryptoKey>();
const MAX_CACHED_KEYS = 10;

/**
 * Import a secret key for HMAC operations.
 * Results are cached in a bounded map (LRU-ish eviction).
 */
async function importKey(secret: string): Promise<CryptoKey> {
  const cached = KEY_CACHE.get(secret);
  if (cached) return cached;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: HMAC_ALGORITHM, hash: HASH_ALGORITHM },
    false,
    ['sign', 'verify']
  );

  // Evict oldest entry when cache is full
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
// Base64 URL Encoding
// ============================================================================

/**
 * Encode bytes to URL-safe base64.
 */
function toBase64Url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode URL-safe base64 to bytes.
 */
function fromBase64Url(str: string): Uint8Array {
  // Add padding if needed
  const padding = (4 - (str.length % 4)) % 4;
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padding);

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================================================
// Cookie Signing
// ============================================================================

/**
 * Sign a cookie value with HMAC-SHA256.
 *
 * @param value - Value to sign
 * @param secret - Secret key for signing
 * @returns Signed value in format: `value.signature`
 *
 * @example
 * ```typescript
 * const signed = await signCookie('session-data', 'my-secret');
 * // 'session-data.XYZ123...'
 * ```
 */
export async function signCookie(value: string, secret: string): Promise<string> {
  if (!value || typeof value !== 'string') {
    throw new TypeError('Cookie value must be a non-empty string');
  }

  if (!secret || typeof secret !== 'string') {
    throw new TypeError('Secret must be a non-empty string');
  }

  const encoder = new TextEncoder();
  const key = await importKey(secret);
  const data = encoder.encode(value);

  const signature = await crypto.subtle.sign(HMAC_ALGORITHM, key, data);
  const signatureBase64 = toBase64Url(new Uint8Array(signature));

  return `${value}${SIGNATURE_SEPARATOR}${signatureBase64}`;
}

/**
 * Verify and extract a signed cookie value.
 *
 * @param signedValue - Signed value in format: `value.signature`
 * @param secret - Secret key used for signing
 * @returns Original value if valid, undefined if tampered
 *
 * @example
 * ```typescript
 * const value = await unsignCookie(signedValue, 'my-secret');
 * if (value === undefined) {
 *   console.log('Cookie was tampered with!');
 * }
 * ```
 */
export async function unsignCookie(
  signedValue: string,
  secret: string
): Promise<string | undefined> {
  if (!signedValue || typeof signedValue !== 'string') {
    return undefined;
  }

  const lastDotIndex = signedValue.lastIndexOf(SIGNATURE_SEPARATOR);
  if (lastDotIndex === -1) {
    return undefined;
  }

  const value = signedValue.slice(0, lastDotIndex);
  const signature = signedValue.slice(lastDotIndex + 1);

  if (!value || !signature) {
    return undefined;
  }

  try {
    const encoder = new TextEncoder();
    const key = await importKey(secret);
    const data = encoder.encode(value);
    const signatureBytes = fromBase64Url(signature);

    const isValid = await crypto.subtle.verify(
      HMAC_ALGORITHM,
      key,
      signatureBytes as BufferSource,
      data
    );

    return isValid ? value : undefined;
  } catch (_: unknown) {
    // Signature verification failed (malformed base64, corrupted data).
    // Return undefined — same behavior as tampered/invalid cookie.
    return undefined;
  }
}

/**
 * Verify a signed cookie with key rotation support.
 *
 * Tries the current key first, then falls back to previous keys.
 * This allows for seamless key rotation.
 *
 * @param signedValue - Signed value to verify
 * @param keys - Current and previous signing keys
 * @returns Original value if valid with any key, undefined if invalid
 *
 * @example
 * ```typescript
 * const value = await unsignCookieWithRotation(signedValue, {
 *   current: 'new-secret',
 *   previous: ['old-secret-1', 'old-secret-2']
 * });
 * ```
 */
export async function unsignCookieWithRotation(
  signedValue: string,
  keys: SigningKeys
): Promise<string | undefined> {
  // Try current key first
  const result = await unsignCookie(signedValue, keys.current);
  if (result !== undefined) {
    return result;
  }

  // Try previous keys
  if (keys.previous) {
    for (const previousKey of keys.previous) {
      const previousResult = await unsignCookie(signedValue, previousKey);
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
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 *
 * @note Web Crypto's verify() is already timing-safe.
 * This is provided for cases where manual comparison is needed.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still need constant-time operation for equal-length case
    let result = 0;
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      result |= (a.charCodeAt(i % a.length) ?? 0) ^ (b.charCodeAt(i % b.length) ?? 0);
    }
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
