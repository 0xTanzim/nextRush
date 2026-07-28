import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  concurrencyScalingChart,
  latencyChart,
  overallPointsChart,
  scenarioRpsChart,
  scenarioProfileRadar,
  trendChart,
} from '../report/charts.js';
import { toCsv } from '../report/csv.js';
import { buildScoreboard } from '../report/scoreboard.js';

function cell(rps, { stddev = 10, p50 = '1.00ms', p99 = '2.00ms' } = {}) {
  return {
    runs: [{ errors: {} }],
    validRuns: 3,
    stats: { mean: rps, stddev, min: rps, max: rps, cv: 1, values: [rps] },
    latency: { p50, p99 },
    invalid: false,
    summary: { rpsMean: rps, rpsStddev: stddev, cv: 1 },
  };
}

function fixture() {
  const mk = (hw1, hw64, mw1, mw64, p99) => ({
    'hello-world': {
      scenario: 'Hello World',
      scenarioId: 'hello-world',
      concurrencyResults: { 1: cell(hw1, { p99 }), 64: cell(hw64, { p99 }) },
    },
    'middleware-stack': {
      scenario: 'Middleware Stack',
      scenarioId: 'middleware-stack',
      concurrencyResults: { 1: cell(mw1), 64: cell(mw64) },
    },
  });

  return {
    runId: 'chart-run',
    timestamp: '2026-01-01T00:00:00.000Z',
    profile: 'standard',
    publishable: true,
    tool: 'wrk',
    system: {},
    configuration: { connections: [1, 64], runs: 3, scenarios: ['hello-world', 'middleware-stack'] },
    results: {
      'raw-node': { framework: 'Raw Node.js', frameworkId: 'raw-node', scenarios: mk(1000, 9000, 500, 4000, '1.50ms') },
      'nextrush-v3': { framework: 'NextRush v3', frameworkId: 'nextrush-v3', scenarios: mk(1200, 8000, 400, 5000, '2.50ms') },
      express: { framework: 'Express "quoted"', frameworkId: 'express', scenarios: mk(800, 3000, 300, 2000, '9.00ms') },
    },
  };
}

test('scenarioRpsChart emits a mermaid xychart with bars ordered fastest-first', () => {
  const chart = scenarioRpsChart(buildScoreboard(fixture()), 'hello-world', 64);

  assert.match(chart, /^```mermaid\n/);
  assert.match(chart, /\n```$/);
  assert.match(chart, /xychart-beta horizontal/);
  assert.match(chart, /x-axis \["Raw Node.js", "NextRush v3", "Express 'quoted'"\]/);
  assert.match(chart, /bar \[9000, 8000, 3000\]/);
  assert.match(chart, /y-axis "Requests\/sec" 0 --> \d+/);
});

test('scenarioRpsChart returns an empty string when the scenario has no data', () => {
  assert.equal(scenarioRpsChart(buildScoreboard(fixture()), 'nope', 64), '');
});

test('latencyChart plots p99 in milliseconds, lowest-first', () => {
  const chart = latencyChart(buildScoreboard(fixture()), 'hello-world', 64);

  assert.match(chart, /x-axis \["Raw Node.js", "NextRush v3", "Express 'quoted'"\]/);
  assert.match(chart, /bar \[1.5, 2.5, 9\]/);
  assert.match(chart, /y-axis "p99 latency \(ms\) — lower is better"/);
});

test('concurrencyScalingChart plots one unnamed line per framework across connection levels', () => {
  const chart = concurrencyScalingChart(buildScoreboard(fixture()), 'hello-world');

  assert.match(chart, /x-axis "Concurrent connections" \["1", "64"\]/);
  // Attribution is provided by the stable legend table below each chart; labels
  // inside the plot collide when series converge and clip at the right boundary.
  assert.match(chart, /line \[1000, 9000\]/);
  assert.match(chart, /line \[1200, 8000\]/);
  assert.doesNotMatch(chart, /"Raw Node\.js"\]/, 'framework names must not be endpoint labels');
  assert.doesNotMatch(chart, /"NextRush v3"\]/, 'framework names must not be endpoint labels');
});

test('concurrencyScalingChart assigns a fixed, visually distinct color per framework', () => {
  const chart = concurrencyScalingChart(buildScoreboard(fixture()), 'hello-world');

  assert.match(chart, /plotColorPalette:/);
  const palette = chart.match(/plotColorPalette:\s*'([^']+)'/)[1].split(',').map((c) => c.trim());
  assert.equal(new Set(palette).size, palette.length, 'palette colors must be unique');
  assert.ok(palette.length >= 3, 'fixture has 3 frameworks worth of series');
});

test('scenarioProfileRadar normalizes each like-for-like scenario to percent of best', () => {
  const radar = scenarioProfileRadar(buildScoreboard(fixture()));

  assert.match(radar, /radar-beta/);
  assert.match(radar, /axis hello_world\["Hello World"\]/);
  assert.doesNotMatch(radar, /Middleware Stack/);
  assert.match(radar, /curve raw_node\["Raw Node.js"\]\{100\}/);
  assert.match(radar, /curve nextrush_v3\["NextRush v3"\]\{89\}/);
  assert.match(radar, /max 100/);
});

test('overallPointsChart plots the like-for-like points total per framework', () => {
  const chart = overallPointsChart(buildScoreboard(fixture()));

  assert.match(chart, /xychart-beta horizontal/);
  // raw-node and nextrush-v3 each win one concurrency level, so they tie at 5.
  assert.match(chart, /bar \[5, 5, 2\]/);
});

test('trendChart plots one point per historical run', () => {
  const chart = trendChart([
    { runId: 'r1', value: 30000 },
    { runId: 'r2', value: 31000 },
  ]);

  assert.match(chart, /x-axis \["r1", "r2"\]/);
  assert.match(chart, /line \[30000, 31000\]/);
});

test('trendChart needs at least two points to be meaningful', () => {
  assert.equal(trendChart([{ runId: 'r1', value: 1 }]), '');
});

test('toCsv emits one row per framework/scenario/connection with rank and points', () => {
  const csv = toCsv(buildScoreboard(fixture()));
  const lines = csv.trim().split('\n');

  assert.equal(lines[0].split(',')[0], 'run_id');
  assert.ok(lines[0].includes('rps_mean'));
  assert.ok(lines[0].includes('points'));
  // 3 frameworks x 2 scenarios x 2 connections
  assert.equal(lines.length - 1, 12);

  const rawHello64 = lines.find((l) => l.includes('raw-node,Raw Node.js,hello-world') && l.endsWith(',1,3'));
  assert.ok(rawHello64, 'expected the raw-node hello-world winner row to carry rank 1 and 3 points');
});

test('toCsv quotes a field containing a comma or quote', () => {
  const csv = toCsv(buildScoreboard(fixture()));

  assert.ok(csv.includes('"Express ""quoted"""'));
});
