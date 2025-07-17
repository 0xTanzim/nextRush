/**
 * 🔗 NextRush Middleware Composition
 * Advanced middleware composition utilities for elegant middleware chains
 */

import { NextRushRequest, NextRushResponse } from '../types/express';
import { ErrorMiddleware, Middleware, NextFunction } from './types';

export type ConditionalPredicate = (
  req: NextRushRequest,
  res: NextRushResponse
) => boolean;
export type AsyncMiddleware = (
  req: NextRushRequest,
  res: NextRushResponse,
  next: NextFunction
) => Promise<void>;

/**
 * 🎯 Compose Multiple Middleware
 * Combines multiple middleware functions into a single middleware
 */
export function compose(...middlewares: Middleware[]): Middleware {
  if (middlewares.length === 0) {
    return (req, res, next) => next();
  }

  if (middlewares.length === 1) {
    return middlewares[0];
  }

  return (req: NextRushRequest, res: NextRushResponse, next: NextFunction) => {
    let index = -1;

    function dispatch(i: number): void {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }

      index = i;
      const middleware = middlewares[i];

      if (!middleware) {
        return next();
      }

      try {
        middleware(req, res, () => dispatch(i + 1));
      } catch (error) {
        next(error);
      }
    }

    dispatch(0);
  };
}

/**
 * 🔄 Async Middleware Wrapper
 * Wraps async middleware to handle promise rejections
 */
export function asyncWrapper(middleware: AsyncMiddleware): Middleware {
  return (req: NextRushRequest, res: NextRushResponse, next: NextFunction) => {
    Promise.resolve(middleware(req, res, next)).catch(next);
  };
}

/**
 * ✅ Conditional Middleware - When
 * Executes middleware only when condition is true
 */
export function when(
  predicate: ConditionalPredicate | boolean,
  ...middlewares: Middleware[]
): Middleware {
  const composedMiddleware = compose(...middlewares);

  return (req: NextRushRequest, res: NextRushResponse, next: NextFunction) => {
    const shouldExecute =
      typeof predicate === 'function' ? predicate(req, res) : predicate;

    if (shouldExecute) {
      composedMiddleware(req, res, next);
    } else {
      next();
    }
  };
}

/**
 * ❌ Conditional Middleware - Unless
 * Executes middleware only when condition is false
 */
export function unless(
  predicate: ConditionalPredicate | boolean,
  ...middlewares: Middleware[]
): Middleware {
  return when(
    typeof predicate === 'function'
      ? (req, res) => !predicate(req, res)
      : !predicate,
    ...middlewares
  );
}

/**
 * 🎭 Named Middleware
 * Adds a name property to middleware for debugging
 */
export function named(
  name: string,
  middleware: Middleware
): Middleware & { middlewareName: string } {
  const namedMiddleware = (
    req: NextRushRequest,
    res: NextRushResponse,
    next: NextFunction
  ) => {
    middleware(req, res, next);
  };

  namedMiddleware.middlewareName = name;
  return namedMiddleware as Middleware & { middlewareName: string };
}

/**
 * ⏰ Timeout Middleware
 * Adds timeout to middleware execution
 */
export function timeout(ms: number, message?: string): Middleware {
  return (req: NextRushRequest, res: NextRushResponse, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        const error = new Error(
          message || `Request timeout after ${ms}ms`
        ) as any;
        error.status = 408;
        error.statusCode = 408;
        error.timeout = true;
        next(error);
      }
    }, ms);

    // Clear timeout when response is sent
    const originalEnd = res.end.bind(res);
    res.end = function (...args: any[]) {
      clearTimeout(timer);
      return (originalEnd as any).apply(res, args);
    } as any;

    next();
  };
}

/**
 * 🔁 Retry Middleware
 * Retries middleware execution on failure
 */
export function retry(
  attempts: number,
  middleware: Middleware,
  shouldRetry?: (error: any, attempt: number) => boolean
): Middleware {
  return (req: NextRushRequest, res: NextRushResponse, next: NextFunction) => {
    let attempt = 0;

    function tryMiddleware() {
      attempt++;

      middleware(req, res, (error?: any) => {
        if (error && attempt < attempts) {
          if (!shouldRetry || shouldRetry(error, attempt)) {
            return tryMiddleware();
          }
        }
        next(error);
      });
    }

    tryMiddleware();
  };
}

/**
 * 🎯 Path-based Middleware
 * Executes middleware only for specific paths
 */
