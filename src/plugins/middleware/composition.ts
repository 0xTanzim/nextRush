/**
 * 🎨 Middleware Composition Functions - NextRush Framework
 *
 * Provides Express-like middleware composition functions:
 * - compose() - Combine multiple middleware
 * - when() - Conditional middleware
 * - unless() - Exclusion middleware
 * - named() - Debug middleware with names
 */

import {
  ExpressMiddleware,
  NextRushRequest,
  NextRushResponse,
} from '../../types/express';

/**
 * Compose multiple middleware into a single middleware function
 * Optimized for performance with minimal function calls
 *
 * @example
 * const authFlow = compose(checkApiKey, checkUser, rateLimit);
 * app.get('/protected', authFlow, handler);
 */
export function compose(
  ...middlewares: ExpressMiddleware[]
): ExpressMiddleware {
  // Early optimization for common cases
  if (middlewares.length === 0) {
    return (req, res, next) => next();
  }

  if (middlewares.length === 1) {
    return middlewares[0];
  }

  return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
    let index = 0;

    function executeNext(): void {
      if (index >= middlewares.length) {
        return next();
      }

      const middleware = middlewares[index++];
      try {
        middleware(req, res, executeNext);
      } catch (error) {
        console.error('❌ Middleware composition error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' });
        }
        // Don't call next() on error to prevent further execution
      }
    }

    executeNext();
  };
}

/**
 * Conditionally apply middleware based on a condition function
 *
 * @example
 * const mobileOnly = when(
 *   (req) => req.headers['user-agent']?.includes('Mobile'),
 *   mobileOptimization
 * );
 */
export function when(
  condition: (req: NextRushRequest) => boolean,
  middleware: ExpressMiddleware
): ExpressMiddleware {
  return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
    if (condition(req)) {
      middleware(req, res, next);
    } else {
      next();
    }
  };
}

/**
 * Apply middleware UNLESS a condition is true (opposite of when)
 *
 * @example
 * const authExceptPublic = unless(
 *   (req) => req.path.startsWith('/public'),
 *   requireAuth
 * );
 */
export function unless(
  condition: (req: NextRushRequest) => boolean,
  middleware: ExpressMiddleware
): ExpressMiddleware {
  return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
    if (!condition(req)) {
      middleware(req, res, next);
    } else {
      next();
    }
  };
}

/**
 * Give middleware a name for easier debugging and tracking
 *
 * @example
 * app.use(named('rate-limiter', rateLimitMiddleware));
 * app.use(named('auth-check', authMiddleware));
 */
export function named(
  name: string,
  middleware: ExpressMiddleware
): ExpressMiddleware {
  const namedMiddleware = (
    req: NextRushRequest,
    res: NextRushResponse,
    next: () => void
  ) => {
    // Add middleware name to request for debugging
    if (!(req as any).middlewareStack) {
      (req as any).middlewareStack = [];
    }
    (req as any).middlewareStack.push(name);

    // Execute the middleware
    middleware(req, res, next);
  };

  // Add name property for identification
  (namedMiddleware as any).middlewareName = name;

  return namedMiddleware;
}

/**
 * Create a group of middleware that can be applied together
 *
 * @example
 * const securityGroup = group([cors(), helmet(), rateLimit()]);
 * app.use('/api', securityGroup);
 */
export function group(middlewares: ExpressMiddleware[]): ExpressMiddleware {
  return compose(...middlewares);
}
