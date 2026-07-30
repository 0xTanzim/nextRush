/**
 * @nextrush/form-data - Property/fuzz suite for extractBoundary (task 8.4)
 *
 * Invariants: never an unhandled throw, and bounded time even against
 * pathological input crafted to probe the boundary regex for ReDoS.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { extractBoundary } from '../constants';

describe('extractBoundary() — fuzz invariants (task 8.4)', () => {
  it('never throws for arbitrary string input', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 2000 }), (input) => {
        expect(() => extractBoundary(input)).not.toThrow();
      }),
      { numRuns: 500 }
    );
  });

  it('returns undefined or a string, never anything else', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), (input) => {
        const result = extractBoundary(input);
        expect(result === undefined || typeof result === 'string').toBe(true);
      }),
      { numRuns: 300 }
    );
  });

  it('terminates within bounded time for a pathological quoted-boundary-like input', () => {
    const pathological = `multipart/form-data; boundary="${'a'.repeat(50_000)}`;
    const start = performance.now();
    expect(() => extractBoundary(pathological)).not.toThrow();
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it('terminates within bounded time for many repeated near-matches (ReDoS probe)', () => {
    const pathological = 'boundary='.repeat(20_000) + 'x'.repeat(10_000);
    const start = performance.now();
    expect(() => extractBoundary(pathological)).not.toThrow();
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it('extracts the quoted boundary value when present', () => {
    expect(extractBoundary('multipart/form-data; boundary="abc123"')).toBe('abc123');
  });

  it('extracts the unquoted boundary value when present', () => {
    expect(extractBoundary('multipart/form-data; boundary=abc123')).toBe('abc123');
  });
});
