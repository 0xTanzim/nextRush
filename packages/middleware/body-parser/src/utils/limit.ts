/**
 * @nextrush/body-parser - Size Limit Utilities
 *
 * Parse and validate size limits.
 *
 * @packageDocumentation
 */

import { PATTERNS, SIZE_UNITS } from '../constants.js';

/**
 * Parse a size limit string to bytes.
 *
 * Supports formats:
 * - Number: `1048576` (bytes)
 * - String with unit: `'1mb'`, `'100kb'`, `'1gb'`
 *
 * @param limit - Size limit (number or string)
 * @param defaultLimit - Default value if parsing fails
 * @returns Size in bytes
 *
 * @example
 * ```typescript
 * parseLimit('1mb', 0);      // 1048576
 * parseLimit('100kb', 0);    // 102400
 * parseLimit(1024, 0);       // 1024
 * parseLimit(undefined, 100); // 100
 * ```
 */
export function parseLimit(
  limit: number | string | undefined,
  defaultLimit: number
): number {
  // Undefined -> default
  if (limit === undefined) {
    return defaultLimit;
  }

  // Number -> use directly
  if (typeof limit === 'number') {
    return Math.floor(limit);
  }

  // String -> parse with unit
  const match = PATTERNS.SIZE_LIMIT.exec(limit);
  if (!match) {
    return defaultLimit;
  }

  const value = parseFloat(match[1] ?? '0');
  const unit = (match[2] ?? 'b').toLowerCase();

  const multiplier = SIZE_UNITS[unit];
  if (multiplier === undefined) {
    return defaultLimit;
  }

  return Math.floor(value * multiplier);
}

/**
 * Format bytes to human-readable string.
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., '1.5 MB')
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const base = 1024;
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(base)),
    units.length - 1
  );

  const value = bytes / Math.pow(base, exponent);
  const unit = units[exponent] ?? 'B';

  return `${value.toFixed(exponent === 0 ? 0 : 2)} ${unit}`;
}
