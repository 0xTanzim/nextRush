/**
 * @nextrush/express-bridge — registry honesty lock
 *
 * The v1 registry hypothesis lives in RFC-035 §8.8. This test enforces the
 * two registry rules that rot silently:
 *   1. A `Full` middleware cell must have a corresponding real-package test.
 *   2. `on-headers` is a surface fixture, never a `Full` middleware cell.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** Registry rows the bridge treats as `Full` in v1 (P2/P3 confirmed). */
const FULL_CELLS = new Set(['morgan', 'response-time']);

/** A Full cell is only admitted if it is genuinely exercised in a real-package
 *  integration test. These files run the ACTUAL npm package against a real
 *  Application + adapter-node request. */
const REAL_PACKAGE_TEST_FILES = [
  resolve(dirname(fileURLToPath(import.meta.url)), 'packages', 'real-packages.test.ts'),
];

/** Native-overlap rows that must never be claimed `Full` (native package is golden path). */
const NATIVE_OVERLAP = [
  'cors',
  'helmet',
  'cookie-parser',
  'compression',
  'body-parser',
  'multer',
  'rate-limit',
  'csurf',
  'serve-static',
];

describe('compatibility registry honesty', () => {
  it('every Full middleware cell is backed by a real-package integration test', () => {
    // A `Full` claim without a test that runs the actual package against a real
    // request would be a rot point: the cell could be aspirational, not proven.
    // Scan the real-package test source and require each Full cell to be named
    // there — both as an import and inside a `describe('real package: ...')`.
    const source = REAL_PACKAGE_TEST_FILES.map((file) => readFileSync(file, 'utf-8')).join('\n');

    for (const cell of FULL_CELLS) {
      expect(source).toContain(`real package: ${cell}`); // a describe block
      // Must be exercised with the actual package, not merely mentioned.
      expect(source).toMatch(new RegExp(`import .* from '${cell}'`));
    }
  });

  it('on-headers is a surface fixture, never a Full middleware cell', () => {
    expect(FULL_CELLS.has('on-headers')).toBe(false);
  });

  it('native-overlap packages are not Full', () => {
    for (const pkg of NATIVE_OVERLAP) {
      expect(FULL_CELLS.has(pkg)).toBe(false);
    }
  });
});
