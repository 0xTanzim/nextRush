import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_PROFILE, PROFILES } from '../../../config/profiles.js';
import { parseDuration } from '../time.js';

test('PROFILES.verify exists and is fast enough for dev/agentic-session iteration', () => {
  const verify = PROFILES.verify;
  assert.ok(verify, 'PROFILES.verify must be defined');
  assert.equal(verify.runs, 3, 'must run 3 times to satisfy MIN_RUNS and to exercise rotation');
  assert.ok(
    Array.isArray(verify.connections) && verify.connections.length >= 2,
    'must have at least 2 concurrency levels to satisfy MIN_CONCURRENCY_LEVELS'
  );
  assert.ok(
    parseDuration(verify.duration) >= 10,
    'duration must be at least 10s to satisfy MIN_DURATION_SECONDS'
  );
  assert.equal(
    verify.publishable,
    false,
    'verify must be unconditionally non-publishable regardless of its numeric criteria'
  );
});

test('existing profiles are unchanged by the addition of the verify profile', () => {
  assert.equal(PROFILES.quick.runs, 1);
  assert.deepEqual(PROFILES.quick.connections, [64, 128]);
  assert.equal(PROFILES.quick.publishable, false);

  assert.equal(PROFILES.standard.runs, 3);
  assert.deepEqual(PROFILES.standard.connections, [1, 64, 256]);
  assert.equal(PROFILES.standard.publishable, true);

  assert.equal(PROFILES.full.runs, 5);
  assert.deepEqual(PROFILES.full.connections, [1, 64, 256, 512]);
  assert.equal(PROFILES.full.publishable, true);

  assert.equal(PROFILES.stress.runs, 3);
  assert.deepEqual(PROFILES.stress.connections, [256, 512, 1024]);
  assert.equal(PROFILES.stress.publishable, false);

  assert.equal(DEFAULT_PROFILE, 'quick');
});
