/**
 * Core interfaces for NextRush framework
 * Based on old codebase patterns but modernized for new architecture
 */

import { WebSocketHandler } from '../types/websocket';
import { NextRushRequest, NextRushResponse } from '../types/express';
import { Path } from '../types/routing';
import { RequestContext } from '../types/http';

// Handler types to match comprehensive overloads
export type RouteHandler = (context: RequestContext) => void | Promise<void>;
export type ExpressHandler = (req: NextRushRequest, res: NextRushResponse) => void | Promise<void>;
export type MiddlewareHandler = (context: RequestContext, next: () => void) => void | Promise<void>;
export type ExpressMiddleware = (req: NextRushRequest, res: NextRushResponse, next: () => void) => void | Promise<void>;

/**
 * Minimal Application interface - defines core methods that components need
 */
export interface MinimalApplication {
  // HTTP GET method overloads
  get(path: Path, handler: ExpressHandler): MinimalApplication;
  get(path: Path, handler: RouteHandler): MinimalApplication;
  get(path: Path, middleware: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  get(path: Path, middleware: MiddlewareHandler, handler: RouteHandler): MinimalApplication;
  get(path: Path, middleware1: ExpressMiddleware, middleware2: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  get(path: Path, middleware1: ExpressMiddleware, middleware2: ExpressMiddleware, middleware3: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  get(path: Path, ...args: (RouteHandler | ExpressHandler | MiddlewareHandler | ExpressMiddleware)[]): MinimalApplication;
  
  // HTTP POST method overloads
  post(path: Path, handler: ExpressHandler): MinimalApplication;
  post(path: Path, handler: RouteHandler): MinimalApplication;
  post(path: Path, middleware: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  post(path: Path, middleware: MiddlewareHandler, handler: RouteHandler): MinimalApplication;
  post(path: Path, middleware1: ExpressMiddleware, middleware2: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  post(path: Path, middleware1: ExpressMiddleware, middleware2: ExpressMiddleware, middleware3: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  post(path: Path, ...args: (RouteHandler | ExpressHandler | MiddlewareHandler | ExpressMiddleware)[]): MinimalApplication;
  
  // HTTP PUT method overloads
  put(path: Path, handler: ExpressHandler): MinimalApplication;
  put(path: Path, handler: RouteHandler): MinimalApplication;
  put(path: Path, middleware: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  put(path: Path, middleware: MiddlewareHandler, handler: RouteHandler): MinimalApplication;
  put(path: Path, middleware1: ExpressMiddleware, middleware2: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  put(path: Path, middleware1: ExpressMiddleware, middleware2: ExpressMiddleware, middleware3: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  put(path: Path, ...args: (RouteHandler | ExpressHandler | MiddlewareHandler | ExpressMiddleware)[]): MinimalApplication;
  
  // HTTP DELETE method overloads
  delete(path: Path, handler: ExpressHandler): MinimalApplication;
  delete(path: Path, handler: RouteHandler): MinimalApplication;
  delete(path: Path, middleware: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  delete(path: Path, middleware: MiddlewareHandler, handler: RouteHandler): MinimalApplication;
  delete(path: Path, middleware1: ExpressMiddleware, middleware2: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  delete(path: Path, middleware1: ExpressMiddleware, middleware2: ExpressMiddleware, middleware3: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  delete(path: Path, ...args: (RouteHandler | ExpressHandler | MiddlewareHandler | ExpressMiddleware)[]): MinimalApplication;
  
  // HTTP PATCH method overloads
  patch(path: Path, handler: ExpressHandler): MinimalApplication;
  patch(path: Path, handler: RouteHandler): MinimalApplication;
  patch(path: Path, middleware: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  patch(path: Path, middleware: MiddlewareHandler, handler: RouteHandler): MinimalApplication;
  patch(path: Path, middleware1: ExpressMiddleware, middleware2: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  patch(path: Path, middleware1: ExpressMiddleware, middleware2: ExpressMiddleware, middleware3: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  patch(path: Path, ...args: (RouteHandler | ExpressHandler | MiddlewareHandler | ExpressMiddleware)[]): MinimalApplication;
  
  // HTTP HEAD method overloads
  head(path: Path, handler: ExpressHandler): MinimalApplication;
  head(path: Path, handler: RouteHandler): MinimalApplication;
  head(path: Path, middleware: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  head(path: Path, middleware: MiddlewareHandler, handler: RouteHandler): MinimalApplication;
  head(path: Path, middleware1: ExpressMiddleware, middleware2: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  head(path: Path, middleware1: ExpressMiddleware, middleware2: ExpressMiddleware, middleware3: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  head(path: Path, ...args: (RouteHandler | ExpressHandler | MiddlewareHandler | ExpressMiddleware)[]): MinimalApplication;
  
  // HTTP OPTIONS method overloads
  options(path: Path, handler: ExpressHandler): MinimalApplication;
  options(path: Path, handler: RouteHandler): MinimalApplication;
  options(path: Path, middleware: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  options(path: Path, middleware: MiddlewareHandler, handler: RouteHandler): MinimalApplication;
  options(path: Path, middleware1: ExpressMiddleware, middleware2: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  options(path: Path, middleware1: ExpressMiddleware, middleware2: ExpressMiddleware, middleware3: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  options(path: Path, ...args: (RouteHandler | ExpressHandler | MiddlewareHandler | ExpressMiddleware)[]): MinimalApplication;
  
  // HTTP ALL method overloads
  all(path: Path, handler: ExpressHandler): MinimalApplication;
  all(path: Path, handler: RouteHandler): MinimalApplication;
  all(path: Path, middleware: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  all(path: Path, middleware: MiddlewareHandler, handler: RouteHandler): MinimalApplication;
  all(path: Path, middleware1: ExpressMiddleware, middleware2: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  all(path: Path, middleware1: ExpressMiddleware, middleware2: ExpressMiddleware, middleware3: ExpressMiddleware, handler: ExpressHandler): MinimalApplication;
  all(path: Path, ...args: (RouteHandler | ExpressHandler | MiddlewareHandler | ExpressMiddleware)[]): MinimalApplication;
  
  // Middleware
  use(...args: any[]): MinimalApplication;
  
  // Static files
  static(path: string, root?: string): MinimalApplication;
  
  // Template engine
  setViews: (path: string) => MinimalApplication;
  render: (...args: any[]) => MinimalApplication;
  
  // WebSocket
  ws: (path: string, handler: WebSocketHandler) => MinimalApplication;
  
  // Server control
  listen(port: number | string, hostname?: string | (() => void), callback?: () => void): MinimalApplication;
  close: (callback?: () => void) => MinimalApplication;
}

/**
 * Component lifecycle interface
 */
export interface Lifecycle {
  /**
   * Called when component is installed into application
   */
  install?(app: MinimalApplication): void | Promise<void>;
  
  /**
   * Called when component is uninstalled from application
   */
  uninstall?(app: MinimalApplication): void | Promise<void>;
  
  /**
   * Called when application starts
   */
  start?(): void | Promise<void>;
  
  /**
   * Called when application stops
   */
  stop?(): void | Promise<void>;
}

/**
 * Internal plugin interface for component system
 */
export interface InternalPlugin extends Lifecycle {
  readonly name: string;
  readonly version?: string;
  readonly dependencies?: string[];
}

/**
 * Plugin interface for the plugin system
 */
export interface Plugin {
  id: string;
  name: string;
  version: string;
  component: InternalPlugin;
  dependencies: string[];
  enabled: boolean;
}

/**
 * Plugin configuration options
 */
export interface PluginOptions {
  enabled?: boolean;
  priority?: number;
  config?: Record<string, any>;
  enabledPlugins?: string[];
}

/**
 * Plugin metadata for registration
 */
export interface PluginMetadata {
  name: string;
  version: string;
  author?: string;
  description?: string;
  homepage?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
}

/**
 * Plugin validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Component registry interface
 */
export interface ComponentRegistry {
  register(plugin: InternalPlugin, options?: PluginOptions): void;
  unregister(name: string): boolean;
  get(name: string): InternalPlugin | undefined;
  getAll(): InternalPlugin[];
  isRegistered(name: string): boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Plugin registry interface
 */
export interface IPluginRegistry {
  register(plugin: InternalPlugin, options?: PluginOptions): void;
  unregister(name: string): Promise<boolean>;
  get(name: string): InternalPlugin | undefined;
  getAll(): InternalPlugin[];
  isRegistered(name: string): boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  enable(name: string): void;
  disable(name: string): void;
  setApp(app: MinimalApplication): void;
}

/**
 * Component error interface
 */
export interface ComponentError extends Error {
  component: string;
  phase: 'install' | 'start' | 'stop';
  originalError?: Error;
}

/**
 * Event emitter interface for components
 */
export interface EventEmitter {
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}

/**
 * Logger interface for components
 */
export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Component context interface
 */
export interface ComponentContext {
  app: MinimalApplication;
  logger: Logger;
  events: EventEmitter;
  config: Record<string, any>;
}