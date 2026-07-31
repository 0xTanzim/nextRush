/**
 * Regressions for the reporting-honesty fixes (audit F-20, F-21b, F-22, F-23).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { buildScoreboard, measurementPositions, unresolvedRanking } from '../report/scoreboard.js';
import { derivePublishable } from '../publishable.js';
import { FRAMEWORK_DEVIATIONS, deviationsFor } from '../../../config/deviations.js';
import { FRAMEWORKS } from '../../../config/frameworks.js';
import { SERVERS_DIR } from '../paths.js';

/** One cell's worth of persisted stats. */
const cell = (mean, stddev = 0) => ({
  connections: 0,
  runs: [{ rps: mean, errors: {}, latency: { p50: '1ms', p99: '2ms' } }],
  validRuns: 1,
  stats: { mean, stddev, cv: mean ? (stddev / mean) * 100 : 0 },
  latency: { p50: '1ms', p99: '2ms' },
});

/**
 * A report where `large-post` exists only at 1c — the shape that made the
 * denominator count points no framework could score.
 */
function reportWithCappedScenario() {
  const frameworks = ['raw-node', 'nextrush-v3'];
  const results = {};
  frameworks.forEach((id, index) => {
    results[id] = {
      framework: id,
      scenarios: {
        'hello-world': {
          scenario: 'Hello World',
          scenarioId: 'hello-world',
          concurrencyResults: { 64: cell(30000 - index * 5000), 256: cell(29000 - index * 5000) },
        },
        'large-post': {
          scenario: 'Large POST Body',
          scenarioId: 'large-post',
          concurrencyResults: { 1: cell(200 - index * 10) },
        },
      },
    };
  });

  return {
    runId: 'test',
    timestamp: new Date().toISOString(),
    profile: 'standard',
    publishable: true,
    tool: 'wrk',
    configuration: {
      runs: 2,
      connections: [1, 64, 256],
      scenarios: ['hello-world', 'large-post'],
      positionControl: 'rotated',
      positionLog: [
        { repeat: 0, order: frameworks },
        { repeat: 1, order: [...frameworks].reverse() },
      ],
    },
    results,
  };
}

test('F-21b: maxPoints counts only cells that exist, not declared cardinality', () => {
  const scoreboard = buildScoreboard(reportWithCappedScenario());
  const { likeForLike } = scoreboard.overall;

  // Headline levels are 64 and 256; large-post has neither, so 1 scenario x
  // 2 levels x 2 frameworks = 4 points, NOT 2 x 2 x 2 = 8.
  assert.equal(likeForLike.maxPoints, 4);
  assert.equal(likeForLike.scenarioCount, 1);
  assert.equal(likeForLike.declaredScenarioCount, 2);
  assert.deepEqual(likeForLike.unscoredScenarioIds, ['large-post']);
});

test('F-21b: the winner of every ranked cell reaches exactly maxPoints', () => {
  const scoreboard = buildScoreboard(reportWithCappedScenario());
  const winner = scoreboard.overall.likeForLike.rows[0];
  assert.equal(
    winner.points,
    scoreboard.overall.likeForLike.maxPoints,
    'a clean sweep must read as 100% of the maximum, not a fraction of an unreachable one'
  );
});

test('F-22: measurement position is reported and flagged unbalanced when runs are not a multiple', () => {
  const unbalanced = measurementPositions({
    configuration: {
      runs: 3,
      positionLog: [
        { repeat: 0, order: ['a', 'b', 'c', 'd', 'e', 'f'] },
        { repeat: 1, order: ['b', 'c', 'd', 'e', 'f', 'a'] },
        { repeat: 2, order: ['c', 'd', 'e', 'f', 'a', 'b'] },
      ],
    },
  });

  assert.equal(unbalanced.balanced, false);
  assert.equal(unbalanced.frameworkCount, 6);
  // The published run's real shape: 'c' rotates into positions 2,1,0 (mean 1.0)
  // while 'f' sits at 5,4,3 (mean 4.0) — a 3-slot spread, not the ±1 the old
  // docstring claimed.
  assert.equal(unbalanced.spread, 3);
  assert.equal(unbalanced.rows.find((r) => r.fwId === 'c').meanPosition, 1);
  assert.equal(unbalanced.rows.find((r) => r.fwId === 'f').meanPosition, 4);
});

test('F-22: position is balanced when runs is a multiple of the framework count', () => {
  const balanced = measurementPositions({
    configuration: {
      runs: 2,
      positionLog: [
        { repeat: 0, order: ['a', 'b'] },
        { repeat: 1, order: ['b', 'a'] },
      ],
    },
  });
  assert.equal(balanced.balanced, true);
  assert.equal(balanced.spread, 0);
});

