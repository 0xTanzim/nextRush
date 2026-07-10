/** Unit tests for lib/metrics.js analyzers — run via `node --test`. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { analyzeCpuSamples, analyzeGcEvents, analyzeMemorySamples } from '../metrics.js';

test('analyzeCpuSamples: <2 samples yields 0%', () => {
  assert.deepEqual(analyzeCpuSamples([]), { cpuAvgPct: 0, cpuMaxPct: 0, samples: 0 });
  assert.deepEqual(analyzeCpuSamples([{ timestamp: 0, cpuTicks: 0 }]), {
    cpuAvgPct: 0,
    cpuMaxPct: 0,
    samples: 1,
  });
});

test('analyzeCpuSamples: 100 ticks over 1s at hz=100 is 100%', () => {
  const samples = [
    { timestamp: 0, cpuTicks: 0 },
    { timestamp: 1000, cpuTicks: 100 },
  ];
  const r = analyzeCpuSamples(samples, 100);
  assert.equal(r.cpuAvgPct, 100);
  assert.equal(r.cpuMaxPct, 100);
});

test('analyzeCpuSamples: half a core over the window', () => {
  const samples = [
    { timestamp: 0, cpuTicks: 0 },
    { timestamp: 1000, cpuTicks: 50 }, // 50%
    { timestamp: 2000, cpuTicks: 150 }, // 100%
  ];
  const r = analyzeCpuSamples(samples, 100);
  assert.equal(r.cpuMaxPct, 100);
  assert.equal(r.cpuAvgPct, 75); // mean of 50 and 100
});

test('analyzeMemorySamples: empty yields zeros', () => {
  assert.deepEqual(analyzeMemorySamples([]), { rssMin: 0, rssMax: 0, rssAvg: 0, rssPeak: 0 });
});

test('analyzeMemorySamples: formats peak/avg', () => {
  const r = analyzeMemorySamples([{ rss: 1048576 }, { rss: 2097152 }]);
  assert.equal(r.samples, 2);
  assert.equal(r.rssPeak, '2.0 MB');
  assert.equal(r.rssAvg, '1.5 MB');
});

test('analyzeGcEvents: empty yields zero counts', () => {
  assert.deepEqual(analyzeGcEvents([]), {
    count: 0,
    totalPauseMs: 0,
    maxPauseMs: 0,
    avgPauseMs: 0,
  });
});

test('analyzeGcEvents: counts scavenges and mark-compacts', () => {
  const r = analyzeGcEvents([
    { type: 'Scavenge', pauseMs: 1 },
    { type: 'Mark-Compact', pauseMs: 3 },
  ]);
  assert.equal(r.count, 2);
  assert.equal(r.scavenges, 1);
  assert.equal(r.markCompacts, 1);
  assert.equal(r.maxPauseMs, '3.00');
});
