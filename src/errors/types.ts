import { ParsedRequest } from '../http/request/types';
import { EnhancedResponse } from '../http/response/types';

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
    req: ParsedRequest,
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
