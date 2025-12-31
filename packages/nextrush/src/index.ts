/**
 * NextRush - Minimal, Modular, Blazing Fast Node.js Framework
 *
 * This meta package provides the ESSENTIALS only:
 * - createApp (application)
 * - createRouter (routing)
 * - listen (start server)
 *
 * For middleware and plugins, install them separately:
 * - @nextrush/cors
 * - @nextrush/helmet
 * - @nextrush/body-parser
 * - @nextrush/logger
 * - etc.
 *
 * @packageDocumentation
 * @module nextrush
 *
 * @example Quick Start
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
 *
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
 */

// Core - Application
export { Application, compose, createApp } from '@nextrush/core';
export type { ApplicationOptions, ComposedMiddleware } from '@nextrush/core';

// Core - Errors
export {
    BadRequestError, ForbiddenError, HttpError, InternalServerError, NextRushError,
    NotFoundError, UnauthorizedError, createHttpError
} from '@nextrush/core';

// Router
export { Router, createRouter } from '@nextrush/router';
export type { RouterOptions } from '@nextrush/router';

// Adapter - Start Server
export { createHandler, listen, serve } from '@nextrush/adapter-node';
export type { ServeOptions, ServerInstance } from '@nextrush/adapter-node';

// Types - Essential only
export type {
    Context, HttpMethod,
    HttpStatusCode, Middleware,
    Next,
    Plugin,
    RouteHandler,
    Runtime
} from '@nextrush/types';

export { ContentType, HttpStatus } from '@nextrush/types';

// Version
export const VERSION = '3.0.0-alpha.2';
