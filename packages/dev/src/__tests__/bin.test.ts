import { constants as fsConstants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('@nextrush/dev bin', () => {
  it('declares a nextrush bin that exists and is executable JS', async () => {
    const pkgJsonUrl = new URL('../../package.json', import.meta.url);
    const pkg = JSON.parse(await readFile(pkgJsonUrl, 'utf8')) as {
      readonly name?: unknown;
      readonly bin?: unknown;
    };

    expect(pkg.name).toBe('@nextrush/dev');
    expect(pkg.bin).toBeDefined();
    expect(typeof pkg.bin).toBe('object');

    const binMap = pkg.bin as Record<string, unknown>;
    expect(binMap.nextrush).toBe('./bin/nextrush.js');

    const binFileUrl = new URL('../../bin/nextrush.js', import.meta.url);

    await expect(access(binFileUrl, fsConstants.F_OK)).resolves.toBeUndefined();

    const firstLine = (await readFile(binFileUrl, 'utf8')).split('\n')[0] ?? '';
    expect(firstLine.trim()).toBe('#!/usr/bin/env node');
  });
});
