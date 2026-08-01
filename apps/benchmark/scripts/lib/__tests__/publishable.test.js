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

function multiFrameworkResults(timeoutCount = 0) {
  return {
    'raw-node': {
      scenarios: {
        'hello-world': { concurrencyResults: { 64: { runs: [{ errors: { timeout: timeoutCount } }] } } },
      },
    },
    'nextrush-v3': {
      scenarios: {
        'hello-world': { concurrencyResults: { 64: { runs: [{ errors: { timeout: timeoutCount } }] } } },
      },
    },
  };
}

test('a fixed-order multi-framework run is rejected on position control', () => {
  const config = makeConfig({ positionControl: 'fixed' });
  const outcome = derivePublishable(config, multiFrameworkResults());

  assert.equal(outcome.publishable, false);
  assert.match(outcome.reason, /position/i);
});

test('a multi-framework run with no recorded position control is rejected, not silently passed', () => {
  const config = makeConfig(); // no positionControl field at all
  const outcome = derivePublishable(config, multiFrameworkResults());

  assert.equal(outcome.publishable, false);
  assert.match(outcome.reason, /position/i);
});

test('a rotated multi-framework run is not rejected on position control', () => {
  // `runs` must be a multiple of the measured framework count (2 here), otherwise
  // rotation cannot balance measurement position and the run is rejected on that
  // separate criterion instead — see the position-balance test below (audit F-22).
  const config = makeConfig({ positionControl: 'rotated', runs: 4 });
  const outcome = derivePublishable(config, multiFrameworkResults());

  assert.equal(outcome.publishable, true);
  assert.equal(outcome.reason, null);
});

test('a single-framework run is exempt from the position-control criterion regardless of value', () => {
  const configFixed = makeConfig({ positionControl: 'fixed' });
  const outcomeFixed = derivePublishable(configFixed, resultsWithTimeouts(0));
  assert.equal(outcomeFixed.publishable, true);

  const configNone = makeConfig();
  const outcomeNone = derivePublishable(configNone, resultsWithTimeouts(0));
  assert.equal(outcomeNone.publishable, true);
});

test('a framework entry with .error does not count toward the multi-framework threshold', () => {
  const config = makeConfig({ positionControl: 'fixed' });
  const results = {
    'raw-node': {
      scenarios: {
        'hello-world': { concurrencyResults: { 64: { runs: [{ errors: { timeout: 0 } }] } } },
      },
    },
    fastify: { error: 'failed to start' },
  };
  const outcome = derivePublishable(config, results);
  // Only one framework actually measured -> exempt from position-control.
  assert.equal(outcome.publishable, true);
});

test('countSocketTimeouts correctly sums timeouts from an autocannon-shaped results tree (errors.timeout, singular)', () => {
  const config = makeConfig();
  // autocannon's adapter mirrors `timeouts` (plural) into `timeout` (singular)
  // — this fixture exercises the reader against that mirrored shape directly,
  // rather than only the wrk shape resultsWithTimeouts() already produces.
  const results = {
    'raw-node': {
      scenarios: {
        'hello-world': {
          concurrencyResults: {
            64: { runs: [{ errors: { total: 3, timeouts: 3, timeout: 3, nonOk: 0 } }] },
          },
        },
      },
    },
    'nextrush-v3': {
      scenarios: {
        'hello-world': {
          concurrencyResults: {
            64: { runs: [{ errors: { total: 0, timeouts: 0, timeout: 0, nonOk: 0 } }] },
          },
        },
      },
    },
  };

  const outcome = derivePublishable({ ...config, positionControl: 'rotated', runs: 4 }, results);

  assert.equal(outcome.publishable, false);
  assert.match(outcome.reason, /timeout/i);
});
