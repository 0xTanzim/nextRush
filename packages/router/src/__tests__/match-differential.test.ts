/**
 * @nextrush/router - Differential / characterization harness
 *
 * Golden-master regression contract for `router-match-path-allocation-trim`.
 * `match-golden.json` was captured from the PRE-CHANGE matcher; this asserts
 * the current matcher reproduces it byte-for-byte across the broad corpus in
 * `helpers/differential-corpus.ts`. Any behavioral drift on a preserved case
 * (route resolution, own-param entries/values, executor presence) fails here.
 *
 * Regenerate intentionally (only when a delta is understood and approved):
 *   GEN_GOLDEN=1 pnpm --filter @nextrush/router test match-differential
 *
 * Intentional deltas (null-prototype params; `__proto__`/`constructor`/
 * `prototype` param names) are covered by dedicated forward scenarios, NOT by
 * regenerating this golden — see `match-safety.test.ts`.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeGolden, type SerializedMatch } from './helpers/differential-corpus';

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = join(HERE, 'fixtures', 'match-golden.json');

describe('Router match — differential / characterization harness', () => {
  const computed = computeGolden();

  if (process.env.GEN_GOLDEN) {
    writeFileSync(GOLDEN_PATH, `${JSON.stringify(computed, null, 2)}\n`, 'utf-8');
  }

  const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf-8')) as Record<string, SerializedMatch>;

  it('reproduces the pre-change matcher output for every corpus probe', () => {
    expect(computed).toEqual(golden);
  });

  it('covers the full corpus (no probe silently dropped)', () => {
    const computedKeys = Object.keys(computed).sort();
    const goldenKeys = Object.keys(golden).sort();
    expect(computedKeys).toEqual(goldenKeys);
    expect(computedKeys.length).toBeGreaterThan(50);
  });
});
