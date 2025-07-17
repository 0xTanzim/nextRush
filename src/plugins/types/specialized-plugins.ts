/**
 * 🧩 Specialized Plugin Interfaces - Enterprise Plugin Categories
 * Defines specific contracts for different types of plugins
 */

import { Plugin, BasePlugin } from '../core/plugin.interface';
import { NextRushResponse, ExpressHandler as Handler } from '../../types/express';
import { WebSocketHandler } from '../../types/websocket';

/**
 * Route definition for router plugins
 */
export interface RouteDefinition {
  readonly method: string;
  readonly path: string;
  readonly handlers: Handler[];
  readonly middleware: Handler[];
  readonly options: RouteOptions;
}

/**
 * Route options
 */
export interface RouteOptions {
  caseSensitive?: boolean;
  strict?: boolean;
  end?: boolean;
  mergeParams?: boolean;
}

/**
 * Router Plugin Interface
 * Plugins that provide routing capabilities
 */
export interface RouterPlugin extends Plugin {
  /**
   * Add a route to the router
   */
  addRoute(definition: RouteDefinition): void;

  /**
   * Remove a route from the router
   */
  removeRoute(method: string, path: string): boolean;

  /**
   * Get all registered routes
   */
  getRoutes(): RouteDefinition[];

  /**
   * Find matching route for request
   */
  findRoute(method: string, path: string): RouteMatch | null;
}

/**
 * Route match result
 */
export interface RouteMatch {
  route: RouteDefinition;
  params: Record<string, string>;
}

/**
 * Middleware Plugin Interface
 * Plugins that provide middleware functionality
 */
export interface MiddlewarePlugin extends Plugin {
  /**
   * Get middleware function
   */
  getMiddleware(): Handler;

  /**
   * Configure middleware options
   */
  configure(options: Record<string, unknown>): void;
}

/**
 * WebSocket Plugin Interface
 * Plugins that provide WebSocket functionality
 */
export interface WebSocketPlugin extends Plugin {
  /**
   * Add WebSocket route
   */
  addRoute(path: string, handler: WebSocketHandler): void;

  /**
   * Remove WebSocket route
   */
  removeRoute(path: string): boolean;

  /**
   * Get all WebSocket routes
   */
  getRoutes(): WebSocketRouteDefinition[];
}

/**
 * WebSocket route definition
 */
export interface WebSocketRouteDefinition {
  readonly path: string;
  readonly handler: WebSocketHandler;
}

/**
 * Static Files Plugin Interface
 * Plugins that serve static files
 */
export interface StaticFilesPlugin extends Plugin {
  /**
   * Add static file mount
   */
  addMount(mountPath: string, rootPath: string, options?: StaticMountOptions): void;

  /**
   * Remove static file mount
   */
  removeMount(mountPath: string): boolean;

  /**
   * Get all static mounts
   */
  getMounts(): StaticMountDefinition[];
}

/**
 * Static mount definition
 */
export interface StaticMountDefinition {
  readonly mountPath: string;
  readonly rootPath: string;
  readonly options: StaticMountOptions;
}

/**
 * Static mount options
 */
export interface StaticMountOptions {
  dotfiles?: 'allow' | 'deny' | 'ignore';
  etag?: boolean;
  extensions?: string[];
  fallthrough?: boolean;
  immutable?: boolean;
  index?: boolean | string | string[];
  lastModified?: boolean;
  maxAge?: number | string;
  redirect?: boolean;
  setHeaders?: (res: NextRushResponse, path: string, stat: unknown) => void;
  spa?: boolean;
}

/**
 * Template Engine Plugin Interface
 * Plugins that provide template rendering
 */
export interface TemplatePlugin extends Plugin {
  /**
   * Set views directory
   */
  setViews(path: string, options?: TemplateEngineOptions): void;

  /**
   * Render template
   */
  render(template: string, data?: Record<string, unknown>): Promise<string>;

  /**
   * Register template helper
   */
  registerHelper(name: string, helper: TemplateHelper): void;

  /**
   * Register partial template
   */
  registerPartial(name: string, template: string): void;
}

/**
 * Template engine options
 */
export interface TemplateEngineOptions {
  engine?: string;
  extension?: string;
  cache?: boolean;
  helpers?: Record<string, TemplateHelper>;
  partials?: Record<string, string>;
}

/**
 * Template helper function
 */
