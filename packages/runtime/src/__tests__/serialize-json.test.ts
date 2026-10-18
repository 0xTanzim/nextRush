/**
 * @nextrush/runtime - JSON body serialization
 *
 * One helper produces the JSON body for every response method on both adapter
 * families, so a value that cannot be represented throws the same typed error
 * with a message that names the offending value class instead of leaving each
 * adapter (and each call site) to fail differently.
 */

import { describe, expect, it } from 'vitest';
import { serializeJson } from '../serialize-json.js';

describe('serializeJson()', () => {
  it('returns the JSON text for a serializable value', () => {
    expect(serializeJson({ ok: true })).toBe('{"ok":true}');
    expect(serializeJson(null)).toBe('null');
    expect(serializeJson('text')).toBe('"text"');
    expect(serializeJson([])).toBe('[]');
  });

  it('keeps JSON.stringify semantics for values it can represent', () => {
    // A property-level undefined is dropped, not rejected — only a value with no
    // JSON representation at all is a failure.
    expect(serializeJson({ a: undefined })).toBe('{}');
    expect(serializeJson([1, undefined])).toBe('[1,null]');
    expect(serializeJson(new Map())).toBe('{}');
  });

  it.each([
    ['a BigInt', 10n, /BigInt/],
    ['undefined', undefined, /undefined/],
    ['a function', () => undefined, /function/],
    ['a Symbol', Symbol('value'), /Symbol/],
  ])('throws a TypeError naming %s', (_label, value, named) => {
    expect(() => serializeJson(value)).toThrow(TypeError);
    expect(() => serializeJson(value)).toThrow(named);
  });

  it('names the cycle when the value is circular', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expect(() => serializeJson(cyclic)).toThrow(TypeError);
    expect(() => serializeJson(cyclic)).toThrow(/circular/i);
  });

  it('names a non-serializable value nested inside an array', () => {
    expect(() => serializeJson([1, 2, 10n])).toThrow(/BigInt/);
  });
});
