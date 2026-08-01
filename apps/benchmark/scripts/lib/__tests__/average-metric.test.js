/**
 * fix-benchmark-harness-integrity (P1-006): a "peak" resource value combined
 * across multiple rotation passes must be the true maximum across those
 * passes, not the arithmetic mean of each pass's own maximum — averaging
 * maxima is internally inconsistent with what "peak" means. `rssPeak` is
 * stored as a `formatBytes()` string ("150.0 MB"), not a raw number.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { averageMetric } from '../../bench-rotation.js';

test('averageMetric takes the maximum across passes for rssPeak specifically (formatted-string values)', () => {
  const passes = [{ memory: { rssPeak: '100.0 MB' } }, { memory: { rssPeak: '300.0 MB' } }, { memory: { rssPeak: '200.0 MB' } }];
  const result = averageMetric(passes, 'memory');
  assert.equal(result.rssPeak, '300.0 MB', 'rssPeak must be the true maximum across passes, not their mean (200.0 MB)');
});

test('averageMetric compares rssPeak across mixed units correctly (KB vs MB vs GB)', () => {
  const passes = [{ memory: { rssPeak: '900.0 KB' } }, { memory: { rssPeak: '1.20 GB' } }, { memory: { rssPeak: '500.0 MB' } }];
  const result = averageMetric(passes, 'memory');
  assert.equal(result.rssPeak, '1.20 GB');
});

test('averageMetric still computes the arithmetic mean for non-rssPeak keys in the same object', () => {
  const passes = [
    { memory: { rssPeak: '100.0 MB', rssAvg: 60 } },
    { memory: { rssPeak: '300.0 MB', rssAvg: 40 } },
  ];
  const result = averageMetric(passes, 'memory');
  assert.equal(result.rssAvg, 50, 'rssAvg is unaffected by the rssPeak-specific fix');
  assert.equal(result.rssPeak, '300.0 MB');
});

test('averageMetric still computes the arithmetic mean as before for non-memory metric objects (e.g. cpu)', () => {
  const passes = [{ cpu: { cpuAvgPct: 80, cpuMaxPct: 95 } }, { cpu: { cpuAvgPct: 60, cpuMaxPct: 85 } }];
  const result = averageMetric(passes, 'cpu');
  assert.equal(result.cpuAvgPct, 70);
  assert.equal(result.cpuMaxPct, 90);
});

test('averageMetric returns undefined for an empty pass list', () => {
  assert.equal(averageMetric([], 'memory'), undefined);
});

test('averageMetric falls back to the first pass\'s raw rssPeak when no pass has a parseable value', () => {
  const passes = [{ memory: { rssPeak: undefined } }, { memory: { rssPeak: undefined } }];
  const result = averageMetric(passes, 'memory');
  assert.equal(result.rssPeak, undefined);
});
