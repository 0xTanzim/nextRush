/**
 * @nextrush/csrf - Token Engine
 *
 * HMAC-SHA256 based CSRF token generation and validation.
 * Uses Web Crypto API exclusively for cross-runtime compatibility.
 *
 * Token format: `<hmac-hex>.<random-hex>`
 *
 * HMAC message payload (OWASP recommended):
 *   `<sessionId.length>!<sessionId>!<random.length>!<randomHex>`
 *
 * When no session identifier is available:
 *   `<random.length>!<randomHex>`
 *
 * @packageDocumentation
 */

import {
  DEFAULT_TOKEN_SIZE,
  HASH_ALGORITHM,
  HMAC_ALGORITHM,
  TOKEN_SEPARATOR,
} from './constants.js';

// ============================================================================
// Key Cache (bounded, same pattern as @nextrush/cookies)
// ============================================================================

const KEY_CACHE = new Map<string, CryptoKey>();
const MAX_CACHED_KEYS = 10;

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
// Hex Encoding
// ============================================================================

function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += (bytes[i] as number).toString(16).padStart(2, '0');
  }
  return hex;
}

function fromHex(hex: string): Uint8Array {
  const length = hex.length / 2;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ============================================================================
// HMAC Message Construction
// ============================================================================

/**
 * Build the HMAC message payload following OWASP's recommended format.
 *
 * With session:    `<sessionId.length>!<sessionId>!<randomHex.length>!<randomHex>`
 * Without session: `<randomHex.length>!<randomHex>`
 */
function buildMessage(randomHex: string, sessionId?: string): string {
  if (sessionId) {
    return `${sessionId.length}!${sessionId}!${randomHex.length}!${randomHex}`;
  }
  return `${randomHex.length}!${randomHex}`;
}

// ============================================================================
// Token Generation
// ============================================================================

/**
 * Generate a CSRF token using HMAC-SHA256.
 *
 * @param secret - HMAC secret key
 * @param sessionId - Optional session identifier for token binding
 * @param tokenSize - Size of random value in bytes
 * @returns Token string in format `<hmac-hex>.<random-hex>`
 */
export async function generateToken(
  secret: string,
  sessionId?: string,
  tokenSize: number = DEFAULT_TOKEN_SIZE
): Promise<string> {
  // Generate cryptographically secure random bytes
  const randomBytes = new Uint8Array(tokenSize);
  crypto.getRandomValues(randomBytes);
  const randomHex = toHex(randomBytes);

  // Build message and compute HMAC
  const message = buildMessage(randomHex, sessionId);
  const key = await importKey(secret);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(HMAC_ALGORITHM, key, encoder.encode(message));
  const hmacHex = toHex(new Uint8Array(signature));

  return `${hmacHex}${TOKEN_SEPARATOR}${randomHex}`;
}

// ============================================================================
// Token Validation
// ============================================================================

/**
 * Validate a CSRF token against its HMAC signature.
 *
 * @param token - The full token string (`<hmac-hex>.<random-hex>`)
 * @param secret - HMAC secret key
 * @param sessionId - Optional session identifier (must match what was used in generation)
 * @returns `true` if the token is valid, `false` otherwise
 */
export async function validateToken(
  token: string,
  secret: string,
  sessionId?: string
): Promise<boolean> {
  if (!token || typeof token !== 'string') return false;

  const separatorIndex = token.indexOf(TOKEN_SEPARATOR);
  if (separatorIndex === -1) return false;

  const hmacHex = token.substring(0, separatorIndex);
  const randomHex = token.substring(separatorIndex + 1);

  // Validate hex format to prevent injection
  if (!isValidHex(hmacHex) || !isValidHex(randomHex)) return false;
  if (randomHex.length === 0 || hmacHex.length === 0) return false;

  // Rebuild the message and verify the HMAC
  const message = buildMessage(randomHex, sessionId);
  const key = await importKey(secret);
  const encoder = new TextEncoder();

  // Use crypto.subtle.verify for constant-time comparison (implementation-provided)
  const signatureBytes = fromHex(hmacHex);
  const isValid = await crypto.subtle.verify(
    HMAC_ALGORITHM,
    key,
    signatureBytes as ArrayBufferView<ArrayBuffer>,
    encoder.encode(message)
  );

  return isValid;
}

// ============================================================================
// Token Comparison (Double Submit)
// ============================================================================

/**
 * Constant-time string comparison to prevent timing attacks.
 *
 * Compares two strings byte-by-byte without short-circuiting.
 * Uses HMAC-based comparison for true constant-time guarantees
 * (XOR comparison can still leak length in some JS engines).
 */
export async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  if (typeof a !== 'string' || typeof b !== 'string') return false;

  // Use HMAC to achieve constant-time comparison regardless of JS engine
  // Both values are HMACed with a fixed key, then compared via crypto.subtle.verify
  const encoder = new TextEncoder();
  const keyData = encoder.encode('csrf-compare');

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: HMAC_ALGORITHM, hash: HASH_ALGORITHM },
    false,
    ['sign', 'verify']
  );

  const sigA = await crypto.subtle.sign(HMAC_ALGORITHM, key, encoder.encode(a));
  const isEqual = await crypto.subtle.verify(HMAC_ALGORITHM, key, sigA, encoder.encode(b));

  return isEqual;
}

// ============================================================================
// Hex Validation
// ============================================================================

const HEX_REGEX = /^[0-9a-f]+$/;

function isValidHex(str: string): boolean {
  return HEX_REGEX.test(str);
}
