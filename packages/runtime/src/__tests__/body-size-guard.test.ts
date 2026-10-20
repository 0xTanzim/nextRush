/**
 * @nextrush/runtime — UTF-8 size bounds for a decoded body.
 *
 * @remarks
 * The limit check must never accept an oversized body and must never reject an
 * eligible one. Code-unit length is a lower bound on UTF-8 bytes and three times
 * it is an upper bound, so the boundary is where the two disagree.
 */
import { describe, expect, it } from 'vitest';
import { exceedsUtf8Limit } from '../body-size-guard';

describe('exceedsUtf8Limit', () => {
  it('accepts ASCII at the limit', () => {
    expect(exceedsUtf8Limit('abcd', 4)).toBe(false);
  });

  it('rejects ASCII over the limit', () => {
    expect(exceedsUtf8Limit('abcde', 4)).toBe(true);
  });

  it('rejects once the code-unit count alone exceeds the limit', () => {
    // No encoding needed: every code unit costs at least one byte.
    expect(exceedsUtf8Limit('éééé', 3)).toBe(true);
  });

  it('accepts a two-byte body that fits once encoded', () => {
    // 2 code units, 4 encoded bytes, limit 5 — the encoding decides.
    expect(exceedsUtf8Limit('éé', 5)).toBe(false);
  });

  it('rejects a two-byte body that does not fit once encoded', () => {
    expect(exceedsUtf8Limit('éé', 3)).toBe(true);
  });

  it('accepts a surrogate pair that fits once encoded', () => {
    // 2 code units, 4 encoded bytes.
    expect(exceedsUtf8Limit('😀', 4)).toBe(false);
  });

  it('rejects a surrogate pair that does not fit once encoded', () => {
    expect(exceedsUtf8Limit('😀', 3)).toBe(true);
  });

  it('accepts an empty body at a zero limit', () => {
    expect(exceedsUtf8Limit('', 0)).toBe(false);
  });

  it('handles a three-byte body at its exact limit', () => {
    // 1 code unit, 3 encoded bytes.
    expect(exceedsUtf8Limit('☃', 3)).toBe(false);
    expect(exceedsUtf8Limit('☃', 2)).toBe(true);
  });
});
