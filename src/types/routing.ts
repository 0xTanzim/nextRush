/**
 * Routing-related type definitions
 */
import { HttpMethod, RequestContext } from './http';

export type Path = string | RegExp;

// Re-export HttpMethod for convenience
export { type HttpMethod };

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
}

export interface Route {
  id: string;
  path: Path;
  method: HttpMethod;
  handler: RouteHandler;
  middleware?: MiddlewareHandler[];
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
