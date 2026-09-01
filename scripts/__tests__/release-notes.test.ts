import { describe, expect, it } from 'vitest';
import {
  assembleReleaseBody,
  buildCanonicalReleasePlans,
  compareSemver,
  deriveProductVersion,
  extractChangelogSection,
  extractMeaningfulBullets,
  extractVersionFromPackageName,
  groupWaves,
  isCanonicalReleaseName,
  isPackageReleaseName,
  packageNameFromReleaseName,
  parsePublishedPackages,
  type PackageReleaseInfo,
} from '../release-notes.js';

describe('parsePublishedPackages', () => {
  it('parses the changesets/action output JSON', () => {
    expect(
      parsePublishedPackages(
        '[{"name":"nextrush","version":"4.0.1"},{"name":"@nextrush/openapi","version":"1.0.2"}]'
      )
    ).toEqual([
      { name: 'nextrush', version: '4.0.1' },
      { name: '@nextrush/openapi', version: '1.0.2' },
    ]);
  });

  it('returns [] for empty, malformed, or non-array input', () => {
    expect(parsePublishedPackages('')).toEqual([]);
    expect(parsePublishedPackages('   ')).toEqual([]);
    expect(parsePublishedPackages('not json')).toEqual([]);
    expect(parsePublishedPackages('{"a":1}')).toEqual([]);
    expect(parsePublishedPackages('[{"name":"x"}]')).toEqual([]);
    expect(parsePublishedPackages('[{"name":"x","version":1}]')).toEqual([]);
    expect(parsePublishedPackages('null')).toEqual([]);
  });
});

describe('deriveProductVersion — the product-version invariant', () => {
  it('returns the `nextrush` version when it was published', () => {
    expect(
      deriveProductVersion([
        { name: 'nextrush', version: '4.0.1' },
        { name: '@nextrush/openapi', version: '1.0.2' },
      ])
    ).toBe('4.0.1');
  });

  it('does NOT use the highest semver in the wave (a false product version)', () => {
    // nextrush stayed at 4.0.1 while @nextrush/foo jumped to 7.0.0 — the product is still 4.0.1.
    expect(
      deriveProductVersion([
        { name: 'nextrush', version: '4.0.1' },
        { name: '@nextrush/foo', version: '7.0.0' },
      ])
    ).toBe('4.0.1');
  });

  it('returns null for a package-only wave — no canonical release', () => {
    expect(deriveProductVersion([{ name: '@nextrush/openapi', version: '1.1.0' }])).toBeNull();
    expect(
      deriveProductVersion([
        { name: '@nextrush/dev', version: '1.0.2' },
        { name: 'create-nextrush', version: '1.0.2' },
      ])
    ).toBeNull();
  });

  it('returns null for an empty wave', () => {
    expect(deriveProductVersion([])).toBeNull();
  });
});

describe('release-name classification', () => {
  it('recognizes per-package release names', () => {
    expect(isPackageReleaseName('nextrush@4.0.1')).toBe(true);
    expect(isPackageReleaseName('create-nextrush@3.0.9')).toBe(true);
    expect(isPackageReleaseName('@nextrush/openapi@1.0.2')).toBe(true);
    expect(isPackageReleaseName('@nextrush/dev@1.0.2')).toBe(true);
  });

  it('rejects canonical and malformed names', () => {
    expect(isPackageReleaseName('NextRush v4.0.1')).toBe(false);
    expect(isPackageReleaseName('NextRush v2.0.0 - Framework')).toBe(false);
    expect(isPackageReleaseName('v2.0.0')).toBe(false);
    expect(isPackageReleaseName('nextrush@4.0')).toBe(false);
    expect(isPackageReleaseName('@nextrush/openapi@1.0.2-beta.1')).toBe(false);
  });

  it('recognizes canonical release names and tags', () => {
    expect(isCanonicalReleaseName('NextRush v4.0.1')).toBe(true);
    expect(isCanonicalReleaseName('NextRush v2.0.0 - Framework', 'v2.0.0')).toBe(true);
    expect(isCanonicalReleaseName('anything-else', 'v2.0.0')).toBe(true);
    expect(isCanonicalReleaseName('nextrush@4.0.1', 'nextrush@4.0.1')).toBe(false);
  });

  it('extracts versions and package names from release names', () => {
    expect(extractVersionFromPackageName('nextrush@4.0.1')).toBe('4.0.1');
    expect(extractVersionFromPackageName('@nextrush/openapi@1.0.2')).toBe('1.0.2');
    expect(extractVersionFromPackageName('create-nextrush@3.0.9')).toBe('3.0.9');
    expect(extractVersionFromPackageName('NextRush v4.0.1')).toBeNull();
    expect(packageNameFromReleaseName('@nextrush/openapi@1.0.2')).toBe('@nextrush/openapi');
    expect(packageNameFromReleaseName('nextrush@4.0.1')).toBe('nextrush');
  });
});

