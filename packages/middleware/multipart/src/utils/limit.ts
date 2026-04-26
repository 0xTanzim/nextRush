/**
 * @nextrush/multipart - Size Limit Parser
 *
 * Parses human-readable size strings (e.g., '10mb') to bytes.
 *
 * @packageDocumentation
 */

import { SIZE_LIMIT_PATTERN, SIZE_UNITS } from '../constants.js';

/**
 * Parse a size limit value to bytes.
 *
 * Accepts:
 * - Numbers: returned as-is (interpreted as bytes)
 * - Strings: e.g., '1mb', '100kb', '512b'
 * - Undefined: returns the defaultLimit
 */
export function parseLimit(limit: number | string | undefined, defaultLimit: number): number {
  if (limit === undefined) return defaultLimit;
  if (typeof limit === 'number') return Math.floor(limit);

  const match = SIZE_LIMIT_PATTERN.exec(limit);
  if (!match) return defaultLimit;

  const value = parseFloat(match[1] ?? '0');
  const unit = (match[2] ?? 'b').toLowerCase();
  const multiplier = SIZE_UNITS[unit];
  if (multiplier === undefined) return defaultLimit;

  return Math.floor(value * multiplier);
}
