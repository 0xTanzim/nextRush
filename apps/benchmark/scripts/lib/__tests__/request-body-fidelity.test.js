import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkRequestBodyFidelity } from '../parity.js';

test('checkRequestBodyFidelity passes when the response reflects the full declared body', () => {
  const scenario = { id: 'large-post', body: JSON.stringify({ items: [{ id: 0 }, { id: 1 }, { id: 2 }] }) };
  const responseBody = JSON.stringify({ received: true, itemCount: 3 });
  const problems = checkRequestBodyFidelity(scenario, responseBody);
  assert.deepEqual(problems, []);
});

test('checkRequestBodyFidelity fails when the response itemCount is smaller than the declared body implies', () => {
  const scenario = {
    id: 'large-post',
    body: JSON.stringify({ items: Array.from({ length: 500 }, (_, i) => ({ id: i })) }),
  };
  // Simulates the P0-001 bug: server received a small placeholder body instead
  // of the declared ~500-item body, so itemCount is 0.
  const responseBody = JSON.stringify({ received: true, itemCount: 0 });
  const problems = checkRequestBodyFidelity(scenario, responseBody);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /itemCount 0.*expected 500/);
});

test('checkRequestBodyFidelity is a no-op for scenarios with no itemCount-bearing body shape', () => {
  const scenario = { id: 'hello-world', body: undefined };
  const problems = checkRequestBodyFidelity(scenario, JSON.stringify({ message: 'Hello World' }));
  assert.deepEqual(problems, []);
});

test('checkRequestBodyFidelity is a no-op for a POST scenario whose body has no items array (post-json)', () => {
  const scenario = { id: 'post-json', body: JSON.stringify({ name: 'John Doe', email: 'john@example.com' }) };
  const problems = checkRequestBodyFidelity(scenario, JSON.stringify({ success: true }));
  assert.deepEqual(problems, []);
});
