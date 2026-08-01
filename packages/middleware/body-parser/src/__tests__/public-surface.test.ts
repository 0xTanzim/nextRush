/**
 * @nextrush/body-parser - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as bodyParserApi from '../index';
import { BODYLESS_METHODS, DEFAULT_CONTENT_TYPES, DEFAULT_LIMITS, DEFAULT_PARAMETER_LIMITS, PATTERNS, SIZE_UNITS, SUPPORTED_CHARSETS } from '../index';
import type { BodyParserContext, BodyParserErrorCode, BodyParserOptions, JsonOptions, RawOptions, TextOptions, UrlEncodedOptions, VerifyCallback } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols (default export excluded — vitest module namespace)', () => {
    const actualExports = Object.keys(bodyParserApi).filter((k) => k !== 'default').sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      'BodyParserError',
      'Errors',
      'BODYLESS_METHODS',
      'DEFAULT_CONTENT_TYPES',
      'DEFAULT_LIMITS',
      'DEFAULT_PARAMETER_LIMITS',
      'PATTERNS',
      'SIZE_UNITS',
      'SUPPORTED_CHARSETS',
      'bufferToString',
      'concatBuffers',
      'extractCharset',
      'getContentLength',
      'getContentType',
      'isJsonContentType',
      'matchContentType',
      'normalizeCharset',
      'formatBytes',
      'parseLimit',
      'parseUrlEncoded',
      'safeDecodeURIComponent',
      'setNestedValue',
      'bodyParser',
      'json',
      'raw',
      'readBody',
      'text',
      'urlencoded',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(bodyParserApi.default).toBeDefined();
    expect(BODYLESS_METHODS instanceof Set).toBe(true);
    expect(typeof DEFAULT_CONTENT_TYPES).toBe('object');
    expect(typeof DEFAULT_LIMITS).toBe('object');
    expect(typeof DEFAULT_PARAMETER_LIMITS).toBe('object');
    expect(typeof PATTERNS).toBe('object');
    expect(typeof SIZE_UNITS).toBe('object');
    expect(typeof SUPPORTED_CHARSETS === 'object').toBe(true);
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [BodyParserContext, BodyParserErrorCode, BodyParserOptions, JsonOptions, RawOptions, TextOptions, UrlEncodedOptions, VerifyCallback];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
