/**
 * @nextrush/logger - Public API surface test
 *
 * Locks the exported symbol set from `src/index.ts`. If this test fails, the
 * public API has changed. Intentional changes require an explicit update to
 * the expected list below, plus a changeset for a published package.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as loggerApi from '../index';
import { DEFAULT_SENSITIVE_KEYS, LOG_LEVEL_PRIORITY, LOG_LEVELS, Logger } from '../index';
import type { LoggerContext, LoggerMiddlewareOptions } from '../index';
import type {
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
} from '../index';

describe('Public API surface (runtime exports)', () => {
  it('exports exactly the intended runtime symbols', () => {
    const actualExports = Object.keys(loggerApi).sort();

    // SEALED: intentional public runtime API surface — re-exports everything
    // from @nextrush/log plus NextRush-specific middleware/helpers.
    const expectedRuntime = [
      // Re-exported from @nextrush/log
      'addGlobalTransport',
      'clearGlobalTransports',
      'compareLevels',
      'configure',
      'configureFromEnv',
      'containsSensitivePattern',
      'createBatchTransport',
      'createConsoleTransport',
      'createContextMiddleware',
      'createFilteredTransport',
      'createLogger',
      'createNamespaceRateLimitedTransport',
      'createPredicateTransport',
      'createRateLimitedTransport',
      'DEFAULT_SENSITIVE_KEYS',
      'defaultLogger',
      'detectRuntime',
      'disableLogging',
      'disableNamespaces',
      'enableLogging',
      'enableNamespaces',
      'formatJSON',
      'formatPrettyJSON',
      'formatPrettyTerminal',
      'formatPrettyTimestamp',
      'formatTimestamp',
      'getAsyncContext',
      'getContextCorrelationId',
      'getContextMetadata',
      'getEnvVar',
      'getGlobalConfig',
      'getProcessId',
      'getRuntime',
      'getTime',
      'isAsyncContextAvailable',
      'isError',
      'isNamespaceEnabled',
      'isProductionBuild',
      'isValidLogLevel',
      'log',
      'LOG_LEVEL_PRIORITY',
      'LOG_LEVELS',
      'Logger',
      'mergeSensitiveKeys',
      'onConfigChange',
      'parseLogLevel',
      'redactSensitiveValues',
      'resetGlobalConfig',
      'runWithContext',
      'safeSerialize',
      'sanitizeContext',
      'scopedLogger',
      'serializeError',
      'setGlobalLevel',
      'shouldLog',
      'shouldRedact',

      // NextRush-specific
      'logger',
      'attachLogger',
      'hasLogger',
      'getLogger',
    ].sort();

    expect(actualExports).toEqual(expectedRuntime);
    expect(typeof DEFAULT_SENSITIVE_KEYS === 'object').toBe(true);
    expect(typeof LOG_LEVEL_PRIORITY).toBe('object');
    expect(typeof LOG_LEVELS).toBe('object');
    expect(typeof Logger).toBe('function');
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
