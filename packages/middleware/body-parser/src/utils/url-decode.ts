/**
 * @nextrush/body-parser - URL Decode Utilities
 *
 * URL-encoded string parsing with security guards.
 *
 * @packageDocumentation
 */

import { DEFAULT_PARAMETER_LIMITS, FORBIDDEN_KEYS } from '../constants.js';
import { Errors } from '../errors.js';
import type { ParsedUrlEncoded } from '../types.js';

/**
 * Prototype for every per-request key/value container this parser builds.
 *
 * `Object.create(null)` satisfies the same prototype-pollution requirement —
 * `Object.prototype` unreachable, so a key like `__proto__` binds as an own
 * key — but it additionally puts the object into V8 dictionary mode, where
 * property loads cannot be inline-cached. Deriving from a null-prototype base
 * instead keeps fast properties with identical safety.
 *
 * Carries its own copy rather than depending on `@nextrush/runtime`: no
 * `@nextrush/middleware/*` package currently depends on `runtime`, and one
 * leaf constant does not justify adding that edge.
 *
 * @see docs/adr/ADR-0021-fast-property-request-containers.md
 */
const NULL_PROTO: object = Object.create(null) as object;

/**
 * Safely decode a URI component.
 *
 * Returns original string on decode failure instead of throwing.
 *
 * @param str - String to decode
 * @returns Decoded string
 */
export function safeDecodeURIComponent(str: string): string {
  try {
    // Replace + with space before decoding (skip regex when no + present)
    const decoded = str.includes('+') ? str.replace(/\+/g, ' ') : str;
    return decodeURIComponent(decoded);
  } catch {
    return str;
  }
}

/**
 * Check if a key is forbidden (prototype pollution prevention).
 *
 * @param key - Key to check
 * @returns True if key is forbidden
 */
function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEYS.has(key);
}

/**
 * Set a nested value in an object using bracket notation.
 *
 * Handles patterns like:
 * - `user[name]` -> `{ user: { name: value } }`
 * - `users[0]` -> `{ users: [value] }`
 * - `user[profile][name]` -> `{ user: { profile: { name: value } } }`
 *
 * @param obj - Target object
 * @param key - Key with bracket notation
 * @param value - Value to set
 * @param maxDepth - Maximum nesting depth
 * @throws BodyParserError on prototype pollution attempt or depth exceeded
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  key: string,
  value: string,
  maxDepth: number = DEFAULT_PARAMETER_LIMITS.MAX_DEPTH
): void {
  // `key[]` is append-to-array notation. Strip the trailing `[]` and remember
  // to push rather than assign (BP-3).
  const isArrayPush = key.endsWith('[]');
  const cleanKey = isArrayPush ? key.slice(0, -2) : key;

  // Split key into parts: 'user[profile][name]' -> ['user', 'profile', 'name']
  const parts = cleanKey.split(/\[|\]/).filter(Boolean);

  // Check depth limit (an array push adds one implicit level)
  const effectiveDepth = parts.length + (isArrayPush ? 1 : 0);
  if (effectiveDepth > maxDepth) {
    throw Errors.depthExceeded(effectiveDepth, maxDepth);
  }

  // Validate all parts for prototype pollution
  for (const part of parts) {
    if (isForbiddenKey(part)) {
      throw Errors.invalidParameter(part);
    }
  }

  if (parts.length === 0) {
    return;
  }

  // Navigate/create the nested structure down to the parent of the last part
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === undefined) {
      continue;
    }

    const nextPart = parts[i + 1];
    const isNextNumeric = nextPart !== undefined && /^\d+$/.test(nextPart);
    const existing = current[part];

    // Create an object/array to traverse into when missing or a primitive
    if (typeof existing !== 'object' || existing === null) {
      current[part] = isNextNumeric ? [] : (Object.create(NULL_PROTO) as Record<string, unknown>);
    }

    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart === undefined) {
    return;
  }

  // key[] → append to (or create) an array at the final key
  if (isArrayPush) {
    const existing = current[lastPart];
    if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      current[lastPart] = [value];
    }
    return;
  }

  if (Array.isArray(current)) {
    const index = parseInt(lastPart, 10);
    if (!Number.isNaN(index) && index >= 0 && index < 1000) {
      // Limit array index to prevent sparse array memory abuse
      (current as unknown[])[index] = value;
    }
  } else {
    current[lastPart] = value;
  }
}

/**
 * Parse URL-encoded string to object.
 *
 * @param str - URL-encoded string
 * @param extended - Enable nested object parsing
 * @param parameterLimit - Maximum number of parameters
 * @param depth - Maximum nesting depth
 * @returns Parsed object
 * @throws BodyParserError on limit exceeded or invalid input
 */
export function parseUrlEncoded(
  str: string,
  extended: boolean = true,
  parameterLimit: number = DEFAULT_PARAMETER_LIMITS.MAX_PARAMS,
  depth: number = DEFAULT_PARAMETER_LIMITS.MAX_DEPTH
): ParsedUrlEncoded {
  const result: Record<string, unknown> = Object.create(NULL_PROTO) as Record<string, unknown>;

  // Handle empty string
  if (!str || str.length === 0) {
    return result;
  }

  const pairs = str.split('&');

  // Check parameter limit
  if (pairs.length > parameterLimit) {
    throw Errors.tooManyParameters(pairs.length, parameterLimit);
  }

  for (const pair of pairs) {
    // Skip empty pairs
    if (!pair) {
      continue;
    }

    // Find the first = sign
    const eqIndex = pair.indexOf('=');

    // Decode key and value
    const key =
      eqIndex === -1
        ? safeDecodeURIComponent(pair)
        : safeDecodeURIComponent(pair.slice(0, eqIndex));

    const value = eqIndex === -1 ? '' : safeDecodeURIComponent(pair.slice(eqIndex + 1));

    // Skip empty keys
    if (!key) {
      continue;
    }

    // Check for prototype pollution in simple mode too
    if (isForbiddenKey(key)) {
      throw Errors.invalidParameter(key);
    }

    // Extended mode: handle nested objects
    if (extended && key.includes('[')) {
      setNestedValue(result, key, value, depth);
      continue;
    }

    // Simple mode: flat object with array support
    if (key in result) {
      const existing = result[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing, value];
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}
