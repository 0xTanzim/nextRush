/**
 * Request Handler for NextRush v2
 *
 * Extracts the request handling pipeline from the main application class.
 * Follows Single Responsibility Principle.
 *
 * @packageDocumentation
 */

import { createContext, releaseContext } from '@/core/app/context';
import {
  createSafeContext,
  createSafeMiddleware,
} from '@/core/context/immutable';
import type { Router as RouterClass } from '@/core/router';
import type { Context, Middleware, RouteHandler } from '@/types/context';
import type { ApplicationOptions, NextRushRequest, NextRushResponse } from '@/types/http';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Request handler configuration
 */
export interface RequestHandlerConfig {
  /** Application options */
  options: Required<ApplicationOptions>;
  /** Function to get current middleware stack (allows dynamic updates) */
  getMiddleware: () => Middleware[];
  /** Router instance */
  router: RouterClass;
  /** Exception filter finder function */
  findExceptionFilter: () => Middleware | null;
}

/**
 * Creates a request handler function
 *
 * @param config - Request handler configuration
 * @returns Request handler function
 */
export function createRequestHandler(
  config: RequestHandlerConfig
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const { options, getMiddleware, router, findExceptionFilter } = config;

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const ctx = createContext(
      req as NextRushRequest,
      res as NextRushResponse,
      options
    );

    try {
      const exceptionFilter = findExceptionFilter();
      const middleware = getMiddleware();

      if (exceptionFilter) {
        await exceptionFilter(ctx, async () => {
          await executeMiddleware(ctx, middleware, options.debug);
          ctx.req.body = ctx.body;
          await executeRoute(ctx, router, options.debug);
        });
      } else {
        await executeMiddleware(ctx, middleware, options.debug);
        ctx.req.body = ctx.body;
        await executeRoute(ctx, router, options.debug);
      }
    } finally {
      releaseContext(ctx);
    }
  };
}

/**
 * Execute middleware stack with optional debug mode
 *
 * @param ctx - Request context
 * @param middleware - Middleware array
 * @param debug - Enable debug mode with SafeContext
 */
export async function executeMiddleware(
  ctx: Context,
  middleware: Middleware[],
  debug: boolean
): Promise<void> {
  if (debug) {
    await executeMiddlewareDebug(ctx, middleware);
    return;
  }

  await executeMiddlewareProduction(ctx, middleware);
}

/**
 * Execute middleware in debug mode with SafeContext
 */
async function executeMiddlewareDebug(
  ctx: Context,
  middleware: Middleware[]
): Promise<void> {
  let safeCtx = createSafeContext(ctx);
  let index = 0;

  const dispatch = async (): Promise<void> => {
    if (index >= middleware.length) {
      return;
    }

    const mw = middleware[index++];
    if (mw) {
      const safeMiddleware = createSafeMiddleware(mw);
      const result = await safeMiddleware(safeCtx, dispatch);

      if (result) {
        safeCtx = result;
      }
    }
  };

  await dispatch();
  safeCtx.commit();
}

/**
 * Execute middleware in production mode (direct execution)
 */
async function executeMiddlewareProduction(
  ctx: Context,
  middleware: Middleware[]
): Promise<void> {
  let index = 0;

  const dispatch = async (): Promise<void> => {
    if (index >= middleware.length) {
      return;
    }

    const mw = middleware[index++];
    if (!mw) return;

    const result = mw(ctx, dispatch);
    if (result instanceof Promise) {
      await result;
    }
  };

  await dispatch();
}

/**
 * Execute route handler
 *
 * @param ctx - Request context
 * @param router - Router instance
 * @param debug - Enable debug logging
 */
export async function executeRoute(
  ctx: Context,
  router: RouterClass,
  debug: boolean
): Promise<void> {
  const match = router.find(ctx.method, ctx.path);

  if (!match) {
    ctx.res.status(404).json({ error: 'Not Found' });
    return;
  }

  // Set frozen params
  ctx.params = Object.freeze({ ...match.params }) as typeof ctx.params;

  // Use compiled handler if available (ultra-fast path)
  if (match.compiled) {
    const result = match.compiled(ctx);
    if (result && typeof result.then === 'function') {
      await result;
    }
    return;
  }

  // Debug logging
  if (debug) {
    logRouteMatch(ctx, match);
  }

  // Execute route-specific middleware and handler
  if (match.middleware && match.middleware.length > 0) {
    await executeRouteMiddleware(ctx, match.middleware, match.handler, debug);
  } else {
    if (debug) {
      console.log(`🏃 No route middleware, executing handler directly`);
    }
    await match.handler(ctx);
  }
}

/**
 * Execute route-specific middleware chain
 */
async function executeRouteMiddleware(
  ctx: Context,
  middleware: Middleware[],
  handler: RouteHandler,
  debug: boolean
): Promise<void> {
  let index = 0;

  const dispatch = async (): Promise<void> => {
    if (index >= middleware.length) {
      if (debug) {
        console.log(`🚀 All middleware complete, executing handler`);
      }
      await handler(ctx);
      return;
    }

    const mw = middleware[index++];
    if (mw) {
      if (debug) {
        console.log(
          `⚡ Executing middleware ${index}/${middleware.length}: ${mw.name || 'anonymous'}`
        );
      }
      await mw(ctx, dispatch);
    }
  };

  await dispatch();
}

/**
 * Log route match information for debugging
 */
function logRouteMatch(
  ctx: Context,
  match: { middleware?: Middleware[] }
): void {
  console.log(`🎯 Route match found: ${ctx.method} ${ctx.path}`);
  console.log(
    `📋 Route has ${match.middleware ? match.middleware.length : 0} middleware`
  );
  console.log(
    `🔧 Middleware:`,
    match.middleware?.map((m) => m.name || 'anonymous')
  );
}
