/**
 * @nextrush/logger - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as loggerApi from '../index';
import { log, createLogger, configure } from '../index';
import * as logApi from '@nextrush/log';
import type { LoggerContext, LoggerMiddlewareOptions } from '../index';
import type {
  AsyncLogContext,
  BatchTransport,
  BatchTransportOptions,
  GlobalLoggerConfig,
  ILogger,
  LogContext,
  LogEntry,
  Logger,
  LoggerOptions,
  LogLevel,
  LogTransport,
  NamespaceRateLimits,
  PerformanceMetrics,
  RateLimitOptions,
  RateLimitStats,
  RuntimeEnvironment,
  RuntimeInfo,
  SerializedError,
  Timer,
} from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(loggerApi).sort();

    // SEALED: intentional public runtime API surface — the v0.3-aligned
    // @nextrush/log survivors the middleware adds value to, plus the
    // NextRush-specific middleware/helpers.
    const expectedRuntime = [
      // Re-exported from @nextrush/log (v0.3 surface)
      'addGlobalTransport',
      'configure',
      'createBatchTransport',
      'createContextMiddleware',
      'createFilteredTransport',
      'createLogger',
      'createRateLimitedTransport',
      'disableLogging',
      'getAsyncContext',
      'log',
      'runWithContext',

      // NextRush-specific
      'logger',
      'attachLogger',
      'hasLogger',
      'getLogger',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(typeof log).toBe('object');
    expect(typeof createLogger).toBe('function');
    expect(typeof configure).toBe('function');
  });

  it('locks re-exports against the installed @nextrush/log surface (link guard)', () => {
    // Every symbol re-exported by the middleware barrel from @nextrush/log must
    // actually exist on the installed dependency. A future @nextrush/log
    // breaking change fails HERE, at test time — not as a cold build failure.
    const reexportedFromLog = [
      'addGlobalTransport',
      'configure',
      'createBatchTransport',
      'createContextMiddleware',
      'createFilteredTransport',
      'createLogger',
      'createRateLimitedTransport',
      'disableLogging',
      'getAsyncContext',
      'log',
      'runWithContext',
    ];
    for (const symbol of reexportedFromLog) {
      expect(symbol in logApi, `@nextrush/log no longer exports "${symbol}"`).toBe(true);
    }
  });
});

describe('Public API surface (type-only exports)', () => {
  it('the type-only surface stays importable from the barrel', () => {
    // Compile-time only: removing/renaming any of these in src/index.ts fails
    // this file to type-check.
    type Surface = [
      LoggerContext,
      LoggerMiddlewareOptions,
      AsyncLogContext,
      BatchTransport,
      BatchTransportOptions,
      GlobalLoggerConfig,
      ILogger,
      LogContext,
      LogEntry,
      LoggerOptions,
      LogLevel,
      LogTransport,
      NamespaceRateLimits,
      PerformanceMetrics,
      RateLimitOptions,
      RateLimitStats,
      RuntimeEnvironment,
      RuntimeInfo,
      SerializedError,
      Timer,
    ];
    expectTypeOf<Surface>().not.toBeNever();
  });
});
