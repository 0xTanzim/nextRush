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

export interface ErrorHandlerConfig {
  includeStack?: boolean;
  logErrors?: boolean;
  customHandler?: (
    error: Error,
    req: EnhancedRequest,
    res: EnhancedResponse
  ) => void;
}

export class NextRushError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'NextRushError';
  }
}
