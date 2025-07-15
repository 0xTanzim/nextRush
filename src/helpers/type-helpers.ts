/**
 * 🎯 NextRush Type Helpers - Better Developer Experience
 *
 * This file provides helper functions and types to improve the TypeScript
 * experience when using NextRush, reducing the need for manual type annotations.
 */

import { NextRushRequest, NextRushResponse } from '../types/express';

// Type-safe handler helpers
export type RequestHandler = (
  req: NextRushRequest,
  res: NextRushResponse
) => void | Promise<void>;
export type MiddlewareHandler = (
  req: NextRushRequest,
  res: NextRushResponse,
  next: () => void
) => void | Promise<void>;

/**
 * Helper function to create type-safe route handlers
 * Usage: app.get('/users', handler((req, res) => { ... }))
 */
export function handler(fn: RequestHandler): RequestHandler {
  return fn;
}

/**
 * Helper function to create type-safe middleware
 * Usage: app.use(middleware((req, res, next) => { ... }))
 */
export function middleware(fn: MiddlewareHandler): MiddlewareHandler {
  return fn;
}

/**
 * Create a typed route handler with automatic inference
 */
export function route<T = any>(
  handler: (
    req: NextRushRequest & { body: T },
    res: NextRushResponse
  ) => void | Promise<void>
): RequestHandler {
  return handler as RequestHandler;
}

/**
 * Create async route handler with automatic error handling
 */
export function asyncRoute(
  handler: (req: NextRushRequest, res: NextRushResponse) => Promise<void>
): RequestHandler {
  return async (req: NextRushRequest, res: NextRushResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('Route error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}

// Export types for easier importing
export type { NextRushRequest, NextRushResponse };

// Re-export common types
export type ExpressLikeHandler = RequestHandler;
export type ExpressLikeMiddleware = MiddlewareHandler;
