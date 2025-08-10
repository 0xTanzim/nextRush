/**
 * HTTP type definitions for NextRush v2
 *
 * @packageDocumentation
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { ParsedUrlQuery } from 'node:querystring';

/**
 * Application configuration options
 */
export interface ApplicationOptions {
  /** Port to listen on (default: 3000) */
  port?: number;
  /** Host to bind to (default: 'localhost') */
  host?: string;
  /** Enable debug mode */
  debug?: boolean;
  /** Trust proxy headers */
  trustProxy?: boolean;
  /** Maximum request body size in bytes */
  maxBodySize?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Enable CORS by default */
  cors?: boolean;
  /** Static files directory */
  static?: string;
  /** Template engine configuration */
  template?: {
    engine: string;
    directory: string;
  };
  /** HTTP keep-alive timeout in milliseconds */
  keepAlive?: number;
}

/**
 * Enhanced request object
 */
export interface NextRushRequest extends IncomingMessage {
  /** Request body */
  body?: unknown;
  /** Route parameters */
  params: Record<string, string>;
  /** Query parameters */
  query: ParsedUrlQuery;
  /** Request path */
  path: string;
  /** Client IP address */
  ip: string;
  /** Request protocol */
  protocol: string;
  /** Whether the request is secure */
  secure: boolean;
  /** Original request URL */
  originalUrl: string;
}

/**
 * Enhanced response object
 */
export interface NextRushResponse extends ServerResponse {
  /** Set response status code */
  status(code: number): NextRushResponse;
  /** Send JSON response */
  json(data: unknown): NextRushResponse;
  /** Send HTML response */
  html(data: string): NextRushResponse;
  /** Send text response */
  text(data: string): NextRushResponse;
  /** Send CSV response */
  csv(data: string): NextRushResponse;
  /** Send XML response */
  xml(data: string): NextRushResponse;
  /** Send file response */
  file(path: string, options?: { root?: string }): NextRushResponse;
  /** Send file response (alias) */
  sendFile(
    path: string,
    options?: { root?: string; etag?: boolean }
  ): NextRushResponse;
  /** Send download response */
  download(path: string, filename?: string): NextRushResponse;
  /** Redirect response */
  redirect(url: string, status?: number): NextRushResponse;
  /** Set response header */
  set(name: string, value: string | number | string[]): NextRushResponse;
  /** Get response header */
  get(name: string): string | number | string[] | undefined;
  /** Remove response header */
  remove(name: string): NextRushResponse;
  /** Set response type */
  type(type: string): NextRushResponse;
  /** Set response length */
  length(length: number): NextRushResponse;
  /** Set response etag */
  etag(etag: string): NextRushResponse;
  /** Set response last modified */
  lastModified(date: Date): NextRushResponse;
}

/**
 * Request handler function
 */
export type RequestHandler = (
  req: NextRushRequest,
  res: NextRushResponse
) => void | Promise<void>;

/**
 * Response handler function
 */
export type ResponseHandler = (
  data: unknown,
  res: NextRushResponse
) => void | Promise<void>;

/**
 * Middleware function (ctx-style)
 * NOTE: In v2, middleware must be (ctx, next). This alias ensures a single canonical type.
 * @deprecated Import Middleware from '@/types/context' instead.
 */
export type Middleware = import('@/types/context').Middleware;

/**
 * WebSocket handler function
 */
export type WebSocketHandler = (
  socket: WebSocket,
  req: NextRushRequest
) => void | Promise<void>;

/**
 * Template engine interface
 */
export interface TemplateEngine {
  /** Render template */
  render(
    template: string,
    data: Record<string, unknown>
  ): string | Promise<string>;
  /** Register template */
  register(name: string, template: string): void;
  /** Get template */
  get(name: string): string | undefined;
}

/**
 * Plugin interface
 */
export interface Plugin {
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Plugin description */
  description?: string;
  /** Install plugin */
  install(app: unknown): void;
  /** Initialize plugin */
  init?(): void | Promise<void>;
  /** Cleanup plugin */
  cleanup?(): void | Promise<void>;
}

/**
 * Plugin options
 */
export interface PluginOptions {
  /** Plugin configuration */
  config?: Record<string, unknown>;
  /** Plugin enabled */
  enabled?: boolean;
  /** Plugin priority */
  priority?: number;
}

/**
 * Error handler function
 */
export type ErrorHandler = (
  error: Error,
  req: NextRushRequest,
  res: NextRushResponse
) => void | Promise<void>;

/**
 * Route handler function
 */
export type RouteHandler = (
  req: NextRushRequest,
  res: NextRushResponse
) => void | Promise<void>;

/**
 * Route options
 */
export interface RouteOptions {
  /** Route name */
  name?: string;
  /** Route description */
  description?: string;
  /** Route middleware */
  middleware?: Middleware[];
  /** Route validation */
  validation?: Record<string, unknown>;
}

/**
 * Basic WebSocket interface
 */
export interface WebSocket {
  /** Send data */
  send(data: string | Buffer): void;
  /** Close connection */
  close(code?: number, reason?: string): void;
  /** Connection ready state */
  readyState: number;
  /** Connection URL */
  url: string;
  /** Connection protocol */
  protocol: string;
  /** Connection extensions */
  extensions: string;
  /** Connection buffered amount */
  bufferedAmount: number;
  /** Binary type */
  binaryType: string;
  /** Event listeners */
  addEventListener(type: string, listener: (event: unknown) => void): void;
  /** Remove event listener */
  removeEventListener(type: string, listener: (event: unknown) => void): void;
  /** Dispatch event */
  dispatchEvent(event: unknown): boolean;
}
