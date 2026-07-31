/**
 * Regressions for the measurement-validity fixes (audit F-19, F-21, F-25).
 *
 * Each test pins a defect that produced a plausible-looking but wrong number
 * rather than an error, which is why none of them were caught by the existing
 * suite.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeSampleCoverage, MIN_SAMPLE_COVERAGE_PCT } from '../metrics.js';
import { countPinnedCpus, resolveClientThreads } from '../system.js';
import { isInvalidRun } from '../stats.js';
import { getScenario } from '../../../config/scenarios.js';

const sampleSeries = (count, intervalMs, startedAt = 1_000_000) =>
  Array.from({ length: count }, (_, i) => ({ timestamp: startedAt + i * intervalMs }));

test('F-19: a continuously-firing sampler reports full coverage and is not starved', () => {
  const coverage = analyzeSampleCoverage(sampleSeries(120, 500), 500);
  assert.equal(coverage.samples, 120);
  assert.equal(coverage.coveragePct, 100);
  assert.equal(coverage.starved, false);
});

test('F-19: a sampler that only fired in idle gaps is reported starved, not averaged silently', () => {
  // 65 samples spread across a ~1,185s window is what the blocking-execSync
  // runner actually produced: the sampler could only fire during the 2s pauses
  // between tests, so every CPU/RSS figure described an idle server.
  const starved = [];
  for (let i = 0; i < 65; i += 1) starved.push({ timestamp: 1_000_000 + i * 18_000 });

  const coverage = analyzeSampleCoverage(starved, 500);
  assert.equal(coverage.starved, true);
  assert.ok(
    coverage.coveragePct < MIN_SAMPLE_COVERAGE_PCT,
    `expected coverage below ${MIN_SAMPLE_COVERAGE_PCT}%, got ${coverage.coveragePct}%`
  );
});

test('F-19: fewer than two samples cannot establish coverage and is treated as starved', () => {
  assert.equal(analyzeSampleCoverage([], 500).starved, true);
  assert.equal(analyzeSampleCoverage(sampleSeries(1, 500), 500).starved, true);
});

test('F-21: the real error scenario is exempt from non-2xx invalidation', () => {
  const scenario = getScenario('error-handling');
  assert.equal(scenario.expectStatus, 500);
  assert.equal(
    isInvalidRun(scenario, { errors: { nonOk: 2_293_866 } }),
    false,
    'a 500-expecting scenario must not be invalidated by its own expected 500s'
  );
});

test('F-21: an id-only scenario stand-in silently loses the exemption', () => {
  // This is the exact defect: bench-rotation.js rebuilt the scenario as
  // `{ id }`, so `expectStatus` was absent and every expected 500 counted as a
  // failure. Pinned so a future refactor cannot reintroduce it unnoticed.
  assert.equal(
    isInvalidRun({ id: 'error-handling' }, { errors: { nonOk: 1 } }),
    true,
    'the stand-in must be demonstrably unsafe, which is why the real object is required'
  );
});

test('F-21: a success scenario is still invalidated by non-2xx responses', () => {
  const scenario = getScenario('hello-world');
  assert.equal(isInvalidRun(scenario, { errors: { nonOk: 1 } }), true);
  assert.equal(isInvalidRun(scenario, { errors: { nonOk: 0 } }), false);
});

test('F-25: countPinnedCpus understands every taskset spec form', () => {
  assert.equal(countPinnedCpus('2'), 1);
  assert.equal(countPinnedCpus('0-1'), 2);
  assert.equal(countPinnedCpus('2-7'), 6);
  assert.equal(countPinnedCpus('0,2,4'), 3);
  assert.equal(countPinnedCpus('0-1,4-5'), 4);
  assert.equal(countPinnedCpus(null), null);
  assert.equal(countPinnedCpus(''), null);
  assert.equal(countPinnedCpus('nonsense'), null);
  assert.equal(countPinnedCpus('5-2'), null, 'a reversed range is not a valid spec');
});

test('F-25: wrk threads are capped to the CPUs the client is pinned to', () => {
  const capped = resolveClientThreads(4, '0-1');
  assert.equal(capped.threads, 2);
  assert.equal(capped.capped, true);
  assert.equal(capped.pinnedCpus, 2);
});

test('F-25: an unpinned or sufficiently-wide client keeps its requested thread count', () => {
  assert.deepEqual(resolveClientThreads(4, null), { threads: 4, capped: false, pinnedCpus: null });
  assert.deepEqual(resolveClientThreads(4, '0-7'), { threads: 4, capped: false, pinnedCpus: 8 });
  assert.deepEqual(resolveClientThreads(2, '0-1'), { threads: 2, capped: false, pinnedCpus: 2 });
});
