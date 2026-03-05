/**
 * NextRush - Minimal, Modular, Blazing Fast Node.js Framework
 *
 * This meta package provides EVERYTHING needed for building Node.js APIs:
 * - Application creation (createApp)
 * - Routing (createRouter)
 * - Server start (listen)
 * - HTTP errors
 * - Essential types
 * - Dependency injection (DI container, @Service, @inject)
 * - Decorators (@Controller, @Get, @Body, @UseGuard)
 * - Controllers plugin (auto-discovery)
 *
 * For middleware, install separately:
 * - @nextrush/cors
 * - @nextrush/helmet
 * - @nextrush/body-parser
 * - @nextrush/rate-limit
 * - @nextrush/logger
 *
 * For other runtimes, install the appropriate adapter:
 * - @nextrush/adapter-bun
 * - @nextrush/adapter-deno
 * - @nextrush/adapter-edge
 *
 * @packageDocumentation
 * @module nextrush
 *
 * @example Quick Start (Functional)\n * ```typescript\n * import { createApp, createRouter, listen } from 'nextrush';\n *\n * const app = createApp();\n * const router = createRouter();\n *\n * router.get('/', (ctx) => {\n *   ctx.json({ message: 'Hello NextRush!' });\n * });\n *\n * app.route('/', router);\n * listen(app, 3000);\n * ```
 *
 * @example With Middleware (install separately)
 * ```typescript
 * import { createApp, listen } from 'nextrush';
 * import { cors } from '@nextrush/cors';
 * import { json } from '@nextrush/body-parser';
 *
 * const app = createApp();
 * app.use(cors());
 * app.use(json());
 *
 * listen(app, 3000);
 * ```
 *
 * @example Class-Based (add reflect-metadata for DI)
 * ```typescript
 * import 'reflect-metadata';
 * import { createApp, listen, Controller, Get, Service, controllersPlugin } from 'nextrush';
 *
 * @Service()
 * class UserService {
 *   findAll() { return [{ id: 1, name: 'Alice' }]; }
 * }
 *
 * @Controller('/users')
 * class UserController {
 *   constructor(private users: UserService) {}
 *
 *   @Get()
 *   findAll() { return this.users.findAll(); }
 * }
 *
 * const app = createApp();
 * app.plugin(controllersPlugin({ root: './src' }));
 * listen(app, 3000);
 * ```
 */

// ============================================
// CORE: Application & Middleware Composition
// ============================================
export { Application, compose, createApp } from '@nextrush/core';
export type { ApplicationOptions, ComposedMiddleware } from '@nextrush/core';

// ============================================
// ROUTER: Radix Tree Routing
// ============================================
export { createRouter, Router } from '@nextrush/router';
export type { RouterOptions } from '@nextrush/router';

// ============================================
// ADAPTER: Node.js HTTP (Default Runtime)
// ============================================
export { createHandler, listen, serve } from '@nextrush/adapter-node';
export type { ServeOptions, ServerInstance } from '@nextrush/adapter-node';

// ============================================
// ERRORS: HTTP Error Classes & Factory
// ============================================
export {
  BadGatewayError,
  // 4xx Client Errors
  BadRequestError,
  catchAsync,
  ConflictError,
  // Factory functions
  createError,
  // Error handling middleware
  errorHandler,
  ForbiddenError,
  GatewayTimeoutError,
  // Base
  HttpError,
  // 5xx Server Errors
  InternalServerError,
  isHttpError,
  MethodNotAllowedError,
  NextRushError,
  NotFoundError,
  notFoundHandler,
  NotImplementedError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnauthorizedError,
  UnprocessableEntityError,
} from '@nextrush/errors';

export type { ErrorHandlerOptions, HttpErrorOptions } from '@nextrush/errors';

// ============================================
// TYPES: Essential TypeScript Types
// ============================================
export type {
  // Core types
  Context,
  // HTTP types
  HttpMethod,
  HttpStatusCode,
  Middleware,
  Next,
  Plugin,
  RouteHandler,
  // Runtime
  Runtime,
} from '@nextrush/types';

// HTTP constants
export { ContentType, HttpStatus } from '@nextrush/types';

// ============================================
// VERSION
// ============================================
export const VERSION = '3.0.0';

// ============================================
// DI: Dependency Injection Container
// ============================================
export {
  AutoInjectable,
  Config,
  container,
  createContainer,
  delay,
  inject,
  Injectable,
  Optional,
  Repository,
  Service,
} from '@nextrush/di';
export type {
  ClassProvider,
  ConfigOptions,
  ContainerInterface,
  FactoryProvider,
  Provider,
  Scope,
  ServiceOptions,
  Token,
  ValueProvider,
} from '@nextrush/di';

// ============================================
// DECORATORS: Controller, Route & Parameter
// ============================================
export {
  // Route decorators
  All,
  // Parameter decorators
  Body,
  // Class decorators
  Controller,
  // Custom param decorator factory
  createCustomParamDecorator,
  Ctx,
  Delete,
  Get,
  Head,
  Header,
  Options,
  Param,
  Patch,
  Post,
  Put,
  Query,
  // Response decorators
  Redirect,
  Req,
  Res,
  SetHeader,
  // Guard decorators
  UseGuard,
} from '@nextrush/decorators';
export type {
  BodyOptions,
  CanActivate,
  ControllerMetadata,
  ControllerOptions,
  CustomParamExtractor,
  GuardContext,
  GuardFn,
  HeaderOptions,
  ParamMetadata,
  ParamOptions,
  ParamSource,
  QueryOptions,
  RouteMetadata,
  RouteOptions,
  TransformFn,
} from '@nextrush/decorators';

// ============================================
// CONTROLLERS: Auto-discovery Plugin
// ============================================
export { controllersPlugin } from '@nextrush/controllers';
export type { ControllersPluginOptions } from '@nextrush/controllers';
