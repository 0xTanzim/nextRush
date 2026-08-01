/**
 * @nextrush/request-id - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as requestIdApi from '../index';
import { CORRELATION_HEADER, CORRELATION_STATE_KEY, DEFAULT_HEADER, DEFAULT_MAX_LENGTH, DEFAULT_STATE_KEY, TRACE_HEADER, TRACE_STATE_KEY, defaultGenerator } from '../index';
import type { CorrelationIdOptions, IdGenerator, IdValidator, Middleware, RequestIdContext, RequestIdOptions, TraceIdOptions } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(requestIdApi).sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      'CORRELATION_HEADER',
      'CORRELATION_STATE_KEY',
      'DEFAULT_HEADER',
      'DEFAULT_MAX_LENGTH',
      'DEFAULT_STATE_KEY',
      'TRACE_HEADER',
      'TRACE_STATE_KEY',
      'defaultGenerator',
      'createValidator',
      'defaultValidator',
      'isSafeId',
      'isValidLength',
      'isValidUuid',
      'permissiveValidator',
      'validateId',
      'correlationId',
      'requestId',
      'traceId',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(typeof CORRELATION_HEADER).toBe('string');
    expect(typeof CORRELATION_STATE_KEY).toBe('string');
    expect(typeof DEFAULT_HEADER).toBe('string');
    expect(typeof DEFAULT_MAX_LENGTH).toBe('number');
    expect(typeof DEFAULT_STATE_KEY).toBe('string');
    expect(typeof TRACE_HEADER).toBe('string');
    expect(typeof TRACE_STATE_KEY).toBe('string');
    expect(typeof defaultGenerator).toBe('function');
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [CorrelationIdOptions, IdGenerator, IdValidator, Middleware, RequestIdContext, RequestIdOptions, TraceIdOptions];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
