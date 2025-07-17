/**
 * 🔧 NextRush Middleware Types
 * Type definitions for middl# Named middleware interface wit// Built-in middleware option types using NextRush types
export interface CorsOptions {
  origin?: string | string[] | boolean | ((or# Middleware execution context# Advanced middleware types with NextRush types
export type ConditionalMiddleware<TRequest = NextRushRequest, TResponse = NextRushResponse> = {
  condition: ConditionalPredicate<TRequest, TResponse>;
  middleware: Middleware<TRequest, TResponse>;
};

export type TimedMiddleware<TRequest = NextRushRequest, TResponse = NextRushResponse> = {
  timeout: number;
  middleware: Middleware<TRequest, TResponse>;
  onTimeout?: (context: MiddlewareContext<TRequest, TResponse>) => void;
};

export type RetryableMiddleware<TRequest = NextRushRequest, TResponse = NextRushResponse> = {
  maxRetries: number;
  middleware: Middleware<TRequest, TResponse>;
  shouldRetry?: (error: any, attempt: number) => boolean;
  delay?: number | ((attempt: number) => number);
};es
export interface MiddlewareContext<TRequest = NextRushRequest, TResponse = NextRushResponse> {
  req: TRequest;
  res: TResponse;
  next: NextFunction;
  config?: MiddlewareConfig;
  startTime?: number;
  endTime?: number;
  error?: any;
  metadata?: Record<string, any>;
}g | undefined, req: NextRushRequest) => boolean);
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}types
export interface NamedMiddleware<
  TRequest = NextRushRequest,
  TResponse = NextRushResponse,
  TNextFunction = NextFunction
> extends Middleware<TRequest, TResponse, TNextFunction> {
  middlewareName: string;
  config?: MiddlewareConfig;
}tem using proper NextRush types
 */

import { NextRushRequest, NextRushResponse } from '../types/express';

// Core middleware types with proper NextRush types
export type NextFunction = (error?: any) => void;

export type Middleware<
  TRequest = NextRushRequest,
  TResponse = NextRushResponse,
  TNextFunction = NextFunction
> = (req: TRequest, res: TResponse, next: TNextFunction) => void;

export type AsyncMiddleware<
  TRequest = NextRushRequest,
  TResponse = NextRushResponse,
  TNextFunction = NextFunction
> = (req: TRequest, res: TResponse, next: TNextFunction) => Promise<void>;

export type ErrorMiddleware<
  TError = any,
  TRequest = NextRushRequest,
  TResponse = NextRushResponse,
  TNextFunction = NextFunction
> = (error: TError, req: TRequest, res: TResponse, next: TNextFunction) => void;

// Handler types (compatible with Express but using NextRush types)
export type RequestHandler<
  TRequest = NextRushRequest,
  TResponse = NextRushResponse,
  TNextFunction = NextFunction
> = Middleware<TRequest, TResponse, TNextFunction>;

export type ErrorRequestHandler<
  TError = any,
  TRequest = NextRushRequest,
  TResponse = NextRushResponse,
  TNextFunction = NextFunction
> = ErrorMiddleware<TError, TRequest, TResponse, TNextFunction>;

// Conditional middleware types with NextRush types
export type ConditionalPredicate<
  TRequest = NextRushRequest,
  TResponse = NextRushResponse
> = (req: TRequest, res: TResponse) => boolean;

export type PathMatcher = string | RegExp | ((path: string) => boolean);

export type MethodMatcher = string | string[];

// Middleware configuration types
export interface MiddlewareConfig {
  name?: string;
  enabled?: boolean;
  priority?: number;
  conditions?: {
    path?: PathMatcher;
    method?: MethodMatcher;
    predicate?: ConditionalPredicate;
  };
  timeout?: number;
  retries?: number;
}

// Named middleware interface
export interface NamedMiddleware<
  TRequest = any,
  TResponse = any,
  TNextFunction = NextFunction
> extends Middleware<TRequest, TResponse, TNextFunction> {
  middlewareName: string;
  config?: MiddlewareConfig;
}

// Middleware stack types
export interface MiddlewareStackConfig {
  beforeHooks?: Middleware[];
  middlewares?: Middleware[];
  afterHooks?: Middleware[];
  errorHandlers?: ErrorMiddleware[];
  timeout?: number;
  maxRetries?: number;
}

// Middleware factory types
export type MiddlewareFactory<TOptions = any> = (
  options?: TOptions
) => Middleware;
export type AsyncMiddlewareFactory<TOptions = any> = (
  options?: TOptions
) => AsyncMiddleware;

