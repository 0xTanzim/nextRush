/**
 * Logger Factory Functions for NextRush v2
 *
 * @packageDocumentation
 */

import { LoggerPlugin } from './logger-core';
import { LogLevel } from './logger-types';

/**
 * Create minimal logger for testing
 */
export function createMinimalLogger(): LoggerPlugin {
  const logger = new LoggerPlugin({
    level: LogLevel.INFO,
    format: 'simple',
    timestamp: false,
    colors: false,
    maxEntries: 100,
    flushInterval: 1000,
    transports: [{ type: 'console' }],
  });

  // Console transport is already added in constructor
  return logger;
}

/**
 * Create development logger
 */
export function createDevLogger(): LoggerPlugin {
  const logger = new LoggerPlugin({
    level: LogLevel.DEBUG,
    format: 'text',
    timestamp: true,
    colors: true,
    maxEntries: 1000,
    flushInterval: 5000,
    transports: [{ type: 'console' }],
  });

  // Console transport is already added in constructor
  return logger;
}

/**
 * Create production logger
 */
export function createProdLogger(): LoggerPlugin {
  const logger = new LoggerPlugin({
    level: LogLevel.INFO,
    format: 'json',
    timestamp: true,
    colors: false,
    maxEntries: 10000,
    flushInterval: 10000,
    transports: [
      { type: 'console' },
      { type: 'file', options: { path: 'logs/app.log' } },
    ],
  });

  // Console transport is already added in constructor
  return logger;
}

/**
 * Create test logger
 */
export function createTestLogger(): LoggerPlugin {
  const logger = new LoggerPlugin({
    level: LogLevel.ERROR,
    format: 'simple',
    timestamp: false,
    colors: false,
    maxEntries: 10,
    flushInterval: 100,
    transports: [{ type: 'console' }],
  });

  // Console transport is already added in constructor
  return logger;
}
