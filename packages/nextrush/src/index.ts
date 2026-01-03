/**
 * NextRush - Minimal, Modular, Blazing Fast Node.js Framework
 *
 * This meta package provides the ESSENTIALS for building Node.js APIs:
 * - Application creation (createApp)
 * - Routing (createRouter)
 * - Server start (listen)
 * - HTTP errors
 * - Essential types
 *
 * For middleware and plugins, install them separately:
 * - @nextrush/cors
 * - @nextrush/helmet
 * - @nextrush/body-parser
 * - @nextrush/rate-limit
 * - @nextrush/logger
 *
 * For class-based architecture (decorators, DI), install:
 * - @nextrush/decorators
 * - @nextrush/di
 * - @nextrush/controllers
 *
 * For other runtimes, install the appropriate adapter:
 * - @nextrush/adapter-bun
 * - @nextrush/adapter-deno
 * - @nextrush/adapter-edge
 *
 * @packageDocumentation
 * @module nextrush
 *
 * @example Quick Start (Functional)
 * ```typescript
 * import { createApp, createRouter, listen } from 'nextrush';
 *
 * const app = createApp();
 * const router = createRouter();
 *
 * router.get('/', (ctx) => {
 *   ctx.json({ message: 'Hello NextRush!' });
 * });
 *
 * app.use(router.routes());
 * listen(app, 3000);
 * ```
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
 * @example Class-Based (install @nextrush/decorators @nextrush/di @nextrush/controllers)
 * ```typescript
 * import 'reflect-metadata';
 * import { createApp, listen } from 'nextrush';
 * import { Controller, Get } from '@nextrush/decorators';
 * import { Service } from '@nextrush/di';
 * import { controllersPlugin } from '@nextrush/controllers';
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
 * app.plugin(controllersPlugin({ controllers: [UserController] }));
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
    BadRequestError, catchAsync, ConflictError,
    // Factory functions
    createError,
    // Error handling middleware
    errorHandler, ForbiddenError, GatewayTimeoutError,
    // Base
    HttpError,
    // 5xx Server Errors
    InternalServerError, isHttpError, MethodNotAllowedError, NextRushError, NotFoundError, notFoundHandler, NotImplementedError, ServiceUnavailableError, TooManyRequestsError, UnauthorizedError, UnprocessableEntityError
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
    HttpStatusCode, Middleware,
    Next,
    Plugin,
    RouteHandler,
    // Runtime
    Runtime
} from '@nextrush/types';

// HTTP constants
export { ContentType, HttpStatus } from '@nextrush/types';

// ============================================
// VERSION
// ============================================
export const VERSION = '3.0.0';
