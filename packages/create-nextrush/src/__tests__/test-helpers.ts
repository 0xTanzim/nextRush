import { getAllPossiblePackageNames } from '../templates/index.js';
import { setVersions } from '../version-store.js';

/**
 * Test helper: seeds the version store with a single range applied to EVERY package name
 * this scaffolder can emit. Mirrors the old two-scalar `setVersions(core, mw)` test
 * ergonomics while going through the new per-package `setVersions(record)` API — most
 * generator/integration tests only care that SOME resolvable version is present, not which
 * package major each range represents (that per-package distinction is covered by
 * `generate-install-matrix.test.ts` and `npm-version.test.ts`).
 */
export function seedAllPackageVersions(range: string): void {
  const versions: Record<string, string> = {};
  for (const pkgName of getAllPossiblePackageNames()) {
    versions[pkgName] = range;
  }
  setVersions(versions);
}
