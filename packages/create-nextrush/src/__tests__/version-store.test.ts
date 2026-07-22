import { afterEach, describe, expect, it } from 'vitest';

import { getPackageRange, setPackageVersion, setVersionMap, setVersions } from '../version-store.js';

/** Unit coverage for version-store.ts's public API (Wave 6 coverage gate). */
describe('version-store', () => {
  afterEach(() => {
    setVersions({});
  });

  it('setVersionMap sets the resolved version map used by getPackageRange', () => {
    setVersionMap(new Map([['nextrush', '^3.1.0']]));
    expect(getPackageRange('nextrush')).toBe('^3.1.0');
  });

  it('getPackageRange throws a descriptive error for an unresolved package', () => {
    setVersions({});
    expect(() => getPackageRange('@nextrush/never-resolved')).toThrow(
      /No resolved version for package "@nextrush\/never-resolved"/
    );
  });

  it('setPackageVersion overrides one entry without disturbing the rest of the map', () => {
    setVersions({ nextrush: '^3.1.0', '@nextrush/dev': '^1.0.0' });
    setPackageVersion('@nextrush/dev', '^2.0.0');

    expect(getPackageRange('nextrush')).toBe('^3.1.0');
    expect(getPackageRange('@nextrush/dev')).toBe('^2.0.0');
  });
});
