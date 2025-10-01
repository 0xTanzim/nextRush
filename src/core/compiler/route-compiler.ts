/**
 * Route Compiler for NextRush v2
 *
 * Pre-compiles routes during app.listen() for maximum performance:
 * - Generates optimized route lookup tables
 * - Inlines middleware chains
 * - Pre-extracts parameter patterns
 * - Eliminates runtime overhead
 *
 * @packageDocumentation
 */

import type { Context, Middleware, RouteHandler } from '@/types/context';

/**
 * Compiled route entry with optimized execution path
 */
export interface CompiledRoute {
  /** Pre-compiled handler with inlined middleware */
  execute: (ctx: Context) => Promise<void>;
  /** Original handler for debugging */
  handler: RouteHandler;
  /** Parameter extraction function (pre-compiled) */
  extractParams: (path: string) => Record<string, string> | null;
  /** Route pattern */
  pattern: string;
  /** HTTP method */
  method: string;
  /** Compiled at timestamp */
  compiledAt: number;
}

/**
 * Route compilation statistics
 */
export interface CompilationStats {
  totalRoutes: number;
  compiledRoutes: number;
  inlinedMiddleware: number;
  compilationTime: number;
  memoryUsed: number;
}

/**
 * Route Compiler - Pre-compiles routes for ultra-fast execution
 */
export class RouteCompiler {
  private compiledRoutes = new Map<string, CompiledRoute>();
  private stats: CompilationStats = {
    totalRoutes: 0,
    compiledRoutes: 0,
    inlinedMiddleware: 0,
    compilationTime: 0,
    memoryUsed: 0,
  };

  /**
   * Compile a route with its middleware chain
   */
  public compileRoute(
    method: string,
    pattern: string,
    handler: RouteHandler,
    middleware: Middleware[] = []
  ): CompiledRoute {
    const startTime = Date.now();
    const routeKey = `${method}:${pattern}`;

    // Pre-compile parameter extractor
    const extractParams = this.compileParamExtractor(pattern);

    // Inline middleware chain with handler
    const execute = this.inlineMiddlewareChain(handler, middleware);

    const compiled: CompiledRoute = {
      execute,
      handler,
      extractParams,
      pattern,
      method,
      compiledAt: Date.now(),
    };

    this.compiledRoutes.set(routeKey, compiled);

    this.stats.totalRoutes++;
    this.stats.compiledRoutes++;
    this.stats.inlinedMiddleware += middleware.length;
    this.stats.compilationTime += Date.now() - startTime;

    return compiled;
  }

  /**
   * Get compiled route by key
   */
  public getCompiledRoute(
    method: string,
    pattern: string
  ): CompiledRoute | undefined {
    return this.compiledRoutes.get(`${method}:${pattern}`);
  }

  /**
   * Get all compiled routes
   */
  public getAllCompiledRoutes(): Map<string, CompiledRoute> {
    return new Map(this.compiledRoutes);
  }

  /**
   * Get compilation statistics
   */
  public getStats(): CompilationStats {
    return { ...this.stats };
  }

  /**
   * Clear compiled routes
   */
  public clear(): void {
    this.compiledRoutes.clear();
    this.stats = {
      totalRoutes: 0,
      compiledRoutes: 0,
      inlinedMiddleware: 0,
      compilationTime: 0,
      memoryUsed: 0,
    };
  }

  /**
   * Pre-compile parameter extractor function
   * Generates optimized param extraction based on route pattern
   */
  private compileParamExtractor(
    pattern: string
  ): (path: string) => Record<string, string> | null {
    const segments = pattern.split('/').filter(Boolean);
    const paramIndices: Array<{ index: number; name: string }> = [];

    // Find parameter positions
    segments.forEach((segment, index) => {
      if (segment.startsWith(':')) {
        paramIndices.push({
          index,
          name: segment.slice(1),
        });
      }
    });

    // No params? Return fast path
    if (paramIndices.length === 0) {
      return () => ({});
    }

    // Generate optimized extractor
    return (path: string) => {
      const pathSegments = path.split('/').filter(Boolean);
      const params: Record<string, string> = {};

      // Direct indexed access - O(1) per param
      for (const { index, name } of paramIndices) {
        const value = pathSegments[index];
        if (value === undefined) {
          return null;
        }
        params[name] = value;
      }

      return params;
    };
  }

  /**
   * Inline middleware chain into single optimized function
   * Eliminates dispatch overhead and function call stack
   *
   * SMART: Detects if handler is sync or async and optimizes accordingly
   */
  private inlineMiddlewareChain(
    handler: RouteHandler,
    middleware: Middleware[]
  ): (ctx: Context) => Promise<void> {
    // No middleware? Optimize based on handler type
    if (middleware.length === 0) {
      // Check if handler is async
      const isAsync =
        handler.constructor.name === 'AsyncFunction' ||
        handler.toString().includes('async ') ||
        handler.toString().includes('await ');

      if (isAsync) {
        return async (ctx: Context) => {
          await handler(ctx);
        };
      } else {
        // Sync handler - minimal Promise overhead
        return async (ctx: Context) => {
          handler(ctx);
        };
      }
    }

    // Single middleware? Inline it directly
    if (middleware.length === 1) {
      const mw = middleware[0]!;
      return async (ctx: Context) => {
        await mw(ctx, async () => {
          await handler(ctx);
        });
      };
    }

    // Multiple middleware: Create optimized execution chain
    // Most routes have async handlers, so default to async path
    return async (ctx: Context) => {
      let index = -1;

      const dispatch = async (i: number): Promise<void> => {
        if (i <= index) {
          throw new Error('next() called multiple times');
        }
        index = i;

        if (i < middleware.length) {
          const mw = middleware[i]!;
          await mw(ctx, () => dispatch(i + 1));
        } else {
          await handler(ctx);
        }
      };

      await dispatch(0);
    };
  }

  /**
   * Advanced: Analyze middleware for sync/async and inline accordingly
   * TODO: Use this for future optimizations to inline sync middleware
   */
  // @ts-ignore - Reserved for future use
  private analyzeMiddleware(middleware: Middleware[]): {
    sync: Middleware[];
    async: Middleware[];
  } {
    const sync: Middleware[] = [];
    const async: Middleware[] = [];

    for (const mw of middleware) {
      // Check if middleware is async (returns Promise)
      const isAsync =
        mw.constructor.name === 'AsyncFunction' ||
        mw.toString().includes('async');

      if (isAsync) {
        async.push(mw);
      } else {
        sync.push(mw);
      }
    }

    return { sync, async };
  }
}

/**
 * Global route compiler instance
 */
export const globalRouteCompiler = new RouteCompiler();

/**
 * Create a new route compiler
 */
export function createRouteCompiler(): RouteCompiler {
  return new RouteCompiler();
}
