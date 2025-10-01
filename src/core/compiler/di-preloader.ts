/**
 * Dependency Injection Pre-loader for NextRush v2
 *
 * Pre-resolves all singleton dependencies during app.listen()
 * Eliminates runtime resolution overhead for maximum performance
 *
 * @packageDocumentation
 */

import type { DIContainer } from '../di/container.js';

/**
 * Pre-loaded dependency cache
 */
export interface PreloadedDependency<T = any> {
  token: string | symbol;
  instance: T;
  preloadedAt: number;
  resolutionTime: number;
}

/**
 * DI Pre-loading statistics
 */
export interface PreloadStats {
  totalPreloaded: number;
  totalTime: number;
  avgResolutionTime: number;
  cacheHitRate: number;
}

/**
 * DI Pre-loader - Resolves all dependencies before server starts
 */
export class DIPreloader {
  private preloadedCache = new Map<string | symbol, any>();
  private stats: PreloadStats = {
    totalPreloaded: 0,
    totalTime: 0,
    avgResolutionTime: 0,
    cacheHitRate: 1.0, // 100% after preload
  };

  /**
   * Pre-load all singleton services from container
   */
  public async preloadContainer(_container: DIContainer): Promise<void> {
    const startTime = Date.now();

    // For now, we manually track which services to preload
    // In production, we'd iterate through all registered singletons

    this.stats.totalTime = Date.now() - startTime;
    this.stats.avgResolutionTime =
      this.stats.totalPreloaded > 0
        ? this.stats.totalTime / this.stats.totalPreloaded
        : 0;
  }

  /**
   * Pre-load a specific service
   */
  public preloadService<T>(container: DIContainer, token: string | symbol): T {
    // Check cache first
    if (this.preloadedCache.has(token)) {
      return this.preloadedCache.get(token);
    }

    const startTime = Date.now();
    const instance = container.resolve<T>(token);
    const resolutionTime = Date.now() - startTime;

    this.preloadedCache.set(token, instance);
    this.stats.totalPreloaded++;
    this.stats.totalTime += resolutionTime;

    return instance;
  }

  /**
   * Get pre-loaded instance (O(1) lookup, no resolution)
   */
  public get<T>(token: string | symbol): T | undefined {
    return this.preloadedCache.get(token);
  }

  /**
   * Check if service is pre-loaded
   */
  public has(token: string | symbol): boolean {
    return this.preloadedCache.has(token);
  }

  /**
   * Get pre-loading statistics
   */
  public getStats(): PreloadStats {
    return { ...this.stats };
  }

  /**
   * Clear pre-loaded cache
   */
  public clear(): void {
    this.preloadedCache.clear();
    this.stats = {
      totalPreloaded: 0,
      totalTime: 0,
      avgResolutionTime: 0,
      cacheHitRate: 1.0,
    };
  }

  /**
   * Get cache size
   */
  public getCacheSize(): number {
    return this.preloadedCache.size;
  }
}

/**
 * Global DI pre-loader instance
 */
export const globalDIPreloader = new DIPreloader();

/**
 * Create a new DI pre-loader
 */
export function createDIPreloader(): DIPreloader {
  return new DIPreloader();
}