export type TemplateHelper = (...args: unknown[]) => string;

/**
 * Base Router Plugin Implementation
 */
export abstract class BaseRouterPlugin extends BasePlugin implements RouterPlugin {
  protected routes = new Map<string, RouteDefinition>();

  public addRoute(definition: RouteDefinition): void {
    const key = `${definition.method.toUpperCase()}:${definition.path}`;
    this.routes.set(key, definition);
    this.getContext().logger.debug(`Route added: ${key}`);
  }

  public removeRoute(method: string, path: string): boolean {
    const key = `${method.toUpperCase()}:${path}`;
    const removed = this.routes.delete(key);
    if (removed) {
      this.getContext().logger.debug(`Route removed: ${key}`);
    }
    return removed;
  }

  public getRoutes(): RouteDefinition[] {
    return Array.from(this.routes.values());
  }

  public abstract findRoute(method: string, path: string): RouteMatch | null;
}

/**
 * Base Middleware Plugin Implementation
 */
export abstract class BaseMiddlewarePlugin extends BasePlugin implements MiddlewarePlugin {
  protected options: Record<string, unknown> = {};

  public configure(options: Record<string, unknown>): void {
    this.options = { ...this.options, ...options };
    this.getContext().logger.debug(`Middleware configured with options:`, options);
  }

  public abstract getMiddleware(): Handler;
}

/**
 * Base WebSocket Plugin Implementation
 */
export abstract class BaseWebSocketPlugin extends BasePlugin implements WebSocketPlugin {
  protected routes = new Map<string, WebSocketRouteDefinition>();

  public addRoute(path: string, handler: WebSocketHandler): void {
    const definition: WebSocketRouteDefinition = { path, handler };
    this.routes.set(path, definition);
    this.getContext().logger.debug(`WebSocket route added: ${path}`);
  }

  public removeRoute(path: string): boolean {
    const removed = this.routes.delete(path);
    if (removed) {
      this.getContext().logger.debug(`WebSocket route removed: ${path}`);
    }
    return removed;
  }

  public getRoutes(): WebSocketRouteDefinition[] {
    return Array.from(this.routes.values());
  }
}

/**
 * Base Static Files Plugin Implementation
 */
export abstract class BaseStaticFilesPlugin extends BasePlugin implements StaticFilesPlugin {
  protected mounts = new Map<string, StaticMountDefinition>();

  public addMount(mountPath: string, rootPath: string, options: StaticMountOptions = {}): void {
    const definition: StaticMountDefinition = { mountPath, rootPath, options };
    this.mounts.set(mountPath, definition);
    this.getContext().logger.debug(`Static mount added: ${mountPath} -> ${rootPath}`);
  }

  public removeMount(mountPath: string): boolean {
    const removed = this.mounts.delete(mountPath);
    if (removed) {
      this.getContext().logger.debug(`Static mount removed: ${mountPath}`);
    }
    return removed;
  }

  public getMounts(): StaticMountDefinition[] {
    return Array.from(this.mounts.values());
  }
}

/**
 * Base Template Plugin Implementation
 */
export abstract class BaseTemplatePlugin extends BasePlugin implements TemplatePlugin {
  protected viewsPath?: string | undefined;
  protected options: TemplateEngineOptions = {};
  protected helpers = new Map<string, TemplateHelper>();
  protected partials = new Map<string, string>();

  public setViews(path: string, options: TemplateEngineOptions = {}): void {
    this.viewsPath = path;
    this.options = { ...this.options, ...options };
    
    // Register provided helpers and partials
    if (options.helpers) {
      Object.entries(options.helpers).forEach(([name, helper]) => {
        this.registerHelper(name, helper);
      });
    }
    
    if (options.partials) {
      Object.entries(options.partials).forEach(([name, template]) => {
        this.registerPartial(name, template);
      });
    }

    this.getContext().logger.debug(`Views directory set to: ${path}`);
  }

  public registerHelper(name: string, helper: TemplateHelper): void {
    this.helpers.set(name, helper);
    this.getContext().logger.debug(`Template helper registered: ${name}`);
  }

  public registerPartial(name: string, template: string): void {
    this.partials.set(name, template);
    this.getContext().logger.debug(`Template partial registered: ${name}`);
  }

  public abstract render(template: string, data?: Record<string, unknown>): Promise<string>;
}
