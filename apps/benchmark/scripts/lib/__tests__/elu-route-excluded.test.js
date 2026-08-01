import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { SCENARIOS } from '../../../config/scenarios.js';

test('the diagnostic ELU-sampling route is never registered as a benchmark scenario', () => {
  const paths = SCENARIOS.map((s) => s.path);
  assert.ok(
    !paths.includes('/__elu-sample'),
    'the diagnostic-only /__elu-sample route must stay excluded from SCENARIOS so ' +
      'validate-parity.js (which iterates SCENARIOS exclusively) never probes it'
  );
});
