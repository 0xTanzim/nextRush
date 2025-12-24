/**
 * Application Compiler for NextRush v2
 *
 * Orchestrates pre-compilation of routes, middleware, and dependencies
 * during app.listen() for maximum runtime performance.
 *
 * @packageDocumentation
 */

import type { DIContainer } from '../di/container.js';
import type { OptimizedRouter } from '../router/optimized-router.js';
import { DIPreloader } from './di-preloader.js';
import { RouteCompiler } from './route-compiler.js';

/**
 * Overall compilation statistics
 */
export interface CompilerStats {
  routes: {
    total: number;
    compiled: number;
    inlinedMiddleware: number;
  };
  dependencies: {
    preloaded: number;
    resolutionTime: number;
  };
  compilation: {
    totalTime: number;
    startedAt: number;
    completedAt: number;
  };
  performance: {
    estimatedSpeedup: string;
    optimizationLevel: 'none' | 'basic' | 'aggressive' | 'maximum';
  };
}

/**
 * Application Compiler - Pre-compiles entire app for production
 */
export class ApplicationCompiler {
  private routeCompiler: RouteCompiler;
  private diPreloader: DIPreloader;
  private isCompiled = false;
  private stats: CompilerStats | null = null;

  constructor() {
    this.routeCompiler = new RouteCompiler();
    this.diPreloader = new DIPreloader();
  }

  /**
   * Compile the entire application
   */
  public async compile(
    router: OptimizedRouter,
    container?: DIContainer
  ): Promise<CompilerStats> {
    if (this.isCompiled) {
      return this.stats!;
    }

    const startTime = Date.now();

    // Step 1: Compile routes
    const routeStats = await this.compileRoutes(router);

    // Step 2: Pre-load dependencies
    let diStats = { preloaded: 0, resolutionTime: 0 };
    if (container) {
      diStats = await this.preloadDependencies(container);
    }

    const totalTime = Date.now() - startTime;

    // Calculate optimization level
    const optimizationLevel = this.calculateOptimizationLevel(
      routeStats.compiled,
      routeStats.inlinedMiddleware,
      diStats.preloaded
    );

    // Estimate performance improvement
    const estimatedSpeedup = this.estimateSpeedup(optimizationLevel);

    this.stats = {
      routes: routeStats,
      dependencies: diStats,
      compilation: {
        totalTime,
        startedAt: startTime,
        completedAt: Date.now(),
      },
      performance: {
        estimatedSpeedup,
        optimizationLevel,
      },
    };

    this.isCompiled = true;

    return this.stats;
  }

  /**
   * Compile all routes from router
   */
  private async compileRoutes(router: OptimizedRouter): Promise<{
    total: number;
    compiled: number;
    inlinedMiddleware: number;
  }> {
    const routes = router.getRoutes();
    let compiled = 0;
    let inlinedMiddleware = 0;

    for (const [routeKey, routeData] of routes) {
      const [method, pattern] = routeKey.split(':');
      if (!method || !pattern) continue;

      const middleware = routeData.middleware || [];

      // Compile the route
      const compiledRoute = this.routeCompiler.compileRoute(
        method,
        pattern,
        routeData.handler,
        middleware
      );

      // 🔥 INJECT compiled handler into router!
      router.setCompiledHandler(method, pattern, compiledRoute.execute);

      compiled++;
      inlinedMiddleware += middleware.length;
    }

    return {
      total: routes.size,
      compiled,
      inlinedMiddleware,
    };
  }

  /**
   * Pre-load all dependencies
   */
  private async preloadDependencies(container: DIContainer): Promise<{
    preloaded: number;
    resolutionTime: number;
  }> {
    const startTime = Date.now();
    await this.diPreloader.preloadContainer(container);

    const stats = this.diPreloader.getStats();
    return {
      preloaded: stats.totalPreloaded,
      resolutionTime: Date.now() - startTime,
    };
  }

  /**
   * Calculate optimization level based on compilation results
   */
  private calculateOptimizationLevel(
    compiledRoutes: number,
    inlinedMiddleware: number,
    preloadedDeps: number
  ): 'none' | 'basic' | 'aggressive' | 'maximum' {
    const score = compiledRoutes * 2 + inlinedMiddleware + preloadedDeps;

    if (score === 0) return 'none';
    if (score < 10) return 'basic';
    if (score < 50) return 'aggressive';
    return 'maximum';
  }

  /**
   * Estimate performance speedup based on optimization level
   */
  private estimateSpeedup(
    level: 'none' | 'basic' | 'aggressive' | 'maximum'
  ): string {
    const speedups = {
      none: '1x (no optimization)',
      basic: '1.3-1.5x faster',
      aggressive: '1.8-2.2x faster',
      maximum: '2.5-3x faster',
    };

    return speedups[level];
  }

  /**
   * Get compiled route
   */
  public getCompiledRoute(method: string, pattern: string) {
    return this.routeCompiler.getCompiledRoute(method, pattern);
  }

  /**
   * Get pre-loaded dependency
   */
  public getPreloadedDependency<T>(token: string | symbol): T | undefined {
    return this.diPreloader.get<T>(token);
  }

  /**
   * Check if application is compiled
   */
  public isApplicationCompiled(): boolean {
    return this.isCompiled;
  }

  /**
   * Get compilation statistics
   */
  public getStats(): CompilerStats | null {
    return this.stats;
  }

  /**
   * Reset compilation state
   */
  public reset(): void {
    this.routeCompiler.clear();
    this.diPreloader.clear();
    this.isCompiled = false;
    this.stats = null;
  }
}

/**
 * Create a new application compiler
 */
export function createApplicationCompiler(): ApplicationCompiler {
  return new ApplicationCompiler();
}
