/**
 * @nextrush/cookies - Property/fuzz suite for parseCookies (task 8.4)
 *
 * Invariants asserted for arbitrary input: never an unhandled throw,
 * `Object.prototype` unmodified, and bounded time/allocation.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseCookies } from '../parser';

describe('parseCookies() — fuzz invariants (task 8.4)', () => {
  it('never throws for arbitrary string input', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 2000 }), (input) => {
        expect(() => parseCookies(input)).not.toThrow();
      }),
      { numRuns: 500 }
    );
  });

  it('never modifies Object.prototype for arbitrary input, including prototype-related names', () => {
    const before = JSON.stringify(Object.getOwnPropertyNames(Object.prototype));
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.constantFrom('__proto__', 'constructor', 'prototype', 'a', 'name'),
            fc.string({ maxLength: 50 })
          ),
          { maxLength: 30 }
        ),
        (pairs) => {
          const header = pairs.map(([name, value]) => `${name}=${value}`).join('; ');
          parseCookies(header);
        }
      ),
      { numRuns: 300 }
    );
    expect(JSON.stringify(Object.getOwnPropertyNames(Object.prototype))).toBe(before);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((Object.prototype as any).polluted).toBeUndefined();
  });

  it('returns a plain object for null/undefined input, never throwing', () => {
    expect(() => parseCookies(null)).not.toThrow();
    expect(() => parseCookies(undefined)).not.toThrow();
    expect(parseCookies(null)).toEqual({});
    expect(parseCookies(undefined)).toEqual({});
  });

  it('terminates within bounded time for a pathological repeated-separator input', () => {
    const pathological = '='.repeat(50_000) + ';'.repeat(50_000);
    const start = performance.now();
    expect(() => parseCookies(pathological)).not.toThrow();
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it('never returns more than maxCookies entries for an arbitrarily large header', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 500 }), (count) => {
        const header = Array.from({ length: count }, (_, i) => `c${String(i)}=v`).join('; ');
        const result = parseCookies(header, { maxCookies: 50 });
        expect(Object.keys(result).length).toBeLessThanOrEqual(50);
      }),
      { numRuns: 50 }
    );
  });
});
