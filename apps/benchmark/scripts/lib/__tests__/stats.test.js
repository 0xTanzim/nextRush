/** Unit tests for lib/stats.js — run via `node --test`. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  aggregateLatency,
  computeStats,
  filterValidRuns,
  isInvalidRun,
  parseLatencyToMs,
} from '../stats.js';

test('computeStats: empty input yields zeros', () => {
  assert.deepEqual(computeStats([]), { mean: 0, stddev: 0, min: 0, max: 0, cv: 0, values: [] });
});

test('computeStats: single value has zero stddev and cv', () => {
  const s = computeStats([100]);
  assert.equal(s.mean, 100);
  assert.equal(s.stddev, 0);
  assert.equal(s.cv, 0);
});

test('computeStats: known sample stddev (Bessel-corrected)', () => {
  // values 10,20,30 → mean 20, sample stddev = 10
  const s = computeStats([10, 20, 30]);
  assert.equal(s.mean, 20);
  assert.equal(s.stddev, 10);
  assert.equal(s.min, 10);
  assert.equal(s.max, 30);
  assert.equal(s.cv, 50); // 10/20 * 100
});

test('isInvalidRun: success scenario with non-2xx is invalid', () => {
  assert.equal(isInvalidRun({ expectStatus: 200 }, { errors: { nonOk: 5 } }), true);
});

test('isInvalidRun: success scenario with no non-2xx is valid', () => {
  assert.equal(isInvalidRun({ expectStatus: 200 }, { errors: { nonOk: 0 } }), false);
});

test('isInvalidRun: error scenario (>=400) is never invalid on non-2xx', () => {
  assert.equal(isInvalidRun({ expectStatus: 500 }, { errors: { nonOk: 999 } }), false);
});

test('filterValidRuns: excludes invalid runs and flags state', () => {
  const scenario = { expectStatus: 200 };
  const runs = [
    { rps: 100, errors: { nonOk: 0 } },
    { rps: 999, errors: { nonOk: 3 } }, // invalid — must be excluded
    { rps: 110, errors: { nonOk: 0 } },
  ];
  const { valid, anyInvalid, allInvalid } = filterValidRuns(scenario, runs);
  assert.equal(valid.length, 2);
  assert.equal(anyInvalid, true);
  assert.equal(allInvalid, false);
  assert.deepEqual(valid.map((r) => r.rps), [100, 110]);
});

test('filterValidRuns: allInvalid true when every run errored', () => {
  const { valid, allInvalid } = filterValidRuns({ expectStatus: 200 }, [
    { errors: { nonOk: 1 } },
    { errors: { nonOk: 2 } },
  ]);
  assert.equal(valid.length, 0);
  assert.equal(allInvalid, true);
});

test('parseLatencyToMs: handles us/ms/s and unitless', () => {
  assert.equal(parseLatencyToMs('2.68ms'), 2.68);
  assert.equal(parseLatencyToMs('900.00us'), 0.9);
  assert.equal(parseLatencyToMs('1.20s'), 1200);
  assert.equal(parseLatencyToMs('5'), 5);
});

test('parseLatencyToMs: unparseable input returns null', () => {
  assert.equal(parseLatencyToMs('N/A'), null);
  assert.equal(parseLatencyToMs(undefined), null);
});

test('aggregateLatency: medians each percentile across runs', () => {
  const runs = [
    { latency: { p50: '2.00ms', p99: '5.00ms' } },
    { latency: { p50: '4.00ms', p99: '9.00ms' } },
    { latency: { p50: '3.00ms', p99: '7.00ms' } },
  ];
  assert.deepEqual(aggregateLatency(runs), { p50: '3.00ms', p99: '7.00ms' });
});

test('aggregateLatency: no parseable latency yields N/A', () => {
  assert.deepEqual(aggregateLatency([{ latency: {} }]), { p50: 'N/A', p99: 'N/A' });
});
