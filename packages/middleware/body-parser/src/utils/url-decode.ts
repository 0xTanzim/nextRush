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
 * Safely decode a URI component.
 *
 * Returns original string on decode failure instead of throwing.
 *
 * @param str - String to decode
 * @returns Decoded string
 */
export function safeDecodeURIComponent(str: string): string {
  try {
    // Replace + with space before decoding
    return decodeURIComponent(str.replace(/\+/g, ' '));
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
  // Split key into parts: 'user[profile][name]' -> ['user', 'profile', 'name']
  const parts = key.split(/\[|\]/).filter(Boolean);

  // Check depth limit
  if (parts.length > maxDepth) {
    throw Errors.depthExceeded(parts.length, maxDepth);
  }

  // Validate all parts for prototype pollution
  for (const part of parts) {
    if (isForbiddenKey(part)) {
      throw Errors.invalidParameter(part);
    }
  }

  // Navigate/create the nested structure
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === undefined) {
      continue;
    }

    // Check if current part exists
    if (!(part in current)) {
      // Check next part to determine if we need an array or object
      const nextPart = parts[i + 1];
      const isNextNumeric = nextPart !== undefined && /^\d+$/.test(nextPart);
      current[part] = isNextNumeric ? [] : {};
    }

    const next = current[part];

    // Ensure we have an object to traverse into
    if (typeof next !== 'object' || next === null) {
      // Can't traverse into primitive, overwrite with object
      const nextPart = parts[i + 1];
      const isNextNumeric = nextPart !== undefined && /^\d+$/.test(nextPart);
      current[part] = isNextNumeric ? [] : {};
    }

    current = current[part] as Record<string, unknown>;
  }

  // Set the final value
  const lastPart = parts[parts.length - 1];
  if (lastPart === undefined) {
    return;
  }

  if (Array.isArray(current)) {
    const index = parseInt(lastPart, 10);
    if (!Number.isNaN(index) && index >= 0 && index < 10000) {
      // Limit array index to prevent memory issues
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
  const result: Record<string, unknown> = {};

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

    const value =
      eqIndex === -1 ? '' : safeDecodeURIComponent(pair.slice(eqIndex + 1));

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
