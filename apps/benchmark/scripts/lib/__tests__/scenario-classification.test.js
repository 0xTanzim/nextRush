/**
 * fix-benchmark-harness-integrity (P1-004): `static-file` was declared
 * `identicalOutput: true` but each framework's own static-serving mechanism
 * emits a different response header set (163-292 bytes measured across the
 * six default servers) — a divergence the fairness pre-flight does not check
 * for. It is reclassified as idiomatic, scored separately, until full-header
 * parity is added to validate-parity.js.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getScenario, SCENARIOS } from '../../../config/scenarios.js';

test('static-file is classified identicalOutput:false (idiomatic, not headline-eligible)', () => {
  const scenario = getScenario('static-file');
  assert.ok(scenario, 'static-file scenario must still exist');
  assert.equal(scenario.identicalOutput, false);
});

test('reclassifying static-file did not change any other scenario\'s identicalOutput classification', () => {
  const expected = {
    'hello-world': true,
    'json-serialize': true,
    'route-params': true,
    'query-string': true,
    'post-json': true,
    'deep-route': true,
    'middleware-stack': false,
    'error-handling': false,
    'large-json': true,
    'empty-response': true,
    'send-object': true,
    'large-post': true,
  };
  for (const [id, identicalOutput] of Object.entries(expected)) {
    const scenario = SCENARIOS.find((s) => s.id === id);
    assert.ok(scenario, `${id} must exist`);
    assert.equal(scenario.identicalOutput, identicalOutput, `${id} classification must be unchanged`);
  }
});
