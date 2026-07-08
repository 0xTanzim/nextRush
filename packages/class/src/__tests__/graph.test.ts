/**
 * Unit tests for the Application Graph IR (P3.4): proves the graph is genuinely
 * assembled and deep-frozen (read-once, freeze, run). Integration behavior
 * (routes register from the frozen graph; request scope/singleton preserved) is
 * covered by characterization.test.ts, which drives the full bootstrap pipeline.
 */
import { describe, expect, it } from 'vitest';

import { buildApplicationGraph } from '../bootstrap/graph.js';
import { deepFreeze } from '../internal.js';

class CtrlA {}
class DepA {}

describe('deepFreeze', () => {
  it('recursively freezes nested objects and arrays', () => {
    const obj = { a: { b: 1 }, list: [{ x: 1 }] };
    const frozen = deepFreeze(obj);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.a)).toBe(true);
    expect(Object.isFrozen(frozen.list)).toBe(true);
    expect(Object.isFrozen(frozen.list[0])).toBe(true);
  });

  it('freezes Maps and Sets', () => {
    const map = deepFreeze(new Map([['k', { v: 1 }]]));
    const set = deepFreeze(new Set([{ v: 2 }]));
    expect(Object.isFrozen(map)).toBe(true);
    expect(Object.isFrozen(set)).toBe(true);
  });

  it('passes primitives and functions through unchanged', () => {
    expect(deepFreeze(5)).toBe(5);
    const fn = (): number => 1;
    expect(deepFreeze(fn)).toBe(fn);
  });
});

describe('buildApplicationGraph', () => {
  it('assembles a deep-frozen immutable graph from boot artifacts', () => {
    const providers = new Map<Function, Function[]>([[CtrlA, [DepA]]]);
    const requestScoped = new Set<Function>([DepA]);

    const graph = buildApplicationGraph([], providers, requestScoped);

    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.isFrozen(graph.routes)).toBe(true);
    expect(Object.isFrozen(graph.providers)).toBe(true);
    expect(Object.isFrozen(graph.requestScopedTokens)).toBe(true);

    // Real data preserved (not a hollow structure).
    expect(graph.providers.get(CtrlA)).toEqual([DepA]);
    expect(graph.requestScopedTokens.has(DepA)).toBe(true);
  });

  it('produces an immutable routes array (mutation throws in strict mode)', () => {
    const graph = buildApplicationGraph([], new Map(), new Set());
    expect(() => {
      (graph.routes as unknown[]).push({});
    }).toThrow();
  });
});
