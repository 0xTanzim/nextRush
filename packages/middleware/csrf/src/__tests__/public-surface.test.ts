/**
 * @nextrush/csrf - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as csrfApi from '../index';
import { CSRF_FIELD, CSRF_HEADER, DEFAULT_COOKIE_NAME, DEFAULT_IGNORED_METHODS, DEFAULT_TOKEN_SIZE, ERRORS, XSRF_HEADER } from '../index';
import type { CsrfContext, CsrfCookieOptions, CsrfMiddleware, CsrfOptions, SessionIdentifierExtractor, TokenExtractor } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(csrfApi).sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      'csrf',
      'constantTimeEqual',
      'generateToken',
      'validateToken',
      'CSRF_FIELD',
      'CSRF_HEADER',
      'DEFAULT_COOKIE_NAME',
      'DEFAULT_IGNORED_METHODS',
      'DEFAULT_TOKEN_SIZE',
      'ERRORS',
      'XSRF_HEADER',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(typeof CSRF_FIELD).toBe('string');
    expect(typeof CSRF_HEADER).toBe('string');
    expect(typeof DEFAULT_COOKIE_NAME).toBe('string');
    expect(Array.isArray(DEFAULT_IGNORED_METHODS)).toBe(true);
    expect(typeof DEFAULT_TOKEN_SIZE).toBe('number');
    expect(typeof ERRORS).toBe('object');
    expect(typeof XSRF_HEADER).toBe('string');
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [CsrfContext, CsrfCookieOptions, CsrfMiddleware, CsrfOptions, SessionIdentifierExtractor, TokenExtractor];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