export function path(
  pathPattern: string | RegExp | ((path: string) => boolean),
  ...middlewares: Middleware[]
): Middleware {
  const composedMiddleware = compose(...middlewares);

  return (req: NextRushRequest, res: NextRushResponse, next: NextFunction) => {
    const reqPath = req.path || req.url?.split('?')[0] || '/';
    let matches = false;

    if (typeof pathPattern === 'string') {
      matches =
        reqPath === pathPattern ||
        reqPath.startsWith(
          pathPattern.endsWith('/') ? pathPattern : pathPattern + '/'
        );
    } else if (pathPattern instanceof RegExp) {
      matches = pathPattern.test(reqPath);
    } else if (typeof pathPattern === 'function') {
      matches = pathPattern(reqPath);
    }

    if (matches) {
      composedMiddleware(req, res, next);
    } else {
      next();
    }
  };
}

/**
 * 🔧 Method-based Middleware
 * Executes middleware only for specific HTTP methods
 */
export function method(
  methods: string | string[],
  ...middlewares: Middleware[]
): Middleware {
  const allowedMethods = Array.isArray(methods)
    ? methods.map((m) => m.toUpperCase())
    : [methods.toUpperCase()];

  const composedMiddleware = compose(...middlewares);

  return (req: NextRushRequest, res: NextRushResponse, next: NextFunction) => {
    if (req.method && allowedMethods.includes(req.method.toUpperCase())) {
      composedMiddleware(req, res, next);
    } else {
      next();
    }
  };
}

/**
 * 🚫 Error Handling Middleware Composer
 * Composes error handling middleware
 */
export function errorCompose(
  ...errorMiddlewares: ErrorMiddleware[]
): ErrorMiddleware {
  if (errorMiddlewares.length === 0) {
    return (error, req, res, next) => next(error);
  }

  if (errorMiddlewares.length === 1) {
    return errorMiddlewares[0];
  }

  return (
    error: any,
    req: NextRushRequest,
    res: NextRushResponse,
    next: NextFunction
  ) => {
    let index = -1;

    function dispatch(i: number, err?: any): void {
      if (i <= index) {
        throw new Error('next() called multiple times in error middleware');
      }

      index = i;
      const middleware = errorMiddlewares[i];

      if (!middleware) {
        return next(err);
      }

      try {
        middleware(err || error, req, res, (nextErr?: any) =>
          dispatch(i + 1, nextErr)
        );
      } catch (catchError) {
        next(catchError);
      }
    }

    dispatch(0);
  };
}

/**
 * 🎪 Parallel Middleware Execution
 * Executes multiple middleware in parallel (useful for independent operations)
 */
export function parallel(...middlewares: Middleware[]): Middleware {
  return (req: NextRushRequest, res: NextRushResponse, next: NextFunction) => {
    if (middlewares.length === 0) {
      return next();
    }

    let completed = 0;
    let hasError = false;

    const handleComplete = (error?: any) => {
      if (hasError) return;

      if (error) {
        hasError = true;
        return next(error);
      }

      completed++;
      if (completed === middlewares.length) {
        next();
      }
    };

    middlewares.forEach((middleware) => {
      try {
        middleware(req, res, handleComplete);
      } catch (error) {
        handleComplete(error);
      }
    });
  };
}

/**
 * 🏃‍♂️ Race Middleware
 * Executes middleware in parallel but continues with the first to complete
 */
export function race(...middlewares: Middleware[]): Middleware {
  return (req: NextRushRequest, res: NextRushResponse, next: NextFunction) => {
    if (middlewares.length === 0) {
      return next();
    }

    let completed = false;

    const handleComplete = (error?: any) => {
      if (completed) return;
      completed = true;
      next(error);
    };

    middlewares.forEach((middleware) => {
      try {
        middleware(req, res, handleComplete);
      } catch (error) {
        handleComplete(error);
      }
    });
  };
}

/**
 * 🔄 Pipeline Middleware
 * Creates a pipeline where each middleware can transform the result
 */
