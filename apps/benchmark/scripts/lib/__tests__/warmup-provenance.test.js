/**
 * Regression test for reconciliation report F-13's warmup/cooldown/pause
 * self-contradiction claim: `run.js`'s recorded configuration must be the
 * values actually passed to `warmup()`/`sleep()`, not merely the profile's
 * declared defaults with an unrecorded override path. There is currently no
 * CLI override for these three fields — this test locks that in, so a future
 * override addition is forced to also fix the recorded configuration in the
 * same change, rather than silently reintroducing the declared/applied gap.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { ROOT_DIR } from '../paths.js';

test('run.js records profile.warmupDuration/scenarioWarmupDuration/cooldownMs/pauseBetweenTestsMs with no separate override path', () => {
  const source = readFileSync(`${ROOT_DIR}/scripts/run.js`, 'utf-8');

  assert.match(source, /warmupDuration:\s*profile\.warmupDuration/);
  assert.match(source, /scenarioWarmupDuration:\s*profile\.scenarioWarmupDuration/);
  assert.match(source, /cooldownMs:\s*profile\.cooldownMs/);
  assert.match(source, /pauseBetweenTestsMs:\s*profile\.pauseBetweenTestsMs/);

  assert.doesNotMatch(
    source,
    /warmupOverride|cooldownOverride|pauseOverride/,
    'a warmup/cooldown/pause override was added without updating this regression test to confirm ' +
      'the recorded configuration still matches what is actually applied'
  );
});
