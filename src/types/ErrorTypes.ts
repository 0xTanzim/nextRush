export interface ErrorResponse {
  error: {
    message: string;
    code: string;
    statusCode: number;
    timestamp: string;
    path: string;
    method: string;
    details?: Record<string, unknown>;
    stack?: string;
  };
}

export interface ErrorHandlerOptions {
  includeStack?: boolean;
  maxBodySize?: number;
  timeout?: number;
  logErrors?: boolean;
}
