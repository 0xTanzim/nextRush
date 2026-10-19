import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeWire } from '../wire-summary.mjs';

test('summarizes three runs with the median and the observed range', () => {
  const summary = summarizeWire([100, 120, 110]);
  assert.equal(summary.median, 110);
  assert.equal(summary.min, 100);
  assert.equal(summary.max, 120);
  assert.equal(summary.display, '110 rps (100–120)');
});

test('summarizes a single run', () => {
  const summary = summarizeWire([100]);
  assert.equal(summary.median, 100);
  assert.equal(summary.min, 100);
  assert.equal(summary.max, 100);
  assert.equal(summary.display, '100 rps (100–100)');
});

test('averages the two middle values for an even run count', () => {
  const summary = summarizeWire([100, 120]);
  assert.equal(summary.median, 110);
  assert.equal(summary.display, '110 rps (100–120)');
});

test('rejects an empty run set', () => {
  assert.throws(() => summarizeWire([]), /at least one run/);
});

test('rejects a non-finite run', () => {
  assert.throws(() => summarizeWire([100, Number.NaN]), /finite/);
});
