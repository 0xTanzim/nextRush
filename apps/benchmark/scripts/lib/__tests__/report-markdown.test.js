import assert from 'node:assert/strict';
import { test } from 'node:test';

import { generateArtifacts, generateMarkdownReport } from '../../report-md.js';

function cell(rps) {
  return {
    runs: [{ errors: {} }],
    validRuns: 3,
    stats: { mean: rps, stddev: 10, min: rps, max: rps, cv: 1, values: [rps] },
    latency: { p50: '1.00ms', p99: '2.00ms' },
    invalid: false,
    summary: { rpsMean: rps, rpsStddev: 10, cv: 1 },
  };
}

/** Two frameworks whose ranking flips between concurrency levels. */
function fixture() {
  const scenarios = (low, high) => ({
    'hello-world': {
      scenario: 'Hello World',
      scenarioId: 'hello-world',
      concurrencyResults: { 1: cell(low), 64: cell(high) },
    },
    'middleware-stack': {
      scenario: 'Middleware Stack',
      scenarioId: 'middleware-stack',
      concurrencyResults: { 1: cell(low / 2), 64: cell(high / 2) },
    },
  });

  return {
    runId: 'compose-run',
    timestamp: '2026-01-01T00:00:00.000Z',
    profile: 'standard',
    publishable: true,
    tool: 'wrk',
    system: { cpuModel: 'Test CPU', nodeVersion: 'v26.0.0' },
    configuration: { duration: '30s', connections: [1, 64], runs: 3, threads: 4, scenarios: ['hello-world', 'middleware-stack'] },
    results: {
      'raw-node': {
        framework: 'Raw Node.js',
        frameworkId: 'raw-node',
        scenarios: scenarios(1000, 9000),
        memory: { rssPeak: '50 MB', rssAvg: '40 MB', samples: 30 },
        cpu: { cpuAvgPct: 80, cpuMaxPct: 95, samples: 30 },
        gc: { count: 5, totalPauseMs: '1.00', maxPauseMs: '0.50' },
      },
      'nextrush-v3': {
        framework: 'NextRush v3',
        frameworkId: 'nextrush-v3',
        scenarios: scenarios(1200, 8000),
      },
    },
  };
}

test('report ranks every scenario, not only hello-world', () => {
  const md = generateMarkdownReport(fixture());

  assert.match(md, /## Per-scenario rankings/);
  assert.match(md, /### 1\. Hello World — `hello-world` · like-for-like/);
  assert.match(md, /### 2\. Middleware Stack — `middleware-stack` · ⚠️ idiomatic/);
});

test('report carries a scenario-winners table and an overall points ranking', () => {
  const md = generateMarkdownReport(fixture());

  assert.match(md, /## Scenario winners @ 64 connections/);
  assert.match(md, /### Overall ranking — like-for-like scenarios only/);
  assert.match(md, /### Overall ranking — all 2 scenarios/);
});

test('report exposes the winner at every concurrency level, not just the headline one', () => {
  const md = generateMarkdownReport(fixture());

  assert.match(md, /### Winners by concurrency level/);
  // NextRush leads at 1 connection, Raw Node.js at 64 — both must be visible.
  const matrix = md.slice(md.indexOf('### Winners by concurrency level'));
  const helloRow = matrix.split('\n').find((line) => line.startsWith('| Hello World'));
  assert.match(helloRow, /NextRush v3/);
  assert.match(helloRow, /Raw Node.js/);
});

test('report includes charts, resources and methodology', () => {
  const md = generateMarkdownReport(fixture());

  assert.ok((md.match(/```mermaid/g) || []).length >= 4, 'expected at least four charts');
  assert.match(md, /## Resource Usage/);
  assert.match(md, /## Latency @ 64 connections/);
  assert.match(md, /## Fairness and methodology/);
  assert.match(md, /## Reproduce this/);
});

test('report ranks at the highest concurrency level by default and honours an override', () => {
  assert.match(generateMarkdownReport(fixture()), /Ranked at \*\*64 connections\*\*/);
  assert.match(generateMarkdownReport(fixture(), { rankAt: 1 }), /Ranked at \*\*1 connections\*\*/);
});

test('report warns when the profile is not publishable', () => {
  const report = fixture();
  report.publishable = false;
  report.configuration.runs = 1;

  const md = generateMarkdownReport(report);
  assert.match(md, /NOT publishable/);
  assert.match(md, /single run — no variance/);
});

test('generateArtifacts emits the report, README tables, CSV and scoreboard', () => {
  const artifacts = generateArtifacts(fixture());

  assert.deepEqual(Object.keys(artifacts).sort(), [
    'README-TABLES.md',
    'REPORT.md',
    'results.csv',
    'scoreboard.json',
  ]);
  assert.doesNotMatch(artifacts['README-TABLES.md'], /```mermaid/, 'npm renders no Mermaid');
  assert.equal(typeof JSON.parse(artifacts['scoreboard.json']).overall.likeForLike.maxPoints, 'number');
});
