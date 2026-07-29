import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildScoreboard,
  POINTS_FOR_LAST_PLACE,
  rankEntries,
} from '../report/scoreboard.js';

/** Minimal concurrency-result shape matching what bench-exec.js persists. */
function cell(rps, { stddev = 10, p50 = '1.00ms', p99 = '2.00ms', nonOk = 0 } = {}) {
  return {
    connections: 0,
    runs: [{ errors: nonOk ? { nonOk } : {} }],
    validRuns: 1,
    stats: { mean: rps, stddev, min: rps, max: rps, cv: 1, values: [rps] },
    latency: { p50, p99 },
    invalid: false,
    allInvalid: false,
    summary: { rpsMean: rps, rpsStddev: stddev, rpsMin: rps, rpsMax: rps, cv: 1 },
  };
}

function scenario(id, name, cells) {
  return { scenario: name, scenarioId: id, concurrencyResults: cells };
}

/**
 * Fixture: 3 frameworks x 2 scenarios x 2 concurrency levels.
 * hello-world is like-for-like; middleware-stack is NOT (identicalWork: false).
 */
function fixture() {
  return {
    runId: 'test-run',
    timestamp: '2026-01-01T00:00:00.000Z',
    profile: 'standard',
    publishable: true,
    tool: 'wrk',
    system: { platform: 'linux' },
    configuration: { duration: '30s', connections: [1, 64], runs: 3, threads: 4, scenarios: ['hello-world', 'middleware-stack'] },
    results: {
      'raw-node': {
        framework: 'Raw Node.js',
        frameworkId: 'raw-node',
        scenarios: {
          'hello-world': scenario('hello-world', 'Hello World', { 1: cell(1000), 64: cell(9000) }),
          'middleware-stack': scenario('middleware-stack', 'Middleware Stack', { 1: cell(500), 64: cell(4000) }),
        },
      },
      'nextrush-v3': {
        framework: 'NextRush v3',
        frameworkId: 'nextrush-v3',
        scenarios: {
          'hello-world': scenario('hello-world', 'Hello World', { 1: cell(1200), 64: cell(8000) }),
          'middleware-stack': scenario('middleware-stack', 'Middleware Stack', { 1: cell(400), 64: cell(5000) }),
        },
      },
      express: {
        framework: 'Express',
        frameworkId: 'express',
        scenarios: {
          'hello-world': scenario('hello-world', 'Hello World', { 1: cell(800), 64: cell(8500) }),
          'middleware-stack': scenario('middleware-stack', 'Middleware Stack', { 1: cell(300), 64: cell(2000) }),
        },
      },
      broken: { framework: 'Broken', frameworkId: 'broken', error: 'failed to start', scenarios: {} },
    },
  };
}

test('rankEntries sorts by RPS descending and awards N..1 points', () => {
  const ranked = rankEntries([
    { fwId: 'a', rps: 100, stddev: 1 },
    { fwId: 'b', rps: 300, stddev: 1 },
    { fwId: 'c', rps: 200, stddev: 1 },
  ]);

  assert.deepEqual(
    ranked.map((r) => [r.fwId, r.rank, r.points]),
    [
      ['b', 1, 3],
      ['c', 2, 2],
      ['a', 3, 1],
    ]
  );
  assert.equal(POINTS_FOR_LAST_PLACE, 1);
});

test('rankEntries shares rank and points on an exact tie, without skewing the next rank', () => {
  const ranked = rankEntries([
    { fwId: 'a', rps: 200, stddev: 1 },
    { fwId: 'b', rps: 200, stddev: 1 },
    { fwId: 'c', rps: 100, stddev: 1 },
  ]);

  assert.deepEqual(
    ranked.map((r) => [r.rank, r.points]),
    [
      [1, 3],
      [1, 3],
      [3, 1],
    ]
  );
});

test('rankEntries flags a gap smaller than combined stddev as within noise', () => {
  const ranked = rankEntries([
    { fwId: 'a', rps: 1000, stddev: 40 },
    { fwId: 'b', rps: 1010, stddev: 40 },
    { fwId: 'c', rps: 500, stddev: 5 },
  ]);

  assert.equal(ranked[0].withinNoiseOfNext, true);
  assert.equal(ranked[1].withinNoiseOfNext, false);
  assert.equal(ranked[2].withinNoiseOfNext, false);
});

