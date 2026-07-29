import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rotate } from '../../bench-rotation.js';

test('rotate shifts items left by the given offset (round-robin)', () => {
  assert.deepEqual(rotate(['a', 'b', 'c'], 0), ['a', 'b', 'c']);
  assert.deepEqual(rotate(['a', 'b', 'c'], 1), ['b', 'c', 'a']);
  assert.deepEqual(rotate(['a', 'b', 'c'], 2), ['c', 'a', 'b']);
});

test('rotate wraps the offset modulo the array length', () => {
  assert.deepEqual(rotate(['a', 'b', 'c'], 3), ['a', 'b', 'c']);
  assert.deepEqual(rotate(['a', 'b', 'c'], 4), ['b', 'c', 'a']);
});

test('rotate handles a negative offset by wrapping forward', () => {
  assert.deepEqual(rotate(['a', 'b', 'c'], -1), ['c', 'a', 'b']);
});

test('rotate returns an empty array for an empty input, regardless of offset', () => {
  assert.deepEqual(rotate([], 0), []);
  assert.deepEqual(rotate([], 5), []);
});

test('rotate is a no-op for a single-element array at any offset', () => {
  assert.deepEqual(rotate(['only'], 0), ['only']);
  assert.deepEqual(rotate(['only'], 7), ['only']);
});

test('every item occupies every position exactly once across N repeats when N is a multiple of the framework count (exact balance)', () => {
  const frameworks = ['a', 'b', 'c'];
  const positionCounts = new Map(frameworks.map((f) => [f, new Array(frameworks.length).fill(0)]));

  const repeats = 6; // multiple of 3
  for (let r = 0; r < repeats; r++) {
    const order = rotate(frameworks, r);
    order.forEach((fw, position) => positionCounts.get(fw)[position]++);
  }

  for (const fw of frameworks) {
    for (const count of positionCounts.get(fw)) {
      assert.equal(count, repeats / frameworks.length, `${fw} must occupy every position exactly ${repeats / frameworks.length} times`);
    }
  }
});

test('position balance stays within ±1 across repeats when the repeat count is not a multiple of the framework count', () => {
  const frameworks = ['a', 'b', 'c'];
  const positionCounts = new Map(frameworks.map((f) => [f, new Array(frameworks.length).fill(0)]));

  const repeats = 5; // not a multiple of 3
  for (let r = 0; r < repeats; r++) {
    const order = rotate(frameworks, r);
    order.forEach((fw, position) => positionCounts.get(fw)[position]++);
  }

  const allCounts = frameworks.flatMap((fw) => positionCounts.get(fw));
  const min = Math.min(...allCounts);
  const max = Math.max(...allCounts);
  assert.ok(max - min <= 1, `position counts must stay within ±1 of each other, got min=${min} max=${max}`);
});

test('rotate never mutates the input array', () => {
  const input = ['a', 'b', 'c'];
  const copy = [...input];
  rotate(input, 1);
  assert.deepEqual(input, copy);
});
