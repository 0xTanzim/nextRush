import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { parseProfileArgs } from '../profile-args.js';

test('parseProfileArgs requires --scenario', () => {
  assert.throws(() => parseProfileArgs({}), /--scenario is required/);
});

test('parseProfileArgs defaults --server to nextrush-v3.js', () => {
  const parsed = parseProfileArgs({ scenario: 'hello-world' });
  assert.equal(parsed.server, 'nextrush-v3.js');
});

test('parseProfileArgs defaults --duration to 20s', () => {
  const parsed = parseProfileArgs({ scenario: 'hello-world' });
  assert.equal(parsed.duration, '20s');
});

test('parseProfileArgs accepts explicit --server and --duration overrides', () => {
  const parsed = parseProfileArgs({ scenario: 'route-params', server: 'fastify.js', duration: '30s' });
  assert.equal(parsed.scenario, 'route-params');
  assert.equal(parsed.server, 'fastify.js');
  assert.equal(parsed.duration, '30s');
});

test('parseProfileArgs defaults --heap-snapshot and --cpu-prof to enabled', () => {
  const parsed = parseProfileArgs({ scenario: 'hello-world' });
  assert.equal(parsed.heapSnapshot, true);
  assert.equal(parsed.cpuProf, true);
});

test('parseProfileArgs honors explicit --heap-snapshot=false and --cpu-prof=false', () => {
  const parsed = parseProfileArgs({ scenario: 'hello-world', 'heap-snapshot': 'false', 'cpu-prof': 'false' });
  assert.equal(parsed.heapSnapshot, false);
  assert.equal(parsed.cpuProf, false);
});
