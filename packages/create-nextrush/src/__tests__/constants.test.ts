import { describe, expect, it } from 'vitest';

import {
  ADAPTER_PACKAGES,
  MIDDLEWARE_IMPORTS,
  MIDDLEWARE_PACKAGES,
  MIDDLEWARE_PRESETS,
  MIDDLEWARE_SETUP,
  NEXTRUSH_VERSION,
  PACKAGE_NAME_REGEX,
  RUNTIMES,
  STYLES,
} from '../constants.js';

describe('constants', () => {
  it('has a valid semver version', () => {
    expect(NEXTRUSH_VERSION).toMatch(/^\d+\.\d+\.\d+/);
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

  describe('MIDDLEWARE_PACKAGES', () => {
    it('minimal has no packages', () => {
      expect(Object.keys(MIDDLEWARE_PACKAGES.minimal)).toHaveLength(0);
    });

    it('api has cors, body-parser, helmet', () => {
      const packages = Object.keys(MIDDLEWARE_PACKAGES.api);
      expect(packages).toContain('@nextrush/cors');
      expect(packages).toContain('@nextrush/body-parser');
      expect(packages).toContain('@nextrush/helmet');
      expect(packages).toHaveLength(3);
    });

    it('full includes all api packages plus extras', () => {
      const packages = Object.keys(MIDDLEWARE_PACKAGES.full);
      expect(packages).toContain('@nextrush/cors');
      expect(packages).toContain('@nextrush/body-parser');
      expect(packages).toContain('@nextrush/helmet');
      expect(packages).toContain('@nextrush/rate-limit');
      expect(packages).toContain('@nextrush/compression');
      expect(packages).toContain('@nextrush/request-id');
      expect(packages).toHaveLength(6);
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

  describe('ADAPTER_PACKAGES', () => {
    it('node has no adapter package', () => {
      expect(Object.keys(ADAPTER_PACKAGES.node)).toHaveLength(0);
    });

    it('bun has adapter-bun', () => {
      expect(ADAPTER_PACKAGES.bun).toHaveProperty('@nextrush/adapter-bun');
    });

    it('deno has adapter-deno', () => {
      expect(ADAPTER_PACKAGES.deno).toHaveProperty('@nextrush/adapter-deno');
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
