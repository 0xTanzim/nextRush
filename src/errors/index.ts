/**
 * 🔥 Optimized Error Module - Complete Error Handling System
 *
 * This module provides enterprise-grade error handling with:
 * - High-performance error classification
 * - Memory-optimized error objects
 * - Smart error recovery mechanisms
 * - Comprehensive error metrics
 * - Production-ready error sanitization
 */

// 🚀 Core Error Classes and Types
export * from './custom-errors';
export * from './error-handler';

// 🚀 Type definitions
export { LegacyNextRushError } from './types';
export type { ErrorContext } from './types';

// 🚀 Error utilities and helpers
export const ErrorUtils = {
  /**
   * Quick error factory
   */
  createError: <T extends Error>(
    ErrorClass: new (...args: any[]) => T,
    ...args: any[]
  ): T => {
    return new ErrorClass(...args);
  },

  /**
   * Check if error is retryable
   */
  isRetryable: (error: Error): boolean => {
    const { NextRushError } = require('./custom-errors');
    return error instanceof NextRushError && (error as any).isRetryable();
  },

  /**
   * Extract error correlation ID
   */
  getCorrelationId: (error: Error): string | undefined => {
    const { NextRushError } = require('./custom-errors');
    return error instanceof NextRushError
      ? (error as any).correlationId
      : undefined;
  },

  /**
   * Get error severity level
   */
  getSeverity: (error: Error): string => {
    const { NextRushError, ErrorSeverity } = require('./custom-errors');
    return error instanceof NextRushError
      ? (error as any).severity
      : ErrorSeverity.HIGH;
  },
};

// 🚀 Error constants for quick access
export const ErrorCodes = {
  // Client errors (4xx)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  CONFLICT: 'CONFLICT',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

  // Server errors (5xx)
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  BAD_GATEWAY: 'BAD_GATEWAY',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',

  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  DATABASE_CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR',

  // File system errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_PERMISSION_ERROR: 'FILE_PERMISSION_ERROR',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  CONNECTION_REFUSED: 'CONNECTION_REFUSED',

  // Plugin errors
  PLUGIN_ERROR: 'PLUGIN_ERROR',
  PLUGIN_NOT_FOUND: 'PLUGIN_NOT_FOUND',
} as const;

// 🚀 Error status code mappings
export const ErrorStatusCodes = {
  [ErrorCodes.VALIDATION_ERROR]: 400,
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.METHOD_NOT_ALLOWED]: 405,
  [ErrorCodes.CONFLICT]: 409,
  [ErrorCodes.REQUEST_TIMEOUT]: 408,
  [ErrorCodes.PAYLOAD_TOO_LARGE]: 413,
  [ErrorCodes.UNSUPPORTED_MEDIA_TYPE]: 415,
  [ErrorCodes.TOO_MANY_REQUESTS]: 429,
  [ErrorCodes.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCodes.NOT_IMPLEMENTED]: 501,
  [ErrorCodes.BAD_GATEWAY]: 502,
  [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
  [ErrorCodes.GATEWAY_TIMEOUT]: 504,
  [ErrorCodes.DATABASE_ERROR]: 500,
  [ErrorCodes.DATABASE_CONNECTION_ERROR]: 503,
  [ErrorCodes.FILE_NOT_FOUND]: 404,
  [ErrorCodes.FILE_PERMISSION_ERROR]: 403,
  [ErrorCodes.NETWORK_ERROR]: 502,
  [ErrorCodes.CONNECTION_REFUSED]: 502,
  [ErrorCodes.PLUGIN_ERROR]: 500,
  [ErrorCodes.PLUGIN_NOT_FOUND]: 404,
} as const;
