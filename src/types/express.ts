/**
 * Express-style request and response interfaces
 * Making NextRush familiar and easy to use
 */
import { IncomingMessage, ServerResponse } from 'http';
import { ParsedUrlQuery } from 'querystring';

// Express-style Request interface
export interface NextRushRequest extends IncomingMessage {
  params: Record<string, string>;
  query: ParsedUrlQuery;
  body: any;
  pathname: string;
  originalUrl: string;
  path: string;

  // Helper methods
  param(name: string): string | undefined;
  header(name: string): string | undefined;
  get(name: string): string | undefined;
}

// Express-style Response interface
export interface NextRushResponse extends ServerResponse {
  locals: Record<string, any>;

  // Status
  status(code: number): NextRushResponse;

  // JSON response
  json(data: any): void;

  // Send response
  send(data: string | Buffer | object): void;

  // HTML response
  html(data: string): void;

  // Text response
  text(data: string): void;

  // Redirect
  redirect(url: string, status?: number): void;

  // Set headers
  set(field: string, value: string): NextRushResponse;
  header(field: string, value: string): NextRushResponse;

  // Get headers
  get(field: string): string | undefined;

  // Cookie methods (basic implementation)
  cookie(name: string, value: string, options?: any): NextRushResponse;
  clearCookie(name: string): NextRushResponse;
}

// Express-style handler types
export type ExpressHandler = (
  req: NextRushRequest,
  res: NextRushResponse
) => void | Promise<void>;
export type ExpressMiddleware = (
  req: NextRushRequest,
  res: NextRushResponse,
  next: () => void
) => void | Promise<void>;

// Next function type
export type NextFunction = (error?: any) => void;
