import { ExpressHandler, ExpressMiddleware } from '../../types/express';
import { MiddlewareHandler, Path, RouteHandler } from '../../types/routing';

/**
 * 🔌 Plugin System Types
 */
export interface Plugin {
  id: string;
  name: string;
  version: string;
  component: any;
  dependencies: string[];
  enabled: boolean;
}

export interface PluginOptions {
  enabledPlugins?: string[];
}

/**
 * 🚀 NextRush Component Architecture Interfaces
 *
 * Clean, type-safe interfaces for the plugin-based architecture
 */

/**
 * Minimal Application Interface - Core methods that plugins install
 * Provides full type inference for all HTTP methods and middleware
 */
export interface MinimalApplication {
  // HTTP Methods (installed by HttpMethodsPlugin)
  get(path: Path, handler: RouteHandler): MinimalApplication;
  get(path: Path, handler: ExpressHandler): MinimalApplication;
  get(
    path: Path,
    middleware: MiddlewareHandler,
    handler: RouteHandler
  ): MinimalApplication;
  get(
    path: Path,
    middleware: ExpressMiddleware,
    handler: ExpressHandler
  ): MinimalApplication;
  get(
    path: Path,
    ...handlers: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): MinimalApplication;

  post(path: Path, handler: RouteHandler): MinimalApplication;
  post(path: Path, handler: ExpressHandler): MinimalApplication;
  post(
    path: Path,
    middleware: MiddlewareHandler,
    handler: RouteHandler
  ): MinimalApplication;
  post(
    path: Path,
    middleware: ExpressMiddleware,
    handler: ExpressHandler
  ): MinimalApplication;
  post(
    path: Path,
    ...handlers: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): MinimalApplication;

  put(path: Path, handler: RouteHandler): MinimalApplication;
  put(path: Path, handler: ExpressHandler): MinimalApplication;
  put(
    path: Path,
    middleware: MiddlewareHandler,
    handler: RouteHandler
  ): MinimalApplication;
  put(
    path: Path,
    middleware: ExpressMiddleware,
    handler: ExpressHandler
  ): MinimalApplication;
  put(
    path: Path,
    ...handlers: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): MinimalApplication;

  delete(path: Path, handler: RouteHandler): MinimalApplication;
  delete(path: Path, handler: ExpressHandler): MinimalApplication;
  delete(
    path: Path,
    middleware: MiddlewareHandler,
    handler: RouteHandler
  ): MinimalApplication;
  delete(
    path: Path,
    middleware: ExpressMiddleware,
    handler: ExpressHandler
  ): MinimalApplication;
  delete(
    path: Path,
    ...handlers: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): MinimalApplication;

  patch(path: Path, handler: RouteHandler): MinimalApplication;
  patch(path: Path, handler: ExpressHandler): MinimalApplication;
  patch(
    path: Path,
    middleware: MiddlewareHandler,
    handler: RouteHandler
  ): MinimalApplication;
  patch(
    path: Path,
    middleware: ExpressMiddleware,
    handler: ExpressHandler
  ): MinimalApplication;
  patch(
    path: Path,
    ...handlers: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): MinimalApplication;

  head(path: Path, handler: RouteHandler): MinimalApplication;
  head(path: Path, handler: ExpressHandler): MinimalApplication;
  head(
    path: Path,
    middleware: MiddlewareHandler,
    handler: RouteHandler
  ): MinimalApplication;
  head(
    path: Path,
    middleware: ExpressMiddleware,
    handler: ExpressHandler
  ): MinimalApplication;
  head(
    path: Path,
    ...handlers: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): MinimalApplication;

  options(path: Path, handler: RouteHandler): MinimalApplication;
  options(path: Path, handler: ExpressHandler): MinimalApplication;
  options(
    path: Path,
    middleware: MiddlewareHandler,
    handler: RouteHandler
  ): MinimalApplication;
  options(
    path: Path,
    middleware: ExpressMiddleware,
    handler: ExpressHandler
  ): MinimalApplication;
  options(
    path: Path,
    ...handlers: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): MinimalApplication;

  all(path: Path, handler: RouteHandler): MinimalApplication;
  all(path: Path, handler: ExpressHandler): MinimalApplication;
  all(
    path: Path,
    middleware: MiddlewareHandler,
    handler: RouteHandler
  ): MinimalApplication;
  all(
    path: Path,
    middleware: ExpressMiddleware,
    handler: ExpressHandler
  ): MinimalApplication;
  all(
    path: Path,
    ...handlers: (
      | RouteHandler
      | ExpressHandler
      | MiddlewareHandler
      | ExpressMiddleware
    )[]
  ): MinimalApplication;

  // Middleware (installed by MiddlewarePlugin)
  use(handler: MiddlewareHandler): MinimalApplication;
  use(handler: ExpressMiddleware): MinimalApplication;
  use(path: Path, handler: MiddlewareHandler): MinimalApplication;
  use(path: Path, handler: ExpressMiddleware): MinimalApplication;
  use(
    pathOrHandler: Path | MiddlewareHandler | ExpressMiddleware,
    handler?: MiddlewareHandler | ExpressMiddleware
  ): MinimalApplication;

  // Static Files (installed by StaticFilesPlugin)
  static?(staticPath: string, options?: any): MinimalApplication;
  serveStatic?(staticPath: string, options?: any): MinimalApplication;

  // Template Engine (installed by TemplateEnginePlugin)
  render?(view: string, data?: any): Promise<string>;
  setTemplateEngine?(engine: any): MinimalApplication;
  setViews?(viewsPath: string): MinimalApplication;

  // Built-in Middleware (installed by BuiltInMiddlewarePlugin)
  json?(options?: any): MiddlewareHandler;
  urlencoded?(options?: any): MiddlewareHandler;
  raw?(options?: any): MiddlewareHandler;
  text?(options?: any): MiddlewareHandler;
  cors?(options?: any): MiddlewareHandler;
  helmet?(options?: any): MiddlewareHandler;

  // WebSocket (installed by WebSocketPlugin)
  ws?(path: string, handler: any): MinimalApplication;
  websocket?(path: string, handler: any): MinimalApplication;
  enableWebSocket?(options?: any): MinimalApplication;

  // Core Application Methods
  listen(port: number, hostname?: string, callback?: () => void): Promise<void>;
  close(): Promise<void>;

  // Plugin Registry Access
  getPluginRegistry?(): any;
  registerPlugin?(plugin: any): Promise<void>;
  unregisterPlugin?(name: string): Promise<void>;
}

/**
 * Component lifecycle interface
 */
export interface Lifecycle {
  readonly name: string;
  install(app: MinimalApplication): void | Promise<void>;
  start?(): void | Promise<void>;
  stop?(): void | Promise<void>;
}

/**
 * Internal plugin interface
 */
export interface InternalPlugin extends Lifecycle {
  uninstall?(app: MinimalApplication): void | Promise<void>;
}

/**
 * Route creation interface for Express-style routing
 */
export interface RouteCreator {
  createRoute(method: string, path: string, handlers: any[]): any;
}

/**
 * Plugin registry interface
 */
export interface IPluginRegistry {
  register(plugin: InternalPlugin): void;
  unregister(name: string): Promise<void>;
  get(name: string): InternalPlugin | undefined;
  list(): InternalPlugin[];
  initialize(app: MinimalApplication): void;
  installAll(): Promise<void>;
  startAll(): Promise<void>;
  stopAll(): Promise<void>;
}

export default MinimalApplication;
