import assert from 'node:assert/strict';
import { test } from 'node:test';

import { captureEffectiveServerOptions, captureGitProvenance, captureNextRushEffectiveOptions } from '../provenance.js';

test('captureGitProvenance returns a commit SHA and a boolean dirty flag', () => {
  const provenance = captureGitProvenance();

  assert.equal(typeof provenance.commit, 'string');
  assert.ok(provenance.commit.length > 0, 'expected a non-empty commit SHA');
  assert.equal(typeof provenance.dirty, 'boolean');
});

test('captureGitProvenance degrades gracefully outside a git repository', () => {
  const provenance = captureGitProvenance({ cwd: '/tmp' });

  assert.equal(provenance.commit, null);
  assert.equal(provenance.dirty, null);
});

test('captureNextRushEffectiveOptions reports the adapter defaults when the benchmark server passes none', () => {
  const effective = captureNextRushEffectiveOptions({});

  assert.equal(effective.timeout, 30_000);
  assert.equal(effective.keepAliveTimeout, 5_000);
  assert.equal(effective.shutdownTimeout, 30_000);
  assert.equal(effective.host, '0.0.0.0');
});

test('captureNextRushEffectiveOptions reflects an explicitly passed override', () => {
  const effective = captureNextRushEffectiveOptions({ timeout: 0, keepAliveTimeout: 1000 });

  assert.equal(effective.timeout, 0);
  assert.equal(effective.keepAliveTimeout, 1000);
  assert.equal(effective.shutdownTimeout, 30_000);
});

test('captureEffectiveServerOptions reads timeout/keepAliveTimeout from a server-like object', () => {
  const server = { timeout: 0, keepAliveTimeout: 5000 };
  const effective = captureEffectiveServerOptions(server);

  assert.equal(effective.timeout, 0);
  assert.equal(effective.keepAliveTimeout, 5000);
});

test('captureEffectiveServerOptions returns null for objects with no timeout introspection', () => {
  const server = {};
  const effective = captureEffectiveServerOptions(server);

  assert.equal(effective, null);
});
