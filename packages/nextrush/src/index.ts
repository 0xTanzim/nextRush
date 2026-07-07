/**
 * NextRush - Minimal, Modular, Blazing Fast Node.js Framework
 *
 * This meta package provides the **functional** API for building Node.js APIs:
 * - Application creation (createApp)
 * - Routing (createRouter)
 * - Server start (listen)
 * - HTTP errors
 * - Essential types
 *
 * For the class-based paradigm (DI, decorators, controllers),
 * import from `nextrush/class` instead.
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
 * app.route('/', router);
 * listen(app, 8080);
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
 * listen(app, 8080);
 * ```
 *
 * @example Class-Based (import from nextrush/class)
 * ```typescript
 * import { createApp, listen } from 'nextrush';
 * import { Controller, Get, Service, registerControllers } from 'nextrush/class';
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
 * await registerControllers(app, { root: './src' });
 * await listen(app, 8080);
 * ```
 */

// ============================================
// CORE: Application & Middleware Composition
// ============================================
import {
  Application,
  compose,
  createApp as createBareApp,
  type ApplicationOptions,
} from '@nextrush/core';
import { createRouter as createDefaultRouter } from '@nextrush/router';

/**
 * Create an application with a default router wired in, so `app.get`/`app.post`
 * work out of the box. Import `createApp` from `@nextrush/core` for a minimal
 * engine where routing is bring-your-own.
 */
export function createApp(options?: ApplicationOptions): Application {
  const router = options?.router ?? createDefaultRouter();
  return createBareApp({ ...options, router });
}

export { Application, compose };
export type { ApplicationOptions, ComposedMiddleware } from '@nextrush/core';

// ============================================
// ROUTER: Radix Tree Routing + Route Metadata
// ============================================
export { Router, createRouter, endpoint } from '@nextrush/router';
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
    BadRequestError, ConflictError, ForbiddenError,
    GatewayTimeoutError,
    // Base
    HttpError,
    // 5xx Server Errors
    InternalServerError, MethodNotAllowedError,
    NextRushError,
    NotFoundError, NotImplementedError,
    ServiceUnavailableError,
    TooManyRequestsError,
    UnauthorizedError,
    UnprocessableEntityError, catchAsync,
    // Factory functions
    createError,
    // Error handling middleware
    errorHandler, isHttpError, notFoundHandler
} from '@nextrush/errors';

export type { ErrorHandlerOptions, HttpErrorOptions } from '@nextrush/errors';

// ============================================
// TYPES: Essential TypeScript Types
// ============================================
export type {
    // Core types
    Context,
    // Extension model
    Extension,
    ExtensionContext,
    // HTTP types
    HttpMethod,
    HttpStatusCode,
    Middleware,
    Next,
    RouteHandler,
    // Route metadata (author with endpoint(); read by @nextrush/openapi)
    RouteDefinition,
    RouteMetadata,
    // Runtime
    Runtime
} from '@nextrush/types';

// HTTP constants
export { ContentType, HttpStatus } from '@nextrush/types';

// NOTE: VERSION is not exported from the core package to maintain
// Edge runtime compatibility (no node:fs). Use @nextrush/dev or
// check package.json directly if you need the version.
