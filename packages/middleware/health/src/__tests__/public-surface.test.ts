/**
 * @nextrush/health - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as healthApi from '../index';
import {
    DEFAULT_CHECK_TIMEOUT_MS,
    DEFAULT_LIVEZ_PATH,
    DEFAULT_READYZ_PATH,
    HTTP_OK,
    HTTP_SERVICE_UNAVAILABLE,
    STATUS_ERROR,
    STATUS_OK,
    health,
} from '../index';
import type { CheckFn, HealthInstance, HealthOptions, HealthResponseBody } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(healthApi).sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      'DEFAULT_CHECK_TIMEOUT_MS',
      'DEFAULT_LIVEZ_PATH',
      'DEFAULT_READYZ_PATH',
      'HTTP_OK',
      'HTTP_SERVICE_UNAVAILABLE',
      'STATUS_ERROR',
      'STATUS_OK',
      'health',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(typeof DEFAULT_CHECK_TIMEOUT_MS).toBe('number');
    expect(typeof DEFAULT_LIVEZ_PATH).toBe('string');
    expect(typeof DEFAULT_READYZ_PATH).toBe('string');
    expect(typeof HTTP_OK).toBe('number');
    expect(typeof HTTP_SERVICE_UNAVAILABLE).toBe('number');
    expect(typeof STATUS_ERROR).toBe('string');
    expect(typeof STATUS_OK).toBe('string');
    expect(typeof health).toBe('function');
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [CheckFn, HealthInstance, HealthOptions, HealthResponseBody];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
