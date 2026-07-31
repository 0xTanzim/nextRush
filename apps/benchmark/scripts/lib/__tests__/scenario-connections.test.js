import assert from 'node:assert/strict';
import { test } from 'node:test';

import { connectionsForScenario } from '../scenario-connections.js';
import { warmupConnectionsForScenario } from '../scenario-connections.js';

test('a scenario with no cap is measured at every declared level', () => {
  assert.deepEqual(connectionsForScenario({ id: 'hello-world' }, [1, 64, 256]), [1, 64, 256]);
});

test('a capped scenario drops levels above its cap', () => {
  assert.deepEqual(connectionsForScenario({ id: 'large-post', maxConnections: 8 }, [1, 64, 256]), [1]);
});

test('a cap that excludes every declared level still measures the lowest one', () => {
  assert.deepEqual(connectionsForScenario({ id: 'large-post', maxConnections: 8 }, [256, 512]), [256]);
});

test('a non-numeric cap is ignored rather than silently dropping every level', () => {
  assert.deepEqual(connectionsForScenario({ maxConnections: 'eight' }, [1, 64]), [1, 64]);
});

test('warmup concurrency is capped by the same scenario limit', () => {
  assert.equal(warmupConnectionsForScenario({ maxConnections: 4 }, 10), 4);
  assert.equal(warmupConnectionsForScenario({}, 10), 10);
});
