/**
 * Error module exports
 */

export * from './custom-errors';
export * from './error-handler';

// Re-export legacy types for backward compatibility (avoid conflicts)
export type { ErrorContext } from './types';
