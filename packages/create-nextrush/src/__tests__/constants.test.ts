import { beforeEach, describe, expect, it } from 'vitest';

import {
    getAdapterPackages,
    MIDDLEWARE_IMPORTS,
    getMiddlewarePackages,
    MIDDLEWARE_PRESETS,
    MIDDLEWARE_SETUP,
    NEXTRUSH_VERSION,
    PACKAGE_NAME_REGEX,
    RUNTIMES,
    STYLES,
} from '../constants.js';
import { setVersions } from '../version-store.js';

describe('constants', () => {
  beforeEach(() => {
    setVersions('^3.0.5', '^3.0.5');
  });

  it('has a valid semver version', () => {
    expect(NEXTRUSH_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('has a non-empty version string', () => {
    expect(NEXTRUSH_VERSION.length).toBeGreaterThan(0);
  });

  it('exports all style options', () => {
    expect(STYLES).toContain('functional');
    expect(STYLES).toContain('class-based');
    expect(STYLES).toContain('full');
  });

  it('exports all runtime options', () => {
    expect(RUNTIMES).toContain('node');
    expect(RUNTIMES).toContain('bun');
    expect(RUNTIMES).toContain('deno');
  });

  it('exports all middleware presets', () => {
    expect(MIDDLEWARE_PRESETS).toContain('minimal');
    expect(MIDDLEWARE_PRESETS).toContain('api');
    expect(MIDDLEWARE_PRESETS).toContain('full');
  });

  describe('getMiddlewarePackages', () => {
    it('minimal has no packages', () => {
      expect(Object.keys(getMiddlewarePackages().minimal)).toHaveLength(0);
    });

    it('api has cors, body-parser, helmet', () => {
      const packages = Object.keys(getMiddlewarePackages().api);
      expect(packages).toContain('@nextrush/cors');
      expect(packages).toContain('@nextrush/body-parser');
      expect(packages).toContain('@nextrush/helmet');
      expect(packages).toHaveLength(3);
    });

    it('full includes all api packages plus extras', () => {
      const packages = Object.keys(getMiddlewarePackages().full);
      expect(packages).toContain('@nextrush/cors');
      expect(packages).toContain('@nextrush/body-parser');
      expect(packages).toContain('@nextrush/helmet');
      expect(packages).toContain('@nextrush/rate-limit');
      expect(packages).toContain('@nextrush/compression');
      expect(packages).toContain('@nextrush/request-id');
      expect(packages).toHaveLength(6);
    });

    it('uses versions from version store', () => {
      setVersions('^4.0.0', '^5.0.0');
      const pkgs = getMiddlewarePackages();
      expect(pkgs.api['@nextrush/cors']).toBe('^5.0.0');
    });
  });

  describe('MIDDLEWARE_IMPORTS', () => {
    it('minimal has empty imports', () => {
      expect(MIDDLEWARE_IMPORTS.minimal).toBe('');
    });

    it('api imports cors, body-parser, helmet', () => {
      expect(MIDDLEWARE_IMPORTS.api).toContain('@nextrush/cors');
      expect(MIDDLEWARE_IMPORTS.api).toContain('@nextrush/body-parser');
      expect(MIDDLEWARE_IMPORTS.api).toContain('@nextrush/helmet');
    });

    it('full imports all middleware', () => {
      expect(MIDDLEWARE_IMPORTS.full).toContain('@nextrush/rate-limit');
      expect(MIDDLEWARE_IMPORTS.full).toContain('@nextrush/compression');
      expect(MIDDLEWARE_IMPORTS.full).toContain('@nextrush/request-id');
    });
  });

  describe('MIDDLEWARE_SETUP', () => {
    it('minimal has empty setup', () => {
      expect(MIDDLEWARE_SETUP.minimal).toBe('');
    });

    it('api uses cors, helmet, json', () => {
      expect(MIDDLEWARE_SETUP.api).toContain('cors()');
      expect(MIDDLEWARE_SETUP.api).toContain('helmet()');
      expect(MIDDLEWARE_SETUP.api).toContain('json()');
    });

    it('full uses all middleware functions', () => {
      expect(MIDDLEWARE_SETUP.full).toContain('rateLimit()');
      expect(MIDDLEWARE_SETUP.full).toContain('compression()');
      expect(MIDDLEWARE_SETUP.full).toContain('requestId()');
    });
  });

  describe('getAdapterPackages', () => {
    it('node has no adapter package', () => {
      expect(Object.keys(getAdapterPackages().node)).toHaveLength(0);
    });

    it('bun has adapter-bun', () => {
      expect(getAdapterPackages().bun).toHaveProperty('@nextrush/adapter-bun');
    });

    it('deno has adapter-deno', () => {
      expect(getAdapterPackages().deno).toHaveProperty('@nextrush/adapter-deno');
    });

    it('uses versions from version store', () => {
      setVersions('^4.0.0', '^5.0.0');
      const pkgs = getAdapterPackages();
      expect(pkgs.bun['@nextrush/adapter-bun']).toBe('^5.0.0');
    });
  });

  describe('PACKAGE_NAME_REGEX', () => {
    it('accepts valid names', () => {
      expect(PACKAGE_NAME_REGEX.test('my-app')).toBe(true);
      expect(PACKAGE_NAME_REGEX.test('my-app.test')).toBe(true);
      expect(PACKAGE_NAME_REGEX.test('@scope/package')).toBe(true);
    });

    it('rejects invalid names', () => {
      expect(PACKAGE_NAME_REGEX.test('My-App')).toBe(false);
      expect(PACKAGE_NAME_REGEX.test('')).toBe(false);
      expect(PACKAGE_NAME_REGEX.test(' spaces')).toBe(false);
    });
  });
});
