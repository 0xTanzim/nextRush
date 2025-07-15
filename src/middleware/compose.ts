/**
 * Middleware composition and utility functions
 */

import {
  ExpressMiddleware,
  NextRushRequest,
  NextRushResponse,
} from '../types/express';

export type MiddlewareFunction = ExpressMiddleware;
export type ConditionalFunction = (req: NextRushRequest) => boolean;

/**
 * Compose multiple middleware into a single middleware function
 */
export function compose(
  ...middlewares: MiddlewareFunction[]
): MiddlewareFunction {
  return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
    let index = 0;

    const dispatch = (error?: any) => {
      if (error) {
        return next();
      }

      if (index >= middlewares.length) {
        return next();
      }

      const middleware = middlewares[index++];

      try {
        middleware(req, res, dispatch);
      } catch (err) {
        dispatch(err);
      }
    };

    dispatch();
  };
}

/**
 * Conditional middleware - only execute if condition is met
 */
export function when(
  condition: boolean | ConditionalFunction,
  middleware: MiddlewareFunction
): MiddlewareFunction {
  return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
    const shouldExecute =
      typeof condition === 'function' ? condition(req) : condition;

    if (shouldExecute) {
      return middleware(req, res, next);
    }

    next();
  };
}

/**
 * Unless middleware - opposite of when
 */
export function unless(
  condition: boolean | ConditionalFunction,
  middleware: MiddlewareFunction
): MiddlewareFunction {
  return when(
    typeof condition === 'function' ? (req) => !condition(req) : !condition,
    middleware
  );
}

export interface MiddlewareGroup {
  name: string;
  path: string;
  middlewares: MiddlewareFunction[];
}

export function group(
  name: string,
  path: string,
  ...middlewares: MiddlewareFunction[]
): MiddlewareGroup {
  return {
    name,
    path,
    middlewares,
  };
}

/**
 * Named middleware for better debugging
 */
export function named(
  name: string,
  middleware: MiddlewareFunction
): MiddlewareFunction {
  const namedMiddleware = (
    req: NextRushRequest,
    res: NextRushResponse,
    next: () => void
  ) => {
    if (!req.middlewareStack) {
      req.middlewareStack = [];
    }
    req.middlewareStack.push(name);

    return middleware(req, res, next);
  };

  (namedMiddleware as any).middlewareName = name;
  return namedMiddleware;
}

/**
 * Async middleware wrapper
 */
export function asyncMiddleware(
  middleware: (
    req: NextRushRequest,
    res: NextRushResponse,
    next: () => void
  ) => Promise<any>
): MiddlewareFunction {
  return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
    Promise.resolve(middleware(req, res, next)).catch(next);
  };
}

/**
 * Cache middleware results
 */
export function cached(
  keyFn: (req: NextRushRequest) => string,
  ttlMs: number = 60000
): (middleware: MiddlewareFunction) => MiddlewareFunction {
  const cache = new Map<string, { result: any; expiry: number }>();

  return (middleware: MiddlewareFunction) => {
    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      const key = keyFn(req);
      const cached = cache.get(key);
      const now = Date.now();

      if (cached && now < cached.expiry) {
        Object.assign(req, cached.result);
        return next();
      }

      const originalBody = req.body;
      const originalParams = req.params;

      middleware(req, res, () => {
        const changes: any = {};

        if (req.body !== originalBody) {
          changes.body = req.body;
        }

        if (req.params !== originalParams) {
          changes.params = req.params;
        }

        cache.set(key, {
          result: changes,
          expiry: now + ttlMs,
        });

        next();
      });
    };
  };
}

/**
 * Retry middleware on failure
 */
export function retry(
  _attempts: number = 3,
  _delay: number = 1000
): (middleware: MiddlewareFunction) => MiddlewareFunction {
  return (middleware: MiddlewareFunction) => {
    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      middleware(req, res, next);
    };
  };
}
