import { ParsedRequest } from '../http/request/types';
import { EnhancedResponse } from '../http/response/types';
import { HttpMethod } from '../types/http';
import { Path } from '../types/routing';

export type RouteHandler = (
  req: ParsedRequest,
  res: EnhancedResponse
) => void | Promise<void>;

export interface Route {
  method: HttpMethod;
  path: Path;
  handler: RouteHandler;
}

export interface RouteMatchResult {
  route: Route;
  params: Record<string, string>;
}

export interface RouterConfig {
  caseSensitive?: boolean;
  mergeParams?: boolean;
  strict?: boolean;
}

export interface RouteManagerConfig {
  maxRoutes?: number;
}
