import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

/**
 * The `nextrush` meta-package ships a thin `bin` launcher for `@nextrush/dev` discoverability
 * (docs/RFC/framework-composition/020-framework-composition-integrity.md §21; ADR-0013). This is
 * the first `bin` field the meta-package has ever declared — it supersedes the earlier "declares no
 * bin" assertion (the bin-link question was resolved: a spike confirmed coexistence with
 * `@nextrush/dev`'s own `nextrush` bin is benign, so the meta owning one is safe).
 */
describe('nextrush package manifest', () => {
  it('declares a nextrush bin pointing to a shipped, shebang-prefixed launcher', async () => {
    const pkgJsonUrl = new URL('../../package.json', import.meta.url);
    const pkg = JSON.parse(await readFile(pkgJsonUrl, 'utf8')) as {
      readonly name?: unknown;
      readonly bin?: unknown;
      readonly files?: readonly string[];
    };

    expect(pkg.name).toBe('nextrush');

    const binMap = pkg.bin as Record<string, unknown>;
    expect(binMap.nextrush).toBe('./bin/nextrush.js');

    // The bin's directory must be in the published files allow-list, or it ships broken.
    expect(pkg.files).toContain('bin');

    // The launcher file exists and is an executable ESM entry.
    const binFileUrl = new URL('../../bin/nextrush.js', import.meta.url);
    const firstLine = (await readFile(binFileUrl, 'utf8')).split('\n')[0] ?? '';
    expect(firstLine.trim()).toBe('#!/usr/bin/env node');
  });
});