// Built-in middleware option types
export interface CorsOptions {
  origin?:
    | string
    | string[]
    | boolean
    | ((origin: string | undefined, req: any) => boolean);
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

export interface HelmetOptions {
  contentSecurityPolicy?:
    | boolean
    | {
        directives?: Record<string, string[]>;
        useDefaults?: boolean;
      };
  crossOriginEmbedderPolicy?: boolean | { policy: string };
  crossOriginOpenerPolicy?: boolean | { policy: string };
  crossOriginResourcePolicy?: boolean | { policy: string };
  frameguard?:
    | boolean
    | { action: 'deny' | 'sameorigin' | 'allow-from'; domain?: string };
  hidePoweredBy?: boolean;
  hsts?:
    | boolean
    | {
        maxAge?: number;
        includeSubDomains?: boolean;
        preload?: boolean;
      };
  noSniff?: boolean;
  originAgentCluster?: boolean;
  permittedCrossDomainPolicies?: boolean;
  referrerPolicy?: boolean | { policy: string | string[] };
  xssFilter?: boolean;
}

export interface CompressionOptions {
  threshold?: number;
  level?: number;
  windowBits?: number;
  memLevel?: number;
  strategy?: number;
  filter?: (req: NextRushRequest, res: NextRushResponse) => boolean;
  brotli?: boolean;
}

export interface JsonOptions {
  limit?: string | number;
  strict?: boolean;
  reviver?: (key: string, value: any) => any;
  type?: string | string[] | ((req: NextRushRequest) => boolean);
  verify?: (
    req: NextRushRequest,
    res: NextRushResponse,
    body: Buffer,
    encoding: string
  ) => void;
}

/**
 * 📊 Logger Options
 */
export interface LoggerOptions {
  format?: 'combined' | 'common' | 'short' | 'tiny' | string;
  immediate?: boolean;
}

export interface RateLimitOptions {
  windowMs?: number;
  max?: number | ((req: NextRushRequest) => number);
  message?: string | object;
  statusCode?: number;
  headers?: boolean;
  keyGenerator?: (req: NextRushRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  store?: any;
}

export interface RequestIdOptions {
  header?: string;
  generator?: () => string;
  setResponseHeader?: boolean;
}

export interface RequestTimerOptions {
  header?: string;
  digits?: number;
  suffix?: boolean;
}

export interface CookieParserOptions {
  secret?: string | string[];
  decode?: (value: string) => string;
}

// Utility types for middleware composition
export type MiddlewareTuple = [Middleware, ...Middleware[]];
export type MiddlewareArray = Middleware[];
export type MiddlewareInput = Middleware | MiddlewareArray | MiddlewareTuple;

// Route-specific middleware types
export interface RouteMiddleware {
  path: string;
  method?: string | string[];
  middleware: Middleware[];
  config?: MiddlewareConfig;
}

// Plugin middleware types
export interface MiddlewarePlugin {
  name: string;
  version?: string;
  description?: string;
  middleware: Middleware | MiddlewareFactory;
  dependencies?: string[];
  config?: MiddlewareConfig;
  install?: (app: any) => void;
  uninstall?: (app: any) => void;
}

// Middleware registry types
export interface MiddlewareRegistry {
  register(name: string, middleware: Middleware | MiddlewareFactory): void;
  unregister(name: string): void;
  get(name: string): Middleware | MiddlewareFactory | undefined;
  has(name: string): boolean;
  list(): string[];
  clear(): void;
}

// Middleware execution context
export interface MiddlewareContext<TRequest = any, TResponse = any> {
  req: TRequest;
  res: TResponse;
  next: NextFunction;
  config?: MiddlewareConfig;
  startTime?: number;
  endTime?: number;
  error?: any;
  metadata?: Record<string, any>;
}

// Middleware lifecycle hooks
export interface MiddlewareLifecycle {
  beforeExecute?(context: MiddlewareContext): void | Promise<void>;
  afterExecute?(context: MiddlewareContext): void | Promise<void>;
  onError?(error: any, context: MiddlewareContext): void | Promise<void>;
  onTimeout?(context: MiddlewareContext): void | Promise<void>;
}

// Advanced middleware types
export type ConditionalMiddleware<TRequest = any, TResponse = any> = {
  condition: ConditionalPredicate<TRequest, TResponse>;
  middleware: Middleware<TRequest, TResponse>;
};

export type TimedMiddleware<TRequest = any, TResponse = any> = {
  timeout: number;
  middleware: Middleware<TRequest, TResponse>;
  onTimeout?: (context: MiddlewareContext<TRequest, TResponse>) => void;
};

export type RetryableMiddleware<TRequest = any, TResponse = any> = {
  maxRetries: number;
  middleware: Middleware<TRequest, TResponse>;
  shouldRetry?: (error: any, attempt: number) => boolean;
  delay?: number | ((attempt: number) => number);
};

// Middleware pattern types
export type MiddlewarePattern =
  | 'sequential'
  | 'parallel'
  | 'race'
  | 'waterfall'
  | 'pipeline'
  | 'circuit-breaker';

export interface MiddlewarePatternConfig {
  pattern: MiddlewarePattern;
  options?: any;
  middleware: Middleware[];
}

// Type guards
export function isMiddleware(value: any): value is Middleware {
  return typeof value === 'function' && value.length >= 2;
}

export function isAsyncMiddleware(value: any): value is AsyncMiddleware {
  return isMiddleware(value) && value.constructor.name === 'AsyncFunction';
}

export function isErrorMiddleware(value: any): value is ErrorMiddleware {
  return typeof value === 'function' && value.length === 4;
}

export function isNamedMiddleware(value: any): value is NamedMiddleware {
  return (
    isMiddleware(value) && typeof (value as any).middlewareName === 'string'
  );
}

export function isMiddlewareFactory(value: any): value is MiddlewareFactory {
  return typeof value === 'function' && value.length <= 1;
}

// Helper types for better type inference
export type ExtractMiddlewareRequest<T> = T extends Middleware<
  infer R,
  any,
  any
>
  ? R
  : any;
export type ExtractMiddlewareResponse<T> = T extends Middleware<
  any,
  infer R,
  any
>
  ? R
  : any;

// Union types for common patterns
export type AnyMiddleware = Middleware | AsyncMiddleware | ErrorMiddleware;
export type AnyMiddlewareFactory = MiddlewareFactory | AsyncMiddlewareFactory;

// Export everything for convenience
export type {
  AsyncMiddlewareFactory as AsyncFactory,
  AsyncMiddleware as AsyncMiddlewareFunction,
  ErrorMiddleware as ErrorMiddlewareFunction,
  MiddlewareFactory as Factory,
  Middleware as MiddlewareFunction,
};

// Default export for the module
export default {
  isMiddleware,
  isAsyncMiddleware,
  isErrorMiddleware,
  isNamedMiddleware,
  isMiddlewareFactory,
};
