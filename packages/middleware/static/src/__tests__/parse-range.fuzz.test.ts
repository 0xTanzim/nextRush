/**
 * @nextrush/static - Property/fuzz suite for parseRange (task 8.4)
 *
 * Invariants: never an unhandled throw, bounded time/allocation, and a
 * returned range (when non-null) always lies within `[0, size)`.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseRange } from '../utils';

describe('parseRange() — fuzz invariants (task 8.4)', () => {
  it('never throws for arbitrary string input and any file size', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 200 }),
        fc.integer({ min: 0, max: 10_000_000 }),
        (header, size) => {
          expect(() => parseRange(header, size)).not.toThrow();
        }
      ),
      { numRuns: 500 }
    );
  });

  it('a non-null result always describes a range within [0, size)', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 200 }),
        fc.integer({ min: 1, max: 10_000_000 }),
        (header, size) => {
          const result = parseRange(header, size);
          if (result) {
            expect(result.start).toBeGreaterThanOrEqual(0);
            expect(result.end).toBeLessThan(size);
            expect(result.start).toBeLessThanOrEqual(result.end);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('terminates within bounded time for a pathological comma-separated range list', () => {
    const pathological = `bytes=${Array.from({ length: 10_000 }, (_, i) => `${String(i)}-${String(i)}`).join(',')}`;
    const start = performance.now();
    expect(() => parseRange(pathological, 1_000_000)).not.toThrow();
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it('terminates within bounded time for an extremely long single numeric token', () => {
    const pathological = `bytes=${'9'.repeat(100_000)}-`;
    const start = performance.now();
    expect(() => parseRange(pathological, 1_000_000)).not.toThrow();
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
