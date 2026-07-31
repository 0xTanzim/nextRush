import assert from 'node:assert/strict';
import { test } from 'node:test';

import { throughputLatencyQuadrant } from '../report/charts.js';
import { buildHistory } from '../report/history.js';
import { efficiencySection } from '../report/sections-detail.js';
import { buildScoreboard } from '../report/scoreboard.js';

function cell(rps, p99 = '5.00ms') {
  return {
    runs: [{ errors: {} }],
    validRuns: 3,
    stats: { mean: rps, stddev: 10, min: rps, max: rps, cv: 1, values: [rps] },
    latency: { p50: '1.00ms', p99 },
    invalid: false,
    summary: { rpsMean: rps, rpsStddev: 10, cv: 1 },
  };
}

function helloOnly(rps, p99, conns = [64]) {
  return {
    'hello-world': {
      scenario: 'Hello World',
      scenarioId: 'hello-world',
      concurrencyResults: Object.fromEntries(conns.map((c) => [c, cell(rps, p99)])),
    },
  };
}

function run(runId, frameworks, { profile = 'standard', publishable = true, conns = [64], tool = 'wrk' } = {}) {
  return {
    runId,
    timestamp: `${runId}Z`,
    profile,
    publishable,
    tool,
    system: {},
    configuration: { connections: conns, runs: 3, scenarios: ['hello-world'] },
    results: Object.fromEntries(
      Object.entries(frameworks).map(([id, spec]) => [
        id,
        {
          framework: spec.name,
          frameworkId: id,
          scenarios: helloOnly(spec.rps, spec.p99 || '5.00ms', conns),
          memory: spec.memory,
          cpu: spec.cpu,
          sampleCoverage: spec.sampleCoverage,
        },
      ])
    ),
  };
}

const SIX = (rps) => ({
  'raw-node': { name: 'Raw Node.js', rps: rps + 2000 },
  'nextrush-v3': { name: 'NextRush v3', rps },
});

test('history excludes a run with a different framework set from the trend lines', () => {
  const md = buildHistory([
    run('2026-01-01', SIX(30000)),
    // Single-framework run: NextRush trivially scores 100% — not comparable.
    run('2026-01-02', { 'nextrush-v3': { name: 'NextRush v3', rps: 30000 } }),
    run('2026-01-03', SIX(31000)),
  ]);

  assert.match(md, /## Overall score trend/);
  const chart = md.slice(md.indexOf('## Overall score trend'));
  const line = chart.split('\n').find((l) => l.trim().startsWith('line ['));
  assert.equal(line.trim(), 'line [50, 50]', 'only the two comparable runs may be plotted');
  assert.match(md, /2026-01-02.*different framework set/s);
});

test('history excludes a run measured with a different tool or connection ladder', () => {
  const md = buildHistory([
    run('2026-02-01', SIX(30000)),
    run('2026-02-02', SIX(30000), { tool: 'autocannon' }),
    run('2026-02-03', SIX(30000), { conns: [64, 256] }),
  ]);

  assert.match(md, /2026-02-02.*different tool/s);
  assert.match(md, /2026-02-03.*different concurrency ladder/s);
});

test('history marks a non-publishable profile as not comparable', () => {
  const md = buildHistory([
    run('2026-03-01', SIX(30000)),
    run('2026-03-02', SIX(30000), { profile: 'quick', publishable: false }),
  ]);

  assert.match(md, /2026-03-02.*not publishable/s);
});

test('history states which shape the trend is anchored to', () => {
  const md = buildHistory([run('2026-04-01', SIX(30000)), run('2026-04-02', SIX(31000))]);

  assert.match(md, /Comparable/);
  assert.match(md, /anchored to/i);
});

test('throughputLatencyQuadrant normalizes both axes into the 0-1 range', () => {
  const scoreboard = buildScoreboard(
    run('q', {
      'raw-node': { name: 'Raw Node.js', rps: 30000, p99: '5.00ms' },
      'nextrush-v3': { name: 'NextRush v3', rps: 20000, p99: '9.00ms' },
    })
  );
  const chart = throughputLatencyQuadrant(scoreboard, 'hello-world', 64);

  assert.match(chart, /quadrantChart/);
  assert.match(chart, /x-axis Lower throughput --> Higher throughput/);
  assert.match(chart, /y-axis Higher p99 latency --> Lower p99 latency/);
  for (const [, x, y] of chart.matchAll(/: \[([\d.]+), ([\d.]+)\]/g)) {
    assert.ok(Number(x) >= 0 && Number(x) <= 1, `x out of range: ${x}`);
    assert.ok(Number(y) >= 0 && Number(y) <= 1, `y out of range: ${y}`);
  }
  // Fastest with the lowest latency lands in the top-right quadrant.
  assert.match(chart, /Raw Node.js: \[0\.9\d*, 0\.9\d*\]/);
});

test('throughputLatencyQuadrant needs at least two frameworks with latency data', () => {
  const scoreboard = buildScoreboard(run('q', { 'raw-node': { name: 'Raw Node.js', rps: 30000 } }));

  assert.equal(throughputLatencyQuadrant(scoreboard, 'hello-world', 64), '');
});

test('efficiency table reports throughput per CPU percent and per megabyte of RSS', () => {
  const scoreboard = buildScoreboard(
    run('e', {
      'raw-node': {
        name: 'Raw Node.js',
        rps: 30000,
        memory: { rssPeak: '100.0 MB', rssAvg: '90.0 MB', samples: 30 },
        cpu: { cpuAvgPct: 200, cpuMaxPct: 250, samples: 30 },
        // Verified coverage: without it the CPU/efficiency sections are suppressed as
        // unverified, which is the point of audit F-19 — these fixtures exist to
        // exercise the rendering, so they declare a sampler that covered its window.
        sampleCoverage: { samples: 30, spanMs: 15000, expectedSamples: 31, coveragePct: 96.8, starved: false },
      },
      'nextrush-v3': {
        name: 'NextRush v3',
        rps: 15000,
        memory: { rssPeak: '150.0 MB', rssAvg: '140.0 MB', samples: 30 },
        cpu: { cpuAvgPct: 150, cpuMaxPct: 200, samples: 30 },
        // Verified coverage: without it the CPU/efficiency sections are suppressed as
        // unverified, which is the point of audit F-19 — these fixtures exist to
        // exercise the rendering, so they declare a sampler that covered its window.
        sampleCoverage: { samples: 30, spanMs: 15000, expectedSamples: 31, coveragePct: 96.8, starved: false },
      },
    })
  );
  const md = efficiencySection(scoreboard).join('\n');

  assert.match(md, /## Efficiency/);
  assert.match(md, /RPS per CPU%/);
  assert.match(md, /\| Raw Node.js \| 30,000 \| 200% \| 150 \| 100.0 MB \| 300 \|/);
  assert.match(md, /\| NextRush v3 \| 15,000 \| 150% \| 100 \| 150.0 MB \| 100 \|/);
});

test('efficiency table is omitted when no resource samples were collected', () => {
  const scoreboard = buildScoreboard(run('e', { 'raw-node': { name: 'Raw Node.js', rps: 30000 } }));

  assert.deepEqual(efficiencySection(scoreboard), []);
});
