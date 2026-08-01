/**
 * @nextrush/cookies - Base64url encoding and HMAC verification helpers
 *
 * Split out of `signing.ts` to keep it under the file-size ceiling; these
 * are pure encoding/crypto-plumbing helpers with no context-bound-signature
 * policy of their own.
 *
 * @packageDocumentation
 */

import { HASH_ALGORITHM, HMAC_ALGORITHM } from './constants.js';

/** Encode bytes to URL-safe base64. */
export function toBase64Url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode URL-safe base64 to bytes. */
export function fromBase64Url(str: string): Uint8Array {
  const padding = (4 - (str.length % 4)) % 4;
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padding);

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Import a secret key for HMAC operations (uncached — callers cache). */
export async function importHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: HMAC_ALGORITHM, hash: HASH_ALGORITHM },
    false,
    ['sign', 'verify']
  );
}

/**
 * Verifies a base64url-encoded HMAC signature against `message` using an
 * already-imported key. Returns `false` (never throws) on malformed base64
 * or a corrupted signature — indistinguishable from a wrong signature.
 */
export async function verifyHmac(
  message: string,
  signatureBase64: string,
  key: CryptoKey
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const signatureBytes = fromBase64Url(signatureBase64);
    return await crypto.subtle.verify(
      HMAC_ALGORITHM,
      key,
      signatureBytes as BufferSource,
      encoder.encode(message)
    );
  } catch {
    return false;
  }
}
