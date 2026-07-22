import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

/**
 * Replaces postinstall.test.ts (deleted alongside scripts/postinstall.js — see
 * docs/RFC/framework-composition/020-framework-composition-integrity.md, task 3.2/3.3).
 *
 * The postinstall hook previously printed an advisory notice about the optional
 * `@nextrush/dev` CLI on every install — install-time code execution flagged by
 * the framework-composition review (F-04). Discovery responsibility moved to:
 *   1. The README quick-start (documents `pnpm add -D @nextrush/dev`).
 *   2. `create-nextrush`, which already adds `@nextrush/dev` to every scaffolded
 *      template's devDependencies unconditionally (verified below) — so scaffolded
 *      projects need no discovery step at all.
 * This test locks both halves so the responsibility isn't silently dropped.
 */
describe('dev-CLI discovery (post-postinstall-removal)', () => {
  it('nextrush declares no install-time lifecycle script', async () => {
    const pkgJsonUrl = new URL('../../package.json', import.meta.url);
    const pkg = JSON.parse(await readFile(pkgJsonUrl, 'utf8')) as {
      scripts?: Record<string, string>;
      files?: string[];
    };

    expect(pkg.scripts?.postinstall).toBeUndefined();
    expect(pkg.scripts?.preinstall).toBeUndefined();
    expect(pkg.scripts?.install).toBeUndefined();
    // The install-time script and its directory are gone; nothing in `files`
    // should still reference it.
    expect(pkg.files).not.toContain('scripts');
  });

  it('does not declare a bin entry (unchanged from before)', async () => {
    const pkgJsonUrl = new URL('../../package.json', import.meta.url);
    const pkg = JSON.parse(await readFile(pkgJsonUrl, 'utf8')) as { bin?: unknown };

    expect(pkg.bin).toBeUndefined();
  });
});
