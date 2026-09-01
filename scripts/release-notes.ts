/**
 * Pure helpers shared by the GitHub-release tooling:
 *
 *   - `scripts/create-github-release.ts`   — one canonical release per publish cycle
 *   - `scripts/migrate-github-releases.ts` — dry-run-first history migration
 *
 * Everything in this module is a pure function: no `node:*` I/O, no `child_process`, no
 * environment access. The CLI scripts own all I/O; this is the testable core the release
 * workflow's correctness rests on (see `scripts/__tests__/release-notes.test.ts` and
 * `scripts/__tests__/migrate-github-releases.test.ts`).
 *
 * The model in one paragraph: NextRush's npm ecosystem stays package-oriented (each package
 * versions independently), but GitHub Releases are the PRODUCT timeline. A canonical
 * `NextRush vX.Y.Z` release is created ONLY when the `nextrush` meta-package itself was
 * published — a wave that only bumps `@nextrush/*` / `create-nextrush` gets npm versions,
 * changelogs, and `@<pkg>@<version>` git tags, but deliberately no GitHub Release. GitHub
 * Releases then mean exactly one thing: a version of the NextRush framework product.
 */

export interface PublishedPackage {
  readonly name: string;
  readonly version: string;
}

/** The `changesets/action` output shape: `[{ "name": "@nextrush/core", "version": "4.0.1" }]`. */
export function parsePublishedPackages(json: string): PublishedPackage[] {
  if (!json || !json.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const packages: PublishedPackage[] = [];
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { name, version } = entry as Record<string, unknown>;
    if (typeof name === 'string' && typeof version === 'string') {
      packages.push({ name, version });
    }
  }
  return packages;
}

/**
 * The product version is the `nextrush` meta-package's version, and nothing else.
 *
 * Deliberate: no "highest semver in the wave" fallback. A wave that bumps only
 * `@nextrush/openapi` / `@nextrush/dev` must NOT fabricate a `NextRush vN` that the
 * product doesn't actually have. `null` means "no canonical GitHub Release this cycle."
 */
export function deriveProductVersion(published: readonly PublishedPackage[]): string | null {
  const meta = published.find((pkg) => pkg.name === 'nextrush');
  return meta ? meta.version : null;
}

/** Matches the per-package release names `changesets/action` used to create: `nextrush@4.0.1`, `@nextrush/openapi@1.0.2`. */
export const PACKAGE_RELEASE_RE =
  /^(nextrush|create-nextrush|@nextrush\/[a-z0-9-]+)@\d+\.\d+\.\d+$/;

/** Matches canonical product release names: `NextRush v4.0.1`, `NextRush v2.0.0 - Framework`, or a bare `vX.Y.Z` tag. */
export const CANONICAL_RELEASE_NAME_RE = /^NextRush v\d+\.\d+\.\d+( - .*)?$/;
export const CANONICAL_TAG_RE = /^v\d+\.\d+\.\d+$/;

export function isPackageReleaseName(name: string): boolean {
  return PACKAGE_RELEASE_RE.test(name);
}

export function isCanonicalReleaseName(name: string, tagName?: string): boolean {
  if (CANONICAL_RELEASE_NAME_RE.test(name)) return true;
  if (tagName && CANONICAL_TAG_RE.test(tagName)) return true;
  return false;
}

export function extractVersionFromPackageName(name: string): string | null {
  const match = PACKAGE_RELEASE_RE.exec(name);
  return match ? match[0].slice(match[0].lastIndexOf('@') + 1) : null;
}

/** `nextrush@4.0.1` → `nextrush`; `@nextrush/openapi@1.0.2` → `@nextrush/openapi`. */
export function packageNameFromReleaseName(name: string): string {
  return name.replace(/@\d+\.\d+\.\d+$/, '');
}

/**
 * Returns the markdown BELOW the `## <version>` header of a Changesets-generated
 * CHANGELOG.md (header line excluded), stopping at the next `## ` header. `null` when
 * that version has no entry.
 *
 * Exact header match on purpose: `## 4.0.0` must not match `## 4.0.0-beta.2`.
 */
