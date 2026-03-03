/**
 * @nextrush/helmet - Nonce generation utilities
 *
 * Cryptographically secure nonce generation for CSP scripts.
 * Works across all runtimes (Node.js, Bun, Deno, Edge).
 *
 * @packageDocumentation
 */

import { isValidNonce } from './validation.js';

/**
 * Default nonce length in bytes.
 * 16 bytes = 128 bits of entropy (recommended minimum).
 */
const DEFAULT_NONCE_LENGTH = 16;

/**
 * Generate a cryptographically secure nonce.
 *
 * Uses the Web Crypto API (crypto.getRandomValues) which is available
 * in all modern runtimes.
 *
 * @param length - Number of random bytes (default: 16)
 * @returns Base64-encoded nonce string
 *
 * @example
 * ```typescript
 * const nonce = generateNonce();
 * // nonce: "dGVzdG5vbmNlMTIzNDU2Nw=="
 * ```
 */
export function generateNonce(length: number = DEFAULT_NONCE_LENGTH): string {
  if (!Number.isFinite(length) || length < 1) {
    throw new Error('[@nextrush/helmet] Nonce length must be a positive integer.');
  }
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Generate a nonce and format it for CSP.
 *
 * @param length - Number of random bytes (default: 16)
 * @returns CSP-formatted nonce (e.g., "'nonce-abc123...'")
 *
 * @example
 * ```typescript
 * const cspNonce = generateCspNonce();
 * // cspNonce: "'nonce-dGVzdG5vbmNlMTIzNDU2Nw=='"
 * ```
 */
export function generateCspNonce(length: number = DEFAULT_NONCE_LENGTH): string {
  const nonce = generateNonce(length);
  return `'nonce-${nonce}'`;
}

/**
 * Extract the raw nonce value from a CSP nonce string.
 *
 * @param cspNonce - CSP nonce string (e.g., "'nonce-abc123'")
 * @returns Raw nonce value or null if invalid format
 *
 * @example
 * ```typescript
 * const raw = extractNonce("'nonce-abc123'");
 * // raw: "abc123"
 * ```
 */
export function extractNonce(cspNonce: string): string | null {
  const match = cspNonce.match(/^'nonce-([A-Za-z0-9+/]+=*)'$/);
  return match?.[1] ?? null;
}

/**
 * Create a nonce provider for use with CSP middleware.
 *
 * Returns a function that generates a new nonce for each call.
 * Useful when you need to customize nonce generation.
 *
 * @param length - Number of random bytes per nonce
 * @returns Nonce provider function
 *
 * @example
 * ```typescript
 * const provider = createNonceProvider(32); // Extra entropy
 * const nonce1 = provider();
 * const nonce2 = provider();
 * ```
 */
export function createNonceProvider(length: number = DEFAULT_NONCE_LENGTH): () => string {
  if (length < 16) {
    console.warn(
      `[@nextrush/helmet] Nonce length ${length} is less than recommended minimum (16 bytes).`
    );
  }

  return () => generateNonce(length);
}

/**
 * Validate and normalize a nonce value.
 *
 * @param nonce - Nonce to validate
 * @returns Validated nonce or null if invalid
 */
export function validateNonce(nonce: string): string | null {
  // Remove CSP wrapper if present
  const raw = nonce.startsWith("'nonce-") ? extractNonce(nonce) : nonce;

  if (!raw || !isValidNonce(raw)) {
    return null;
  }

  return raw;
}

/**
 * Create a script tag with nonce attribute.
 *
 * @param nonce - Raw nonce value
 * @param content - Script content
 * @returns HTML script tag with nonce
 *
 * @example
 * ```typescript
 * const script = createNoncedScript(nonce, 'console.log("Hello")');
 * // <script nonce="abc123">console.log("Hello")</script>
 * ```
 */
export function createNoncedScript(nonce: string, content: string): string {
  if (/["<>]/.test(nonce)) {
    throw new Error(
      '[@nextrush/helmet] Nonce contains unsafe characters for HTML attribute embedding.'
    );
  }
  // Escape script content to prevent XSS
  const escaped = content.replace(/<\//g, '<\\/');
  return `<script nonce="${nonce}">${escaped}</script>`;
}

/**
 * Create a style tag with nonce attribute.
 *
 * @param nonce - Raw nonce value
 * @param content - Style content
 * @returns HTML style tag with nonce
 *
 * @example
 * ```typescript
 * const style = createNoncedStyle(nonce, 'body { color: red }');
 * // <style nonce="abc123">body { color: red }</style>
 * ```
 */
export function createNoncedStyle(nonce: string, content: string): string {
  if (/["<>]/.test(nonce)) {
    throw new Error(
      '[@nextrush/helmet] Nonce contains unsafe characters for HTML attribute embedding.'
    );
  }
  // Escape style content
  const escaped = content.replace(/<\//g, '<\\/');
  return `<style nonce="${nonce}">${escaped}</style>`;
}