const SAMPLE_CHANGELOG = [
  '# @nextrush/router',
  '',
  '## 4.0.1',
  '',
  '### Patch Changes',
  '',
  '- [#45](https://github.com/0xTanzim/nextRush/pull/45) [`6e9e28b`](https://github.com/0xTanzim/nextRush/commit/6e9e28b) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Fixed mounted metadata propagation.',
  '',
  '- Updated dependencies []:',
  '  - @nextrush/types@4.0.1',
  '',
  '## 4.0.0',
  '',
  '### Patch Changes',
  '',
  '- Consolidated patch release.',
  '',
  '## 4.0.0-beta.2',
  '',
  '### Patch Changes',
  '',
  '- Beta two content.',
].join('\n');

describe('extractChangelogSection', () => {
  it('extracts the section for the exact version, stopping at the next header', () => {
    const section = extractChangelogSection(SAMPLE_CHANGELOG, '4.0.1');
    expect(section).toContain('### Patch Changes');
    expect(section).toContain('Fixed mounted metadata propagation');
    expect(section).toContain('@nextrush/types@4.0.1');
    expect(section).not.toContain('Consolidated patch release');
    expect(section.startsWith('## ')).toBe(false);
  });

  it('does not let `## 4.0.0` match `## 4.0.0-beta.2` (exact header match)', () => {
    const section = extractChangelogSection(SAMPLE_CHANGELOG, '4.0.0');
    expect(section).toContain('Consolidated patch release');
    expect(section).not.toContain('Beta two');
  });

  it('returns null for a missing version and handles CRLF input', () => {
    expect(extractChangelogSection(SAMPLE_CHANGELOG, '99.0.0')).toBeNull();
    const crlf = SAMPLE_CHANGELOG.replace(/\n/g, '\r\n');
    expect(extractChangelogSection(crlf, '4.0.1')).toContain('Fixed mounted metadata propagation');
  });
});

describe('extractMeaningfulBullets', () => {
  it('strips changelog-github attribution prefixes', () => {
    const bullets = extractMeaningfulBullets(
      '### Patch Changes\n' +
        '\n' +
        '- [#45](https://github.com/0xTanzim/nextRush/pull/45) [`6e9e28b`](https://github.com/0xTanzim/nextRush/commit/6e9e28b) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Fix the launcher exiting early.\n' +
        '- [`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Consolidated patch release.\n' +
        '- Updated dependencies []:\n' +
        '  - @nextrush/types@4.0.1\n' +
        '- A plain bullet without attribution.\n'
    );
    expect(bullets).toEqual([
      '- Fix the launcher exiting early.',
      '- Consolidated patch release.',
      '- A plain bullet without attribution.',
    ]);
  });

  it('joins wrapped continuation lines back onto their bullet', () => {
    const bullets = extractMeaningfulBullets(
      '- [#1](x) Thanks [@u](y)! - Fix the launcher exiting 0 before the delegated CLI has\n' +
        '  finished its async work (issue [#40](https://github.com/0xTanzim/nextrush/issues/40)).\n' +
        '- Consolidated patch release.\n'
    );
    expect(bullets).toEqual([
      '- Fix the launcher exiting 0 before the delegated CLI has finished its async work (issue [#40](https://github.com/0xTanzim/nextrush/issues/40)).',
      '- Consolidated patch release.',
    ]);
  });

  it('returns [] when there is nothing meaningful', () => {
    expect(extractMeaningfulBullets('')).toEqual([]);
    expect(
      extractMeaningfulBullets('- Updated dependencies []:\n  - @nextrush/core@4.0.1')
    ).toEqual([]);
  });
});

