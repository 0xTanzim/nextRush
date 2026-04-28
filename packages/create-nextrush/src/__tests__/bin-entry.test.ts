import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const pkgRoot = fileURLToPath(new URL('../..', import.meta.url));
const binFile = join(pkgRoot, 'bin', 'create-nextrush.js');
const distIndex = join(pkgRoot, 'dist', 'index.js');

describe('bin entry (packaged CLI)', () => {
  it('keeps a node shebang and loads the build output', () => {
    expect(existsSync(binFile)).toBe(true);
    const contents = readFileSync(binFile, 'utf-8');
    expect(contents).toMatch(/^#!\/usr\/bin\/env node\r?\n/);
    expect(contents).toContain("import '../dist/index.js");
  });

  it('has dist output so the bin can run (run build in CI before test)', () => {
    expect(existsSync(distIndex)).toBe(true);
  });
});
