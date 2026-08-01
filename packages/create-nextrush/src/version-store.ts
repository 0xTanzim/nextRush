/**
 * Global version store — set once at CLI startup.
 * Templates read from here (per-package) instead of two shared build-time scalars.
 */

let versionMap: ReadonlyMap<string, string> = new Map();

/** Sets the resolved (or fallback) version map for every package this scaffold will emit. */
export function setVersionMap(versions: ReadonlyMap<string, string>): void {
  versionMap = versions;
}

/**
 * Returns the resolved version range for a specific package.
 *
 * Throws if the package was never resolved — this is a programming error (a template
 * emitting a dependency that was not included in the `resolveVersions()` request), not a
 * runtime condition to recover from silently.
 */
export function getPackageRange(pkgName: string): string {
  const range = versionMap.get(pkgName);
  if (!range) {
    throw new Error(
      `No resolved version for package "${pkgName}" — it was not included in the resolveVersions() call for this scaffold. Add it to REQUIRED_PACKAGE_NAMES in index.ts.`
    );
  }
  return range;
}

/** Test-only helper: seeds the version map directly without going through resolveVersions(). */
export function setVersions(versions: Record<string, string>): void {
  versionMap = new Map(Object.entries(versions));
}

/** Test-only helper: sets a single package's resolved range without disturbing the rest of the map. */
export function setPackageVersion(pkgName: string, range: string): void {
  versionMap = new Map([...versionMap, [pkgName, range]]);
}