describe('assembleReleaseBody', () => {
  const packages = [
    { name: 'nextrush', version: '4.0.1' },
    { name: '@nextrush/openapi', version: '1.0.2' },
    { name: '@nextrush/core', version: '4.0.1' },
  ];

  it('renders the canonical product body with highlights, tables, and changes', () => {
    const body = assembleReleaseBody({
      productVersion: '4.0.1',
      packages,
      changes: new Map([
        [
          'nextrush',
          '### Patch Changes\n\n- Fixed the launcher exiting early.\n\n- Updated dependencies []:\n  - @nextrush/types@4.0.1',
        ],
        [
          '@nextrush/openapi',
          '### Patch Changes\n\n- Updated dependencies []:\n  - @nextrush/types@4.0.1',
        ],
        ['@nextrush/core', '### Patch Changes\n\n- Consolidated patch release.'],
      ]),
      highlights: ['- Fixed the launcher exiting early.'],
    });
    expect(body).toBe(
      [
        '# NextRush v4.0.1',
        '',
        '## Highlights',
        '',
        '- Fixed the launcher exiting early.',
        '',
        '## Packages',
        '',
        '| Package | Version |',
        '| --- | --- |',
        '| nextrush | 4.0.1 |',
        '| @nextrush/core | 4.0.1 |',
        '| @nextrush/openapi | 1.0.2 |',
        '',
        '## Changes',
        '',
        '### nextrush',
        '',
        '### Patch Changes',
        '',
        '- Fixed the launcher exiting early.',
        '',
        '- Updated dependencies []:',
        '  - @nextrush/types@4.0.1',
        '',
        '### @nextrush/core',
        '',
        '### Patch Changes',
        '',
        '- Consolidated patch release.',
        '',
        '### @nextrush/openapi',
        '',
        '### Patch Changes',
        '',
        '- Updated dependencies []:',
        '  - @nextrush/types@4.0.1',
        '',
        '## Installation',
        '',
        'pnpm add nextrush@4.0.1',
        '',
      ].join('\n')
    );
  });

  it('omits Highlights when there are none, and annotates entry-less packages', () => {
    const body = assembleReleaseBody({
      productVersion: '3.5.0',
      packages: [{ name: 'nextrush', version: '3.5.0' }],
      changes: new Map([['nextrush', '']]),
    });
    expect(body).toContain('# NextRush v3.5.0');
    expect(body).not.toContain('## Highlights');
    expect(body).toContain('### nextrush');
    expect(body).toContain('*Dependency-only update.*');
    expect(body).toContain('pnpm add nextrush@3.5.0');
  });

  it('sorts nextrush first regardless of input order', () => {
    const body = assembleReleaseBody({
      productVersion: '4.0.1',
      packages: [
        { name: '@nextrush/core', version: '4.0.1' },
        { name: 'nextrush', version: '4.0.1' },
      ],
      changes: new Map(),
    });
    const tableStart = body.indexOf('| Package | Version |');
    const nextrushRow = body.indexOf('| nextrush |');
    const coreRow = body.indexOf('| @nextrush/core |');
    expect(tableStart).toBeGreaterThanOrEqual(0);
    expect(nextrushRow).toBeGreaterThan(-1);
    expect(coreRow).toBeGreaterThan(-1);
    expect(nextrushRow).toBeLessThan(coreRow);
  });
});

