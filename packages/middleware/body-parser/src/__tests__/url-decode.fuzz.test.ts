/**
 * @nextrush/body-parser - Property/fuzz suite for parseUrlEncoded /
 * setNestedValue (task 8.4)
 *
 * Invariants: never an unhandled throw (only the typed `BodyParserError`),
 * `Object.prototype` unmodified, and bounded time/allocation.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BodyParserError } from '../errors';
import { parseUrlEncoded, setNestedValue } from '../utils/url-decode';

/** Fails the test unless the thrown value is the one framework error type. */
function expectOnlyTypedThrow(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(BodyParserError);
  }
}

describe('parseUrlEncoded() — fuzz invariants (task 8.4)', () => {
  it('never throws an unhandled error for arbitrary string input', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 2000 }), (input) => {
        expectOnlyTypedThrow(() => parseUrlEncoded(input));
      }),
      { numRuns: 500 }
    );
  });

  it('never modifies Object.prototype for arbitrary prototype-shaped keys', () => {
    const before = JSON.stringify(Object.getOwnPropertyNames(Object.prototype));
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.constantFrom(
              '__proto__',
              'constructor[prototype]',
              'a[__proto__][polluted]',
              'a[b][c]',
              'name'
            ),
            fc.string({ maxLength: 30 })
          ),
          { maxLength: 20 }
        ),
        (pairs) => {
          const qs = pairs
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');
          expectOnlyTypedThrow(() => parseUrlEncoded(qs));
        }
      ),
      { numRuns: 300 }
    );
    expect(JSON.stringify(Object.getOwnPropertyNames(Object.prototype))).toBe(before);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((Object.prototype as any).polluted).toBeUndefined();
  });

  it('terminates within bounded time for a pathological deeply-nested key', () => {
    const deep = 'a' + '[x]'.repeat(2000);
    const start = performance.now();
    expectOnlyTypedThrow(() => parseUrlEncoded(`${deep}=v`));
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe('setNestedValue() — fuzz invariants (task 8.4)', () => {
  it('never throws an unhandled error, and never pollutes Object.prototype', () => {
    const before = JSON.stringify(Object.getOwnPropertyNames(Object.prototype));
    fc.assert(
      fc.property(
        fc.constantFrom(
          '__proto__',
          '__proto__[polluted]',
          'constructor',
          'constructor[prototype][polluted]',
          'a[b][c]',
          'items[]'
        ),
        fc.string({ maxLength: 50 }),
        (key, value) => {
          expectOnlyTypedThrow(() => {
            setNestedValue(Object.create(null) as Record<string, unknown>, key, value);
          });
        }
      ),
      { numRuns: 300 }
    );
    expect(JSON.stringify(Object.getOwnPropertyNames(Object.prototype))).toBe(before);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((Object.prototype as any).polluted).toBeUndefined();
  });
});
