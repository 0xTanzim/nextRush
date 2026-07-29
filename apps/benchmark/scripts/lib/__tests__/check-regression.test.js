/**
 * Regression test for check-regression.js's missing-baseline behavior
 * (fix-benchmark-measurement-integrity task 7.5): the gate must fail loudly
 * — a nonzero, distinguishable exit code and an explicit error message — not
 * silently pass, when no baseline exists to compare against.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { ROOT_DIR } from '../paths.js';

test('check-regression.js exits nonzero with an explicit error when the baseline directory is missing', () => {
  const missingBaselineDir = join(mkdtempSync(join(tmpdir(), 'bench-no-baseline-')), 'baseline');
  const latestDir = mkdtempSync(join(tmpdir(), 'bench-latest-'));
  writeFileSync(join(latestDir, 'results.json'), JSON.stringify({ results: {} }), 'utf-8');

  try {
    execFileSync(
      process.execPath,
      [join(ROOT_DIR, 'scripts/check-regression.js'), '--baseline', missingBaselineDir, '--latest', latestDir],
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    assert.fail('expected check-regression.js to exit nonzero when the baseline is missing');
  } catch (err) {
    assert.notEqual(err.status, 0, 'a missing baseline must not exit 0');
    assert.match(String(err.stderr), /no baseline/i);
  } finally {
    rmSync(latestDir, { recursive: true, force: true });
  }
});