export function pipeline<T = any>(
  ...processors: Array<
    (data: T, req: NextRushRequest, res: NextRushResponse) => T | Promise<T>
  >
): Middleware {
  return async (
    req: NextRushRequest,
    res: NextRushResponse,
    next: NextFunction
  ) => {
    try {
      let data = req.body || ({} as T);

      for (const processor of processors) {
        data = await Promise.resolve(processor(data, req, res));
      }

      req.body = data;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * 🎯 Smart Router Middleware
 * Advanced routing with pattern matching and parameter extraction
 */
export function smartRoute(
  pattern: string,
  middleware: Middleware,
  options: {
    caseSensitive?: boolean;
    strict?: boolean;
    end?: boolean;
  } = {}
): Middleware {
  const { caseSensitive = false, strict = false, end = true } = options;

  // Convert route pattern to regex
  const keys: string[] = [];
  let regexPattern = pattern
    .replace(/\//g, '\\/')
    .replace(/:([^/]+)/g, (match, key) => {
      keys.push(key);
      return '([^/]+)';
    })
    .replace(/\*/g, '(.*)');

  if (!strict) {
    regexPattern += '\\/?';
  }

  if (end) {
    regexPattern += '$';
  }

  const regex = new RegExp(`^${regexPattern}`, caseSensitive ? '' : 'i');

  return (req: NextRushRequest, res: NextRushResponse, next: NextFunction) => {
    const path = req.path || req.url?.split('?')[0] || '/';
    const match = regex.exec(path);

    if (!match) {
      return next();
    }

    // Extract parameters
    req.params = req.params || {};
    keys.forEach((key, index) => {
      req.params[key] = decodeURIComponent(match[index + 1] || '');
    });

    middleware(req, res, next);
  };
}

/**
 * 🔧 Middleware Builder Pattern
 * Fluent interface for building complex middleware chains
 */
export class MiddlewareBuilder {
  private middlewares: Middleware[] = [];

  add(...middlewares: Middleware[]): this {
    this.middlewares.push(...middlewares);
    return this;
  }

  when(
    predicate: ConditionalPredicate | boolean,
    ...middlewares: Middleware[]
  ): this {
    return this.add(when(predicate, ...middlewares));
  }

  unless(
    predicate: ConditionalPredicate | boolean,
    ...middlewares: Middleware[]
  ): this {
    return this.add(unless(predicate, ...middlewares));
  }

  timeout(ms: number, message?: string): this {
    return this.add(timeout(ms, message));
  }

  path(
    pathPattern: string | RegExp | ((path: string) => boolean),
    ...middlewares: Middleware[]
  ): this {
    return this.add(path(pathPattern, ...middlewares));
  }

  method(methods: string | string[], ...middlewares: Middleware[]): this {
    return this.add(method(methods, ...middlewares));
  }

  named(name: string, middleware: Middleware): this {
    return this.add(named(name, middleware));
  }

  async(middleware: AsyncMiddleware): this {
    return this.add(asyncWrapper(middleware));
  }

  build(): Middleware {
    return compose(...this.middlewares);
  }

  buildNamed(name: string): Middleware & { middlewareName: string } {
    return named(name, this.build());
  }
}

/**
 * 🏗️ Create Middleware Builder
 * Factory function for creating middleware builders
 */
export function createBuilder(): MiddlewareBuilder {
  return new MiddlewareBuilder();
}

/**
 * 🎭 Middleware Stack
 * Advanced middleware stack with lifecycle hooks
 */
export class MiddlewareStack {
  private beforeHooks: Middleware[] = [];
  private middlewares: Middleware[] = [];
  private afterHooks: Middleware[] = [];
  private errorHandlers: ErrorMiddleware[] = [];

  before(...middlewares: Middleware[]): this {
    this.beforeHooks.push(...middlewares);
    return this;
  }

  add(...middlewares: Middleware[]): this {
    this.middlewares.push(...middlewares);
    return this;
  }

  after(...middlewares: Middleware[]): this {
    this.afterHooks.push(...middlewares);
    return this;
  }

  catch(...errorHandlers: ErrorMiddleware[]): this {
    this.errorHandlers.push(...errorHandlers);
    return this;
  }

  build(): Middleware {
    const allMiddleware = [
      ...this.beforeHooks,
      ...this.middlewares,
      ...this.afterHooks,
    ];

    const composedMiddleware = compose(...allMiddleware);

    if (this.errorHandlers.length === 0) {
      return composedMiddleware;
    }

    // Wrap with error handling
    return (
      req: NextRushRequest,
      res: NextRushResponse,
      next: NextFunction
    ) => {
      composedMiddleware(req, res, (error?: any) => {
        if (error && this.errorHandlers.length > 0) {
          const errorHandler = errorCompose(...this.errorHandlers);
          return errorHandler(error, req, res, next);
        }
        next(error);
      });
    };
  }
}

/**
 * 🎪 Create Middleware Stack
 * Factory function for creating middleware stacks
 */
export function createStack(): MiddlewareStack {
  return new MiddlewareStack();
}
