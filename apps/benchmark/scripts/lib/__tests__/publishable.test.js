import assert from 'node:assert/strict';
import { test } from 'node:test';

import { derivePublishable, withRecomputedPublishable } from '../publishable.js';

const MIN_RUNS = 3;
const MIN_CONCURRENCY_LEVELS = 2;
const MIN_DURATION_SECONDS = 10;

function makeConfig(overrides = {}) {
  return {
    runs: MIN_RUNS,
    connections: [64, 256],
    duration: `${MIN_DURATION_SECONDS}s`,
    ...overrides,
  };
}

function resultsWithTimeouts(timeoutCount) {
  return {
    'raw-node': {
      scenarios: {
        'hello-world': {
          concurrencyResults: {
            64: { runs: [{ errors: { timeout: timeoutCount } }] },
          },
        },
      },
    },
  };
}

test('a single-run, single-concurrency-level run with socket timeouts is not publishable', () => {
  const config = makeConfig({ runs: 1, connections: [512], duration: '5s' });
  const results = resultsWithTimeouts(134);

  const outcome = derivePublishable(config, results);

  assert.equal(outcome.publishable, false);
  assert.match(outcome.reason, /run/i);
});

test('a compliant multi-run, multi-concurrency, zero-timeout run is publishable', () => {
  const config = makeConfig();
  const results = resultsWithTimeouts(0);

  const outcome = derivePublishable(config, results);

  assert.equal(outcome.publishable, true);
  assert.equal(outcome.reason, null);
});

test('too few runs alone is disqualifying even with clean results', () => {
  const config = makeConfig({ runs: 1 });
  const results = resultsWithTimeouts(0);

  const outcome = derivePublishable(config, results);

  assert.equal(outcome.publishable, false);
  assert.match(outcome.reason, /run/i);
});

test('a single concurrency level alone is disqualifying even with clean results', () => {
  const config = makeConfig({ connections: [256] });
  const results = resultsWithTimeouts(0);

  const outcome = derivePublishable(config, results);

  assert.equal(outcome.publishable, false);
  assert.match(outcome.reason, /concurrency/i);
});

test('too short a duration alone is disqualifying even with clean results', () => {
  const config = makeConfig({ duration: '5s' });
  const results = resultsWithTimeouts(0);

  const outcome = derivePublishable(config, results);

  assert.equal(outcome.publishable, false);
  assert.match(outcome.reason, /duration/i);
});

test('any socket timeout in any cell disqualifies an otherwise-compliant run', () => {
  const config = makeConfig();
  const results = resultsWithTimeouts(1);

  const outcome = derivePublishable(config, results);

  assert.equal(outcome.publishable, false);
  assert.match(outcome.reason, /timeout/i);
});

test('an explicit diagnostic-saturation flag forces non-publishable regardless of other criteria', () => {
  const config = makeConfig();
  const results = resultsWithTimeouts(0);

  const outcome = derivePublishable(config, results, { diagnosticSaturation: true });

  assert.equal(outcome.publishable, false);
  assert.match(outcome.reason, /diagnostic/i);
});

test('withRecomputedPublishable corrects a stale publishable:true stored on a non-compliant run', () => {
  const report = {
    publishable: true,
    configuration: makeConfig({ runs: 1, connections: [512], duration: '5s' }),
    results: resultsWithTimeouts(134),
  };

  const corrected = withRecomputedPublishable(report);

  assert.equal(corrected.publishable, false);
  assert.match(corrected.publishableReason, /run/i);
});

test('withRecomputedPublishable leaves publishable:true intact for a genuinely compliant run', () => {
  const report = {
    publishable: true,
    configuration: makeConfig(),
    results: resultsWithTimeouts(0),
  };

  const corrected = withRecomputedPublishable(report);

  assert.equal(corrected.publishable, true);
  assert.equal(corrected.publishableReason, null);
});

test('withRecomputedPublishable passes through a malformed report with no configuration/results unchanged', () => {
  const report = { publishable: true, runId: 'malformed' };

  assert.deepEqual(withRecomputedPublishable(report), report);
});