test('F-22: publishability rejects a ranking whose rotation cannot balance position', () => {
  const results = { a: { scenarios: {} }, b: { scenarios: {} }, c: { scenarios: {} } };
  const outcome = derivePublishable(
    { runs: 4, connections: [64, 256], duration: '30s', positionControl: 'rotated' },
    results
  );
  assert.equal(outcome.publishable, false);
  assert.match(outcome.reason, /does not balance measurement position/);
});

test('F-22: a run whose runs divide evenly by framework count still passes', () => {
  const results = { a: { scenarios: {} }, b: { scenarios: {} }, c: { scenarios: {} } };
  const outcome = derivePublishable(
    { runs: 3, connections: [64, 256], duration: '30s', positionControl: 'rotated' },
    results
  );
  assert.equal(outcome.publishable, true, outcome.reason ?? '');
});

test('F-20: a busy host cannot back a publishable run', () => {
  const base = { runs: 3, connections: [64, 256], duration: '30s', positionControl: 'rotated' };
  const results = { a: { scenarios: {} }, b: { scenarios: {} }, c: { scenarios: {} } };

  const busy = derivePublishable({ ...base, hostLoadAvgAtStart: 3.5 }, results);
  assert.equal(busy.publishable, false);
  assert.match(busy.reason, /load average/);

  const idle = derivePublishable({ ...base, hostLoadAvgAtStart: 0.3 }, results);
  assert.equal(idle.publishable, true, idle.reason ?? '');
});

test('F-19: a starved sampler blocks publishability', () => {
  const outcome = derivePublishable(
    { runs: 4, connections: [64, 256], duration: '30s', positionControl: 'rotated' },
    {
      a: { scenarios: {}, sampleCoverage: { coveragePct: 3.2, starved: true } },
      b: { scenarios: {}, sampleCoverage: { coveragePct: 99, starved: false } },
    }
  );
  assert.equal(outcome.publishable, false);
  assert.match(outcome.reason, /sampling was starved/);
});

test('F-20: adjacent orderings inside combined stddev are reported as unresolved', () => {
  const rankings = {
    'hello-world': {
      256: [
        { fwId: 'a', rps: 30000, withinNoiseOfNext: true },
        { fwId: 'b', rps: 29900, withinNoiseOfNext: false },
        { fwId: 'c', rps: 20000, withinNoiseOfNext: false },
      ],
    },
  };
  const resolution = unresolvedRanking(rankings, ['hello-world'], [256]);
  assert.equal(resolution.count, 1);
  assert.equal(resolution.tiedFrameworkPairs[0].key, 'a ~ b');
});

test('F-23: every framework under test has a deviation declaration', () => {
  for (const id of Object.keys(FRAMEWORKS)) {
    // A stock server legitimately declares none; the key must still be a known
    // shape so a new server cannot be added with no disclosure decision made.
    assert.ok(Array.isArray(deviationsFor(id)), `${id} must resolve to a deviation list`);
  }
});

test('F-23: declared deviations carry a direction and a reason', () => {
  for (const [id, deviations] of Object.entries(FRAMEWORK_DEVIATIONS)) {
    for (const deviation of deviations) {
      assert.ok(deviation.setting, `${id}: setting is required`);
      assert.ok(deviation.from, `${id}: framework default is required`);
      assert.ok(deviation.to, `${id}: this suite's value is required`);
      assert.ok(
        ['favours', 'costs', 'neutral'].includes(deviation.direction),
        `${id}: direction must be favours|costs|neutral, got ${deviation.direction}`
      );
      assert.ok(deviation.why?.length > 20, `${id}: why must explain the fairness reason`);
    }
  }
});

test('F-23: known server-side deviations are actually declared', () => {
  // Guards the disclosure against drifting behind the servers: each pattern below
  // is a real deviation present in a server file, and must have a declaration.
  const expectations = [
    ['express', "app.set('etag', false)", /etag/i],
    ['express', "app.disable('x-powered-by')", /x-powered-by/i],
    ['fastify', 'keepAliveTimeout:', /keepAliveTimeout/i],
    ['koa', 'app.silent', /silent/i],
  ];

  for (const [id, sourceNeedle, declarationPattern] of expectations) {
    const source = readFileSync(`${SERVERS_DIR}/${FRAMEWORKS[id].file}`, 'utf8');
    assert.ok(source.includes(sourceNeedle), `${id} server should still contain ${sourceNeedle}`);
    assert.ok(
      deviationsFor(id).some((d) => declarationPattern.test(d.setting)),
      `${id} deviation "${sourceNeedle}" is present in the server but not declared in config/deviations.js`
    );
  }
});
