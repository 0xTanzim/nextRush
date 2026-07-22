import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { listPackageJsonFiles, parsePackageJson } from '../validate-manifest-composition.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

/**
 * Package-catalog completeness test (openspec/changes/framework-composition-integrity,
 * capability: framework-composition, requirement "Satellite packages are discoverable through
 * a maintained catalog").
 *
 * Every publishable package must have a row in
 * apps/docs/content/docs/resources/package-catalog.mdx, or the catalog has silently drifted
 * out of sync with the ecosystem it claims to enumerate.
 */
describe('package catalog completeness', () => {
  it('every publishable workspace package has a row in the package catalog', async () => {
    const catalogPath = path.join(
      repoRoot,
      'apps/docs/content/docs/resources/package-catalog.mdx'
    );
    const catalog = await readFile(catalogPath, 'utf8');

    const packageJsonFiles = await listPackageJsonFiles(repoRoot);
    const missing: string[] = [];

    for (const pkgJsonPath of packageJsonFiles) {
      const pkg = parsePackageJson(await readFile(pkgJsonPath, 'utf8'), pkgJsonPath);
      if (pkg.private === true || !pkg.name) continue;
      // The meta package itself is the document the catalog is linked FROM, not a catalog entry.
      if (pkg.name === 'nextrush') continue;

      if (!catalog.includes(`\`${pkg.name}\``)) {
        missing.push(pkg.name);
      }
    }

    expect(missing).toEqual([]);
  });
});