export function extractChangelogSection(changelog: string, version: string): string | null {
  const lines = changelog.split(/\r?\n/);
  const wanted = `## ${version}`;
  const start = lines.findIndex((line) => line.trim() === wanted);
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i]?.startsWith('## ')) {
      end = i;
      break;
    }
  }
  const section = lines
    .slice(start + 1, end)
    .join('\n')
    .trim();
  return section.length > 0 ? section : null;
}

/** `- [#45](...) [\`6e9e28b\`](...) Thanks [@0xTanzim](...)! - Message` attribution prefix. */
const ATTRIBUTION_PREFIX_RE =
  /^-\s*(?:\[[^\]]*\]\([^)]*\)\s*){1,2}Thanks\s+\[@[^\]]+\]\([^)]*\)!\s*-\s*/;

/** Bullets that are pure dependency bookkeeping, not human-facing change notes. */
const DEPENDENCY_BULLET_RE = /^-\s+(?:@nextrush\/[a-z0-9-]+|nextrush|create-nextrush)@/;

/**
 * Pulls the human-facing change bullets out of a Changesets changelog section or release
 * body. Strips the changelog-github attribution prefix, drops "Updated dependencies"
 * bookkeeping and per-dependency bullets, joins wrapped continuation lines back onto their
 * bullet, and returns cleaned `- ` lines.
 */
export function extractMeaningfulBullets(markdown: string): string[] {
  const bullets: string[] = [];
  let pending = false;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') {
      pending = false;
      continue;
    }
    if (line.startsWith('- ')) {
      if (line.startsWith('- Updated dependencies') || DEPENDENCY_BULLET_RE.test(line)) {
        pending = false;
        continue;
      }
      const cleaned = line.replace(ATTRIBUTION_PREFIX_RE, '- ').replace(/^-\s*/, '- ').trimEnd();
      bullets.push(cleaned);
      pending = true;
    } else if (pending) {
      // Continuation of the previous bullet's wrapped paragraph.
      bullets[bullets.length - 1] = `${bullets[bullets.length - 1] ?? ''} ${line}`;
    }
  }
  return bullets;
}

export interface AssembleBodyOptions {
  readonly productVersion: string;
  readonly packages: readonly PublishedPackage[];
  /** package name → per-package change notes markdown (extracted changelog section or existing release body). */
  readonly changes: ReadonlyMap<string, string>;
  /** Optional pre-cleaned human-facing bullets for the `## Highlights` section. */
  readonly highlights?: readonly string[];
}

/**
 * Renders the canonical `NextRush vX.Y.Z` release body:
 *
 *   # NextRush v4.0.1
 *   ## Highlights         (omitted when empty)
 *   ## Packages           (nextrush first, then alphabetical)
 *   ## Changes            (### <package> per published package; annotated when entry-less)
 *   ## Installation
 *   pnpm add nextrush@4.0.1
 */
export function assembleReleaseBody(options: AssembleBodyOptions): string {
  const { productVersion, changes, highlights } = options;
  const packages = [...options.packages].sort((a, b) => {
    if (a.name === 'nextrush') return -1;
    if (b.name === 'nextrush') return 1;
    return a.name.localeCompare(b.name);
  });

  const out: string[] = [];
  out.push(`# NextRush v${productVersion}`);

  if (highlights && highlights.length > 0) {
    out.push('', '## Highlights', '');
    out.push(...highlights);
  }

  out.push('', '## Packages', '', '| Package | Version |', '| --- | --- |');
  for (const pkg of packages) {
    out.push(`| ${pkg.name} | ${pkg.version} |`);
  }

  if (packages.length > 0) {
    out.push('', '## Changes', '');
    for (const pkg of packages) {
      out.push(`### ${pkg.name}`, '');
      const section = (changes.get(pkg.name) ?? '').trim();
      out.push(section.length > 0 ? section : '*Dependency-only update.*', '');
    }
  }

  out.push('## Installation', '', `pnpm add nextrush@${productVersion}`);
  return `${out.join('\n').trimEnd()}\n`;
}

