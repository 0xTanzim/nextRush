import { ParsedRequest } from '../http/request/types';
import { EnhancedResponse } from '../http/response/types';
import { Path } from '../shared/types';

export type MiddlewareHandler = (
  req: ParsedRequest,
  res: EnhancedResponse,
  next?: () => void
) => void | Promise<void>;

export interface Middleware {
  handler: MiddlewareHandler;
  path?: Path;
  order?: number;
}

export interface MiddlewareConfig {
  timeout?: number;
  errorHandler?: (
    error: Error,
    req: ParsedRequest,
    res: EnhancedResponse
  ) => void;
}
