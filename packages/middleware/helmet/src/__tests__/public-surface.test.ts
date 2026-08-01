/**
 * @nextrush/helmet - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as helmetApi from '../index';
import { BOOLEAN_CSP_DIRECTIVES, DEFAULT_CSP_DIRECTIVES, DEFAULT_HSTS_MAX_AGE, HEADERS, MIN_HSTS_PRELOAD_MAX_AGE, RECOMMENDED_HSTS_MAX_AGE, STRICT_CSP_DIRECTIVES, UNSAFE_CSP_VALUES, VALID_CSP_DIRECTIVES } from '../index';
import type {
  ClearSiteDataValue,
  ContentSecurityPolicyDirectives,
  ContentSecurityPolicyOptions,
  CrossOriginEmbedderPolicyValue,
  CrossOriginOpenerPolicyValue,
  CrossOriginResourcePolicyValue,
  CspDirectiveName,
  CspSandboxValue,
  CspSourceValue,
  CspWithNonceOptions,
  HelmetContext,
  HelmetMiddleware,
  HelmetOptions,
  HstsValidationResult,
  Middleware,
  NonceProvider,
  PermissionsPolicyAllowlist,
  PermissionsPolicyDirectives,
  PermissionsPolicyFeature,
  ReferrerPolicyValue,
  StrictTransportSecurityOptions,
} from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols (default export excluded — vitest module namespace)', () => {
    const actualExports = Object.keys(helmetApi).filter((k) => k !== 'default').sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      'helmet',
      'apiHelmet',
      'contentSecurityPolicy',
      'devHelmet',
      'hidePoweredBy',
      'hsts',
      'logoutHelmet',
      'noSniff',
      'referrerPolicy',
      'staticHelmet',
      'strictHelmet',
      'analyzeCsp',
      'buildCspHeader',
      'buildCspWithNonce',
      'createCspBuilder',
      'CspBuilder',
      'buildPermissionsPolicyHeader',
      'createPermissionsPolicyBuilder',
      'PermissionsPolicyBuilder',
      'restrictivePermissionsPolicy',
      'createNoncedScript',
      'createNoncedStyle',
      'createNonceProvider',
      'extractNonce',
      'generateCspNonce',
      'generateNonce',
      'validateNonce',
      'analyzeCspSecurity',
      'isBooleanCspDirective',
      'isCspValueSafe',
      'isUnsafeCspValue',
      'isValidCspDirective',
      'isValidHash',
      'isValidNonce',
      'sanitizeCspValue',
      'sanitizeHeaderValue',
      'securityWarning',
      'validateHstsOptions',
      'BOOLEAN_CSP_DIRECTIVES',
      'DEFAULT_CSP_DIRECTIVES',
      'DEFAULT_HSTS_MAX_AGE',
      'HEADERS',
      'MIN_HSTS_PRELOAD_MAX_AGE',
      'RECOMMENDED_HSTS_MAX_AGE',
      'STRICT_CSP_DIRECTIVES',
      'UNSAFE_CSP_VALUES',
      'VALID_CSP_DIRECTIVES',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(helmetApi.default).toBeDefined();
    expect(Array.isArray(BOOLEAN_CSP_DIRECTIVES) || typeof BOOLEAN_CSP_DIRECTIVES === 'object').toBe(true);
    expect(typeof DEFAULT_CSP_DIRECTIVES).toBe('object');
    expect(typeof DEFAULT_HSTS_MAX_AGE).toBe('number');
    expect(typeof HEADERS).toBe('object');
    expect(typeof MIN_HSTS_PRELOAD_MAX_AGE).toBe('number');
    expect(typeof RECOMMENDED_HSTS_MAX_AGE).toBe('number');
    expect(typeof STRICT_CSP_DIRECTIVES).toBe('object');
    expect(typeof UNSAFE_CSP_VALUES === 'object').toBe(true);
    expect(typeof VALID_CSP_DIRECTIVES === 'object').toBe(true);
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [
      ClearSiteDataValue,
      ContentSecurityPolicyDirectives,
      ContentSecurityPolicyOptions,
      CrossOriginEmbedderPolicyValue,
      CrossOriginOpenerPolicyValue,
      CrossOriginResourcePolicyValue,
      CspDirectiveName,
      CspSandboxValue,
      CspSourceValue,
      CspWithNonceOptions,
      HelmetContext,
      HelmetMiddleware,
      HelmetOptions,
      Middleware,
      NonceProvider,
      PermissionsPolicyAllowlist,
      PermissionsPolicyDirectives,
      PermissionsPolicyFeature,
      ReferrerPolicyValue,
      StrictTransportSecurityOptions,
      HstsValidationResult,
    ];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