/** Numeric compare for `major.minor.patch` versions. Stable versions only — prerelease segments are not ranked. */
export function compareSemver(a: string, b: string): number {
  const parse = (value: string): number[] => value.split('.', 3).map((part) => Number(part));
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export interface PackageReleaseInfo {
  /** Release name, e.g. `nextrush@4.0.1`. */
  readonly name: string;
  /** Git tag the release is linked to, e.g. `nextrush@4.0.1`. */
  readonly tagName: string;
  /** The commit the tag points at — this is what defines a release "wave". */
  readonly commit: string;
  /** Existing release body (the per-package changelog text). */
  readonly body: string;
}

export interface Wave {
  readonly commit: string;
  readonly releases: readonly PackageReleaseInfo[];
  /** `nextrush`'s version when the wave published it, else `null` (no canonical release). */
  readonly productVersion: string | null;
}

/**
 * Groups per-package releases into waves by their underlying commit. Every package published
 * in one Changesets run is tagged from the same version-merge commit, so commit equality is
 * the reliable grouping key — no time-window guessing. Waves are ordered newest-first by
 * product version (package-only waves ordered by their highest package version, last).
 */
export function groupWaves(releases: readonly PackageReleaseInfo[]): Wave[] {
  const byCommit = new Map<string, PackageReleaseInfo[]>();
  for (const release of releases) {
    const bucket = byCommit.get(release.commit) ?? [];
    bucket.push(release);
    byCommit.set(release.commit, bucket);
  }

  const waves: Wave[] = [];
  for (const [commit, bucket] of byCommit) {
    const sorted = [...bucket].sort((a, b) => a.name.localeCompare(b.name));
    const published: PublishedPackage[] = sorted.map((release) => ({
      name: packageNameFromReleaseName(release.name),
      version: extractVersionFromPackageName(release.name) ?? '',
    }));
    waves.push({ commit, releases: sorted, productVersion: deriveProductVersion(published) });
  }

  const sortKeyFor = (wave: Wave): string =>
    wave.productVersion ??
    wave.releases
      .map((release) => extractVersionFromPackageName(release.name) ?? '0.0.0')
      .sort(compareSemver)
      .at(-1) ??
    '0.0.0';

  // Canonical (`nextrush`-containing) waves first, newest-first by product version;
  // package-only waves last, newest-first by their highest package version.
  return waves.sort((a, b) => {
    const aIsProduct = a.productVersion !== null ? 1 : 0;
    const bIsProduct = b.productVersion !== null ? 1 : 0;
    if (aIsProduct !== bIsProduct) return bIsProduct - aIsProduct;
    return compareSemver(sortKeyFor(b), sortKeyFor(a));
  });
}

export interface CanonicalReleasePlan {
  readonly tag: string;
  readonly title: string;
  readonly commit: string;
  readonly productVersion: string;
  readonly packages: readonly PublishedPackage[];
  /** package name → per-package change markdown (existing release bodies for the migration). */
  readonly changes: ReadonlyMap<string, string>;
  readonly highlights: readonly string[];
}

/**
 * Turns waves into the canonical-release work items. Package-only waves are skipped entirely
 * (their packages keep npm history, changelogs, and git tags — but no GitHub Release).
 */
export function buildCanonicalReleasePlans(waves: readonly Wave[]): CanonicalReleasePlan[] {
  const plans: CanonicalReleasePlan[] = [];
  for (const wave of waves) {
    if (!wave.productVersion) continue;
    const packages: PublishedPackage[] = wave.releases.map((release) => ({
      name: packageNameFromReleaseName(release.name),
      version: extractVersionFromPackageName(release.name) ?? 'unknown',
    }));
    const changes = new Map<string, string>(
      wave.releases.map(
        (release) => [packageNameFromReleaseName(release.name), release.body] as const
      )
    );
    const nextrushRelease = wave.releases.find((release) => release.name.startsWith('nextrush@'));
    const highlights = nextrushRelease ? extractMeaningfulBullets(nextrushRelease.body) : [];
    plans.push({
      tag: `v${wave.productVersion}`,
      title: `NextRush v${wave.productVersion}`,
      commit: wave.commit,
      productVersion: wave.productVersion,
      packages,
      changes,
      highlights,
    });
  }
  return plans.sort((a, b) => compareSemver(b.productVersion, a.productVersion));
}
