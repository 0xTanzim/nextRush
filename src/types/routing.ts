/**
 * Routing-related type definitions
 */
import { HttpMethod, RequestContext } from './http';

export type Path = string | RegExp;

// Re-export HttpMethod and RequestContext for convenience
export { type HttpMethod, type RequestContext };

export interface RouteHandler {
  (context: RequestContext): Promise<void> | void;
}

export interface MiddlewareHandler {
  (context: RequestContext, next: () => Promise<void>): Promise<void> | void;
}

export interface RouterOptions {
  caseSensitive?: boolean;
  strict?: boolean;
  mergeParams?: boolean;
  // Performance optimization options
  useOptimizedMatcher?: boolean;
  enableCaching?: boolean;
  cacheSize?: number;
  enablePrefixOptimization?: boolean;
  enableMetrics?: boolean;
}

export interface Route {
  id: string;
  path: Path;
  method: HttpMethod;
  handler: RouteHandler;
  middleware?: MiddlewareHandler[];
  metadata?: Record<string, any>;
}

export interface RouteMatch {
  route: Route;
  params: Record<string, string>;
}

export interface RouteMatcher {
  match(path: string, routePath: Path): RouteMatch | null;
}

export interface RouteBuilder {
  method(method: HttpMethod): RouteBuilder;
  path(path: Path): RouteBuilder;
  handler(handler: RouteHandler): RouteBuilder;
  middleware(...middleware: MiddlewareHandler[]): RouteBuilder;
  build(): Route;
}
