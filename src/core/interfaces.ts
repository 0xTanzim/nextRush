import { ParsedRequest, RequestHandlerConfig } from '../http/request/types';
import { EnhancedResponse, ResponseConfig } from '../http/response/types';
import { Middleware, MiddlewareHandler } from '../middleware/types';
import { Route, RouteHandler, RouteMatchResult } from '../routing/types';
import { HttpMethod, Path } from '../shared/types';

// Core interfaces for dependency injection and testing

export interface IRequestHandler {
  handle(req: any): ParsedRequest;
  configure(config: RequestHandlerConfig): void;
}

export interface IResponseHandler {
  enhance(res: any): EnhancedResponse;
  configure(config: ResponseConfig): void;
}

export interface IRouteMatcher {
  match(request: ParsedRequest, routes: Route[]): RouteMatchResult | null;
  extractParams(routePath: string, requestPath: string): Record<string, string>;
}

export interface IRouteManager {
  addRoute(method: HttpMethod, path: Path, handler: RouteHandler): void;
  removeRoute(method: HttpMethod, path: Path): boolean;
  getRoutes(): Route[];
  findRoute(request: ParsedRequest): RouteMatchResult | null;
  clear(): void;
}

export interface IRouter {
  get(path: Path, handler: RouteHandler): IRouter;
  post(path: Path, handler: RouteHandler): IRouter;
  put(path: Path, handler: RouteHandler): IRouter;
  delete(path: Path, handler: RouteHandler): IRouter;
  patch(path: Path, handler: RouteHandler): IRouter;
  options(path: Path, handler: RouteHandler): IRouter;
  head(path: Path, handler: RouteHandler): IRouter;
  use(handler: MiddlewareHandler): IRouter;
  use(path: Path, handler: MiddlewareHandler): IRouter;
  use(path: Path, router: IRouter): IRouter;
  getRoutes(basePath?: string): Route[];
}

export interface IMiddlewareManager {
  add(middleware: Middleware): void;
  execute(req: ParsedRequest, res: EnhancedResponse): Promise<void>;
  clear(): void;
}

export interface IErrorHandler {
  handle(error: Error, req: ParsedRequest, res: EnhancedResponse): void;
  configure(config: any): void;
}

export interface IApplication {
  use(handler: MiddlewareHandler): IApplication;
  use(path: Path, handler: MiddlewareHandler): IApplication;
  use(path: Path, router: IRouter): IApplication;
  get(path: Path, handler: RouteHandler): IApplication;
  post(path: Path, handler: RouteHandler): IApplication;
  put(path: Path, handler: RouteHandler): IApplication;
  delete(path: Path, handler: RouteHandler): IApplication;
  patch(path: Path, handler: RouteHandler): IApplication;
  options(path: Path, handler: RouteHandler): IApplication;
  head(path: Path, handler: RouteHandler): IApplication;
  listen(port: number, callback?: () => void): void;
  close(callback?: () => void): void;
}
