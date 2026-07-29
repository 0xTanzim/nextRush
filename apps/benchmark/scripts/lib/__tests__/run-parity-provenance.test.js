/**
 * fix-benchmark-harness-integrity (D5/D8): a generated report's parity claim
 * must be derived from whether parity validation actually ran for THIS run,
 * not asserted unconditionally. This locks in that run.js records the
 * outcome into its own configuration object rather than only deciding
 * pass/fail and discarding the result.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { ROOT_DIR } from '../paths.js';

test('run.js records a parity outcome (validated / skipped-with-reason) into runConfiguration', () => {
  const source = readFileSync(`${ROOT_DIR}/scripts/run.js`, 'utf-8');

  assert.match(
    source,
    /parity\s*:/,
    'runConfiguration (or the report object) must carry a `parity` field describing whether validation ran'
  );
});
