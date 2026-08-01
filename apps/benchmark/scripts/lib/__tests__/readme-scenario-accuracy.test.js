/**
 * fix-benchmark-harness-integrity (audit P2-008): the benchmark README's
 * scenario table previously listed 10 scenarios while config/scenarios.js
 * defined 13 — three were silently missing. This locks in that every
 * scenario id in the config appears somewhere in the README, so a future
 * scenario addition/removal is caught by a fast test rather than drifting
 * silently again.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { ROOT_DIR } from '../paths.js';
import { SCENARIOS } from '../../../config/scenarios.js';

test("apps/benchmark/README.md's scenario table mentions every scenario id defined in config/scenarios.js", () => {
  const readme = readFileSync(`${ROOT_DIR}/README.md`, 'utf-8');
  const missing = SCENARIOS.filter((s) => !readme.includes(s.id));
  assert.deepEqual(missing.map((s) => s.id), [], 'every scenario id must appear in the README scenario table');
});
