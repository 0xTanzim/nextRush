/**
 * @nextrush/cookies - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as cookiesApi from '../index';
import { COMMON_PUBLIC_SUFFIXES, COOKIE_PREFIXES, DEFAULT_COOKIE_OPTIONS, MAX_COOKIE_SIZE, MAX_NAME_LENGTH, MAX_VALUE_LENGTH } from '../index';
import type { CookieContext, CookieMiddlewareOptions, CookieOptions, CookiePriority, CookieState, ParsedCookies, ParseOptions, SameSiteValue, SignedCookieContext, SignedCookieMiddlewareOptions, SignedCookieState, SigningKeys } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(cookiesApi).sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      'cookies',
      'secureOptions',
      'sessionOptions',
      'signedCookies',
      'createDeleteCookie',
      'createHostPrefixCookie',
      'createSecurePrefixCookie',
      'serializeCookie',
      'getCookie',
      'getCookieNames',
      'hasCookie',
      'parseCookies',
      'clearKeyCache',
      'signCookie',
      'timingSafeEqual',
      'unsignCookie',
      'unsignCookieWithRotation',
      'SecurityError',
      'isPublicSuffix',
      'isValidCookieName',
      'isValidCookieValue',
      'isValidDomain',
      'isValidPath',
      'sanitizeCookieValue',
      'validateCookieOptions',
      'validateCookiePrefix',
      'COMMON_PUBLIC_SUFFIXES',
      'COOKIE_PREFIXES',
      'DEFAULT_COOKIE_OPTIONS',
      'MAX_COOKIE_SIZE',
      'MAX_NAME_LENGTH',
      'MAX_VALUE_LENGTH',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(typeof COMMON_PUBLIC_SUFFIXES === 'object').toBe(true);
    expect(typeof COOKIE_PREFIXES).toBe('object');
    expect(typeof DEFAULT_COOKIE_OPTIONS).toBe('object');
    expect(typeof MAX_COOKIE_SIZE).toBe('number');
    expect(typeof MAX_NAME_LENGTH).toBe('number');
    expect(typeof MAX_VALUE_LENGTH).toBe('number');
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [
      ParseOptions,
      SigningKeys,
      CookieContext,
      CookieMiddlewareOptions,
      CookieOptions,
      CookiePriority,
      CookieState,
      ParsedCookies,
      SameSiteValue,
      SignedCookieContext,
      SignedCookieMiddlewareOptions,
      SignedCookieState,
    ];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
