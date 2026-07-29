/**
 * fix-benchmark-harness-integrity (P1-005/D8): a generated report's
 * methodology/metadata claims must be derived from the reported run's own
 * recorded state, never asserted as a fixed literal regardless of what the
 * run actually did.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { efficiencySection, headerSection, methodologySection, resourcesSection } from '../report/sections-detail.js';
import { buildScoreboard } from '../report/scoreboard.js';

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

function baseReport(overrides = {}) {
  return {
    runId: 'test-run',
    timestamp: '2026-01-01T00:00:00.000Z',
    profile: 'quick',
    publishable: false,
    publishableReason: null,
    tool: 'wrk',
    system: {},
    configuration: {
      duration: '10s',
      connections: [64],
      runs: 1,
      scenarios: ['hello-world', 'middleware-stack'],
      positionControl: 'rotated',
    },
    results: {
      'raw-node': {
        framework: 'Raw Node.js',
        frameworkId: 'raw-node',
        scenarios: {
          'hello-world': { scenario: 'Hello World', scenarioId: 'hello-world', concurrencyResults: { 64: cell(9000) } },
          'middleware-stack': {
            scenario: 'Middleware Stack',
            scenarioId: 'middleware-stack',
            concurrencyResults: { 64: cell(4000) },
          },
        },
      },
    },
    ...overrides,
  };
}

test('methodologySection states parity was not validated, with the recorded reason, when skipped', () => {
  const report = baseReport();
  report.configuration.parity = { validated: false, skippedReason: '--no-validate was passed', failures: [] };
  const sb = buildScoreboard(report);

  const lines = methodologySection(sb, { singleRun: true });
  const parityLine = lines.find((l) => l.includes('**Parity:**'));
  assert.ok(parityLine, 'must include a Parity line');
  assert.match(parityLine, /not validated/i);
  assert.match(parityLine, /--no-validate was passed/);
});

test('methodologySection states parity validation failed when the run recorded failures', () => {
  const report = baseReport();
  report.configuration.parity = { validated: false, skippedReason: null, failures: ['nextrush-v3 · hello-world: body differs'] };
  const sb = buildScoreboard(report);

  const lines = methodologySection(sb, { singleRun: true });
  const parityLine = lines.find((l) => l.includes('**Parity:**'));
  assert.match(parityLine, /fail/i);
});

test('methodologySection states parity was validated when the run recorded success', () => {
  const report = baseReport();
  report.configuration.parity = { validated: true, skippedReason: null, failures: [] };
  const sb = buildScoreboard(report);

  const lines = methodologySection(sb, { singleRun: true });
  const parityLine = lines.find((l) => l.includes('**Parity:**'));
  assert.match(parityLine, /validated/i);
  assert.doesNotMatch(parityLine, /not validated|fail/i);
});

test('methodologySection derives the scenario-fairness count from the run\'s own like-for-like scenarios, not a fixed "8"', () => {
  const report = baseReport(); // 1 like-for-like (hello-world) + 1 idiomatic (middleware-stack)
  const sb = buildScoreboard(report);

  const lines = methodologySection(sb, { singleRun: true });
  const fairnessLine = lines.find((l) => l.includes('**Scenario fairness:**'));
  assert.match(fairnessLine, /\b1 scenario/, `expected the count derived from this run (1), got: ${fairnessLine}`);
  assert.doesNotMatch(fairnessLine, /\b8 scenarios\b/);
  assert.match(fairnessLine, /Middleware Stack/, "must name the excluded scenario from this run's own data");
});

test('resourcesSection states the sampling interval read from the harness constant, not a hardcoded "once per second"', () => {
  const report = baseReport();
  report.results['raw-node'].memory = { rssPeak: '50 MB', rssAvg: '40 MB', samples: 10 };
  const sb = buildScoreboard(report);

  const lines = resourcesSection(sb);
  const intervalLine = lines.find((l) => l.toLowerCase().includes('sampled from `/proc`'));
  assert.ok(intervalLine);
  assert.doesNotMatch(intervalLine, /once per second/i);
  assert.match(intervalLine, /0\.5s|500\s*ms/i);
});

test('headerSection renders the recorded publishableReason verbatim when present', () => {
  const report = baseReport({ publishable: false, publishableReason: 'only 1 run(s) recorded — a publishable run needs at least 3 to report variance' });
  const sb = buildScoreboard(report);

  const lines = headerSection(sb);
  const warningLine = lines.find((l) => l.startsWith('> ⚠️'));
  assert.match(warningLine, /only 1 run\(s\) recorded/);
});

test('headerSection falls back to a generic explanation for a legacy report with no publishableReason', () => {
  const report = baseReport({ publishable: false, publishableReason: undefined });
  const sb = buildScoreboard(report);

  const lines = headerSection(sb);
  const warningLine = lines.find((l) => l.startsWith('> ⚠️'));
  assert.ok(warningLine, 'must still render a warning even with no specific reason recorded');
});

test('efficiencySection discloses that CPU/RSS are a whole-run aggregate, not scoped to the named scenario', () => {
  const report = baseReport();
  report.results['raw-node'].memory = { rssPeak: '50.0 MB', rssAvg: '40.0 MB', samples: 30 };
  report.results['raw-node'].cpu = { cpuAvgPct: 80, cpuMaxPct: 95, samples: 30 };
  const sb = buildScoreboard(report);

  const lines = efficiencySection(sb);
  const text = lines.join('\n');
  assert.match(text, /whole-run aggregate/i);
});
