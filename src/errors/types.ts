/**
 * 🔥 Error Types and Interfaces - Legacy Compatibility
 * This file provides backward compatibility for existing error types
 */
import { EnhancedRequest } from '../core/enhancers/request-enhancer';
import { EnhancedResponse } from '../core/enhancers/response-enhancer';

export interface ErrorContext {
  message: string;
  code: string;
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  details?: Record<string, unknown>;
  stack?: string;
}

export interface LegacyErrorHandlerConfig {
  includeStack?: boolean;
  logErrors?: boolean;
  customHandler?: (
    error: Error,
    req: EnhancedRequest,
    res: EnhancedResponse
  ) => void;
}

// Legacy NextRushError for backward compatibility - DO NOT USE FOR NEW CODE
// Use the one in custom-errors.ts instead
export class LegacyNextRushError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'LegacyNextRushError';
  }
}