test('buildScoreboard excludes errored frameworks and keeps their ids reportable', () => {
  const sb = buildScoreboard(fixture());

  assert.deepEqual(
    sb.frameworks.map((f) => f.id),
    ['raw-node', 'nextrush-v3', 'express']
  );
  assert.deepEqual(sb.failed, [{ id: 'broken', name: 'Broken', error: 'failed to start' }]);
  assert.equal(sb.baselineId, 'raw-node');
});

test('buildScoreboard ranks every scenario at every concurrency level', () => {
  const sb = buildScoreboard(fixture());

  assert.deepEqual(sb.connections, [1, 64]);
  assert.equal(sb.primaryConnection, 64);

  assert.deepEqual(
    sb.rankings['hello-world'][1].map((r) => r.fwId),
    ['nextrush-v3', 'raw-node', 'express']
  );
  assert.deepEqual(
    sb.rankings['hello-world'][64].map((r) => r.fwId),
    ['raw-node', 'express', 'nextrush-v3']
  );
  assert.deepEqual(
    sb.rankings['middleware-stack'][64].map((r) => r.fwId),
    ['nextrush-v3', 'raw-node', 'express']
  );
});

test('buildScoreboard reports a winner per scenario at the primary concurrency level', () => {
  const sb = buildScoreboard(fixture());

  assert.equal(sb.winners['hello-world'].fwId, 'raw-node');
  assert.equal(sb.winners['middleware-stack'].fwId, 'nextrush-v3');
  assert.equal(sb.winners['hello-world'].connection, 64);
});

test('buildScoreboard headline score counts only like-for-like scenarios', () => {
  const sb = buildScoreboard(fixture());

  // hello-world only, 2 concurrency levels, 3 frameworks => max 6 points.
  assert.equal(sb.overall.likeForLike.maxPoints, 6);
  assert.deepEqual(
    sb.overall.likeForLike.rows.map((r) => [r.fwId, r.points]),
    [
      ['raw-node', 5],
      ['nextrush-v3', 4],
      ['express', 3],
    ]
  );
  assert.deepEqual(sb.likeForLikeScenarioIds, ['hello-world']);
});

test('buildScoreboard all-scenarios score includes the non-like-for-like scenarios', () => {
  const sb = buildScoreboard(fixture());

  assert.equal(sb.overall.all.maxPoints, 12);
  assert.deepEqual(
    sb.overall.all.rows.map((r) => [r.fwId, r.points]),
    [
      ['raw-node', 10],
      ['nextrush-v3', 9],
      ['express', 5],
    ]
  );
});

test('buildScoreboard computes overhead against the baseline framework', () => {
  const sb = buildScoreboard(fixture());
  const overhead = sb.overhead['hello-world'][64];

  assert.equal(overhead['raw-node'], 0);
  assert.equal(overhead['nextrush-v3'], Math.round((1 - 8000 / 9000) * 1000) / 10);
});

test('buildScoreboard passes through git provenance unchanged', () => {
  const report = fixture();
  report.git = { commit: 'abc1234', dirty: false };

  const sb = buildScoreboard(report);

  assert.deepEqual(sb.git, { commit: 'abc1234', dirty: false });
});

test('buildScoreboard defaults git provenance to null fields when the run predates capture', () => {
  const sb = buildScoreboard(fixture());

  assert.deepEqual(sb.git, { commit: null, dirty: null });
});

test('buildScoreboard honours an explicit rankAt connection', () => {
  const sb = buildScoreboard(fixture(), { rankAt: 1 });

  assert.equal(sb.primaryConnection, 1);
  assert.equal(sb.winners['hello-world'].fwId, 'nextrush-v3');
});

test('buildScoreboard tolerates a framework missing a scenario or level', () => {
  const report = fixture();
  delete report.results.express.scenarios['hello-world'].concurrencyResults[64];

  const sb = buildScoreboard(report);
  const ranked = sb.rankings['hello-world'][64];

  assert.deepEqual(ranked.map((r) => r.fwId), ['raw-node', 'nextrush-v3']);
  // Points scale to the number of frameworks that actually produced data.
  assert.deepEqual(ranked.map((r) => r.points), [2, 1]);
  assert.equal(sb.cells.express['hello-world'][64], null);
});

test('buildScoreboard surfaces non-2xx counts and latency per cell', () => {
  const report = fixture();
  report.results.express.scenarios['hello-world'].concurrencyResults[1] = cell(800, {
    nonOk: 42,
    p50: '3.00ms',
    p99: '9.00ms',
  });

  const sb = buildScoreboard(report);
  const c = sb.cells.express['hello-world'][1];

  assert.equal(c.nonOk, 42);
  assert.equal(c.p50, '3.00ms');
  assert.equal(c.p99, '9.00ms');
});
