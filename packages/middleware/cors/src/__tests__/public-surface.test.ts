/**
 * @nextrush/cors - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as corsApi from '../index';
import { CORS_HEADERS, DEFAULT_MAX_AGE, DEFAULT_METHODS, DEFAULT_OPTIONS_SUCCESS_STATUS, ORIGIN_HEADER, PREFLIGHT_INDICATORS, VARY_HEADER } from '../index';
import type { Context, CorsContext, CorsOptions, Middleware, Next, OriginOption, OriginValidator, SecuritySeverity } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols (default export excluded — vitest module namespace)', () => {
    const actualExports = Object.keys(corsApi).filter((k) => k !== 'default').sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      'cors',
      'CorsOptionsBuilder',
      'createCorsOptions',
      'devCors',
      'internalCors',
      'simpleCors',
      'staticAssetsCors',
      'strictCors',
      'createOriginCache',
      'isOriginAllowed',
      'isOriginInList',
      'isOriginMatchingPattern',
      'appendVary',
      'buildMethodList',
      'headerContains',
      'normalizeHeaders',
      'parseHeaderList',
      'setVaryHeaders',
      'isOriginSecure',
      'isRegexSafe',
      'isValidOriginFormat',
      'securityWarning',
      'CORS_HEADERS',
      'DEFAULT_MAX_AGE',
      'DEFAULT_METHODS',
      'DEFAULT_OPTIONS_SUCCESS_STATUS',
      'ORIGIN_HEADER',
      'PREFLIGHT_INDICATORS',
      'VARY_HEADER',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(corsApi.default).toBeDefined();
    expect(typeof CORS_HEADERS).toBe('object');
    expect(typeof DEFAULT_MAX_AGE).toBe('number');
    expect(typeof DEFAULT_METHODS).toBe('string');
    expect(typeof DEFAULT_OPTIONS_SUCCESS_STATUS).toBe('number');
    expect(typeof ORIGIN_HEADER).toBe('string');
    expect(Array.isArray(PREFLIGHT_INDICATORS) || typeof PREFLIGHT_INDICATORS === 'object').toBe(true);
    expect(typeof VARY_HEADER).toBe('string');
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [CorsContext, CorsOptions, OriginOption, OriginValidator, SecuritySeverity, Context, Middleware, Next];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