describe('compareSemver', () => {
  it('orders versions numerically, not lexically', () => {
    expect(compareSemver('10.0.0', '9.0.0')).toBeGreaterThan(0);
    expect(compareSemver('4.0.1', '4.0.1')).toBe(0);
    expect(compareSemver('4.0.0', '3.5.2')).toBeGreaterThan(0);
    expect(compareSemver('1.1.0', '1.1.1')).toBeLessThan(0);
  });
});

describe('groupWaves', () => {
  const mk = (name: string, commit: string, body = '### Patch Changes'): PackageReleaseInfo => ({
    name,
    tagName: name,
    commit,
    body,
  });

  it('groups releases into waves by commit and derives productVersion', () => {
    const waves = groupWaves([
      mk('nextrush@4.0.1', 'aaa'),
      mk('@nextrush/core@4.0.1', 'aaa'),
      mk('@nextrush/dev@1.0.1', 'bbb'),
      mk('@nextrush/openapi@1.0.1', 'bbb'),
    ]);
    expect(waves).toHaveLength(2);
    const byCommit = new Map(waves.map((wave) => [wave.commit, wave]));
    const waveA = byCommit.get('aaa')!;
    const waveB = byCommit.get('bbb')!;
    expect(waveA.productVersion).toBe('4.0.1');
    expect(waveA.releases.map((release) => release.name)).toEqual([
      '@nextrush/core@4.0.1',
      'nextrush@4.0.1',
    ]);
    expect(waveB.productVersion).toBeNull();
    expect(waveB.releases.map((release) => release.name)).toEqual([
      '@nextrush/dev@1.0.1',
      '@nextrush/openapi@1.0.1',
    ]);
  });

  it('orders waves newest-first by product version, package-only waves last', () => {
    const waves = groupWaves([
      mk('nextrush@4.0.1', 'aaa'),
      mk('@nextrush/dev@1.0.1', 'bbb'),
      mk('nextrush@3.5.2', 'ccc'),
    ]);
    expect(waves.map((wave) => wave.productVersion)).toEqual(['4.0.1', '3.5.2', null]);
  });

  it('keeps package-only waves last even when their package version is higher than a product wave', () => {
    const waves = groupWaves([
      mk('nextrush@3.0.7', 'aaa'),
      mk('create-nextrush@3.0.9', 'bbb'),
      mk('nextrush@4.0.1', 'ccc'),
    ]);
    expect(waves.map((wave) => wave.productVersion)).toEqual(['4.0.1', '3.0.7', null]);
  });
});

describe('buildCanonicalReleasePlans', () => {
  const mk = (name: string, commit: string, body: string): PackageReleaseInfo => ({
    name,
    tagName: name,
    commit,
    body,
  });

  it('creates a plan only for waves that published `nextrush`', () => {
    const plans = buildCanonicalReleasePlans(
      groupWaves([
        mk(
          'nextrush@4.0.1',
          'aaa',
          '### Patch Changes\n\n- [#1](x) Thanks [@u](y)! - Launcher fix.'
        ),
        mk('@nextrush/openapi@1.0.2', 'aaa', '### Patch Changes\n\n- Updated dependencies []:'),
        mk('@nextrush/dev@1.0.1', 'bbb', '### Patch Changes'),
      ])
    );
    expect(plans).toHaveLength(1);
    const plan = plans[0]!;
    expect(plan.tag).toBe('v4.0.1');
    expect(plan.title).toBe('NextRush v4.0.1');
    expect(plan.commit).toBe('aaa');
    expect(plan.packages).toEqual([
      { name: '@nextrush/openapi', version: '1.0.2' },
      { name: 'nextrush', version: '4.0.1' },
    ]);
    expect(plan.changes.get('nextrush')).toContain('Launcher fix.');
    expect(plan.highlights).toEqual(['- Launcher fix.']);
  });

  it('orders plans newest-first', () => {
    const plans = buildCanonicalReleasePlans(
      groupWaves([
        mk('nextrush@3.5.2', 'ccc', '### Patch Changes'),
        mk('nextrush@4.0.1', 'aaa', '### Patch Changes'),
      ])
    );
    expect(plans.map((plan) => plan.productVersion)).toEqual(['4.0.1', '3.5.2']);
  });
});
