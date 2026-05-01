import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('nextrush package manifest', () => {
  it('does not declare a bin entry (prevents pnpm bin-link conflicts)', async () => {
    const pkgJsonUrl = new URL('../../package.json', import.meta.url);
    const pkg = JSON.parse(await readFile(pkgJsonUrl, 'utf8')) as {
      readonly name?: unknown;
      readonly bin?: unknown;
    };

    expect(pkg.name).toBe('nextrush');
    expect(pkg.bin).toBeUndefined();
  });
});
