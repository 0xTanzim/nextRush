/**
 * @nextrush/runtime - Query container shape and safety
 *
 * `ctx.query` is built on a shared null-prototype base rather than
 * `Object.create(null)`, so V8 keeps it in fast-property mode and handler reads
 * stay inline-cacheable. These tests pin the security invariant that change had
 * to preserve, plus the enumeration behaviour application code depends on.
 *
 * The V8 fast-property assertion itself lives in
 * `apps/benchmark/scripts/alloc/params-shape-gate.mjs` — `%HasFastProperties`
 * needs `--allow-natives-syntax`, which vitest's `threads` pool cannot enable.
 *
 * @see docs/adr/ADR-0021-fast-property-request-containers.md
 */

import { describe, expect, it } from 'vitest';
import { parseQueryString } from '../query';

describe('query container — Object.prototype is unreachable', () => {
  it('never passes through Object.prototype in its chain', () => {
    let proto: unknown = Object.getPrototypeOf(parseQueryString('q=hello'));
    let hops = 0;
    while (proto !== null) {
      expect(proto).not.toBe(Object.prototype);
      proto = Object.getPrototypeOf(proto as object);
      expect(++hops).toBeLessThan(10);
    }
  });

  it('exposes no inherited members', () => {
    const query = parseQueryString('q=hello') as Record<string, unknown>;
    expect(query['toString']).toBeUndefined();
    expect(query['hasOwnProperty']).toBeUndefined();
    expect(query['constructor']).toBeUndefined();
    expect(query instanceof Object).toBe(false);
  });

  it('shares one prototype across calls and for the empty sentinel', () => {
    const a = Object.getPrototypeOf(parseQueryString('a=1'));
    const b = Object.getPrototypeOf(parseQueryString('b=2'));
    const empty = Object.getPrototypeOf(parseQueryString(''));
    expect(a).toBe(b);
    expect(a).toBe(empty);
    expect(Object.getPrototypeOf(a as object)).toBeNull();
  });

  it('still rejects the denied keys outright', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const parsed = parseQueryString(`${key}=ATTACK`);
      expect(Object.keys(parsed)).toHaveLength(0);
      expect(Object.prototype.hasOwnProperty.call(parsed, key)).toBe(false);
    }
    expect(({} as Record<string, unknown>)['ATTACK']).toBeUndefined();
    expect((Object.prototype as Record<string, unknown>)['ATTACK']).toBeUndefined();
  });

  it('behaves identically to a plain object under every enumeration path', () => {
    const query = parseQueryString('id=42&tab=profile');
    expect(JSON.stringify(query)).toBe('{"id":"42","tab":"profile"}');
    expect({ ...query }).toEqual({ id: '42', tab: 'profile' });
    expect(Object.keys(query)).toEqual(['id', 'tab']);
    const seen: string[] = [];
    for (const k in query) seen.push(k);
    expect(seen).toEqual(['id', 'tab']);
    expect(structuredClone(query)).toEqual({ id: '42', tab: 'profile' });
  });
});

describe('query decode fast path (F-4) is behaviour-preserving', () => {
  it('returns non-encoded input unchanged', () => {
    expect(parseQueryString('q=hello&limit=10')).toEqual({ q: 'hello', limit: '10' });
  });

  it('still percent-decodes keys and values', () => {
    expect(parseQueryString('a%20b=c%20d')).toEqual({ 'a b': 'c d' });
    expect(parseQueryString('q=%E2%9C%93')).toEqual({ q: '✓' });
  });

  it('still treats + as a space (form encoding)', () => {
    expect(parseQueryString('q=hello+world')).toEqual({ q: 'hello world' });
    expect(parseQueryString('a+b=c+d')).toEqual({ 'a b': 'c d' });
  });

  it('handles a mixed + and % value', () => {
    expect(parseQueryString('q=a+b%20c')).toEqual({ q: 'a b c' });
  });

  it('falls back to the raw string on malformed encoding rather than throwing', () => {
    expect(() => parseQueryString('q=%E0%A4%A')).not.toThrow();
    expect(parseQueryString('q=%')).toEqual({ q: '%' });
  });

  it('leaves a value containing neither % nor + byte-identical', () => {
    const raw = 'plain-value_123.abc~xyz';
    expect((parseQueryString(`q=${raw}`) as Record<string, string>)['q']).toBe(raw);
  });
});
