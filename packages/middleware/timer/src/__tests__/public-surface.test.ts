/**
 * @nextrush/timer - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as timerApi from '../index';
import { DEFAULT_HEADER, DEFAULT_METRIC, DEFAULT_PRECISION, DEFAULT_STATE_KEY, DEFAULT_SUFFIX, MAX_PRECISION, SERVER_TIMING_HEADER, defaultTimeGetter } from '../index';
import type { DetailedTimerOptions, Middleware, ServerTimingOptions, TimeGetter, TimerContext, TimerOptions, TimingResult } from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(timerApi).sort();

    // SEALED: intentional public runtime API surface.
    const expectedRuntime = [
      'DEFAULT_HEADER',
      'DEFAULT_METRIC',
      'DEFAULT_PRECISION',
      'DEFAULT_STATE_KEY',
      'DEFAULT_SUFFIX',
      'MAX_PRECISION',
      'SERVER_TIMING_HEADER',
      'defaultTimeGetter',
      'detailedTimer',
      'responseTime',
      'serverTiming',
      'timer',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(typeof DEFAULT_HEADER).toBe('string');
    expect(typeof DEFAULT_METRIC).toBe('string');
    expect(typeof DEFAULT_PRECISION).toBe('number');
    expect(typeof DEFAULT_STATE_KEY).toBe('string');
    expect(typeof DEFAULT_SUFFIX).toBe('string');
    expect(typeof MAX_PRECISION).toBe('number');
    expect(typeof SERVER_TIMING_HEADER).toBe('string');
    expect(typeof defaultTimeGetter).toBe('function');
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [DetailedTimerOptions, Middleware, ServerTimingOptions, TimeGetter, TimerContext, TimerOptions, TimingResult];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
