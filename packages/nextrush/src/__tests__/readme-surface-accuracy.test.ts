import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import * as nextrushApi from '../index.js';

/**
 * README↔surface accuracy guard (openspec/changes/framework-composition-integrity, capability:
 * public-surface-lock, requirement "A published README documents only symbols in the locked
 * surface").
 *
 * The sealed public-surface test (`public-surface.test.ts`) locks WHAT the package exports.
 * This test locks that the published README's import examples never claim an export that isn't
 * in that locked list — closing the gap that let `VERSION` (never exported) and `catchAsync`
 * (removed) sit in the README indefinitely with nothing to catch the drift.
 *
 * Scope: checks `import { X, Y } from 'nextrush'` style import statements in the README body —
 * not free-form prose, which can legitimately reference removed/renamed things when explaining
 * migration history.
 */
describe('README documents only symbols present in the locked runtime surface', () => {
  it('every symbol named in an `import { ... } from \'nextrush\'` statement is a real export', async () => {
    const readmeUrl = new URL('../../README.md', import.meta.url);
    const readme = await readFile(readmeUrl, 'utf8');
    const actualExports = new Set(Object.keys(nextrushApi));

    const importStatementPattern = /import\s*\{([^}]+)\}\s*from\s*'nextrush'/g;
    const undocumentedButClaimed: string[] = [];

    for (const match of readme.matchAll(importStatementPattern)) {
      const captured = match[1];
      if (!captured) continue;

      const names = captured
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean)
        // Strip `type X` and `X as Y` forms down to the bare imported name.
        .map((n) => n.replace(/^type\s+/, '').split(/\s+as\s+/)[0]?.trim() ?? n);

      for (const name of names) {
        if (!actualExports.has(name)) {
          undocumentedButClaimed.push(name);
        }
      }
    }

    expect(undocumentedButClaimed).toEqual([]);
  });

  it('does not reference the removed catchAsync export as a current feature', async () => {
    const readmeUrl = new URL('../../README.md', import.meta.url);
    const readme = await readFile(readmeUrl, 'utf8');
    expect(readme).not.toMatch(/catchAsync/);
  });

  it('does not document a VERSION export (intentionally omitted for edge-runtime compatibility)', async () => {
    const readmeUrl = new URL('../../README.md', import.meta.url);
    const readme = await readFile(readmeUrl, 'utf8');
    expect(readme).not.toMatch(/\bVERSION\b/);
  });
});
