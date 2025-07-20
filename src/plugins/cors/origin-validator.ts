/**
 * 🔥 CORS Origin Validator - High-Performance Origin Validation
 * Memory-optimized with smart caching and zero leaks
 */

import {
  CorsOrigin,
  CorsOriginFunction,
  OriginValidationResult,
} from './types';

export class OriginValidator {
  private cache = new Map<string, OriginValidationResult>();
  private readonly maxCacheSize = 10000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Static properties for global cleanup management
  private static processListenersAdded = false;
  private static instances = new Set<OriginValidator>();

  constructor(
    private readonly cacheTtl: number = 300000, // 5 minutes default
    private readonly enableCaching: boolean = true
  ) {
    if (this.enableCaching) {
      this.startCleanupTimer();
    }
  }

  /**
   * 🚀 High-performance origin validation with caching
   */
  async validateOrigin(
    origin: string | undefined,
    corsOrigin: CorsOrigin
  ): Promise<boolean> {
    // Handle undefined origin (mobile apps, Postman, etc.)
    if (!origin) {
      return this.handleUndefinedOrigin(corsOrigin);
    }

    // Check cache first for performance
    if (this.enableCaching) {
      const cached = this.getCachedResult(origin);
      if (cached !== null) {
        return cached;
      }
    }

    // Validate origin
    const isAllowed = await this.performOriginValidation(origin, corsOrigin);

    // Cache result for performance
    if (this.enableCaching) {
      this.cacheResult(origin, isAllowed);
    }

    return isAllowed;
  }

  /**
   * 🚀 Perform actual origin validation
   */
  private async performOriginValidation(
    origin: string,
    corsOrigin: CorsOrigin
  ): Promise<boolean> {
    // Boolean origin (true = allow all, false = deny all)
    if (typeof corsOrigin === 'boolean') {
      return corsOrigin;
    }

    // String origin (exact match)
    if (typeof corsOrigin === 'string') {
      return corsOrigin === origin;
    }

    // Array of origins
    if (Array.isArray(corsOrigin)) {
      return corsOrigin.includes(origin);
    }

    // Function-based validation
    if (typeof corsOrigin === 'function') {
      return this.validateWithFunction(origin, corsOrigin);
    }

    return false;
  }

  /**
   * 🚀 Handle undefined origin cases
   */
  private handleUndefinedOrigin(corsOrigin: CorsOrigin): boolean {
    // Allow undefined origins only if explicitly configured
    if (typeof corsOrigin === 'boolean') {
      return corsOrigin;
    }

    // Conservative approach: deny undefined origins for arrays and strings
    if (typeof corsOrigin === 'string' || Array.isArray(corsOrigin)) {
      return false;
    }

    // Let function decide
    if (typeof corsOrigin === 'function') {
      // Note: This will be async, but we need sync result for undefined
      return false; // Conservative default
    }

    return false;
  }

  /**
   * 🚀 Function-based origin validation with error handling
   */
  private validateWithFunction(
    origin: string,
    corsOriginFn: CorsOriginFunction
  ): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        corsOriginFn(origin, (err, allow) => {
          if (err) {
            console.warn('CORS origin validation error:', err.message);
            resolve(false);
          } else {
            resolve(allow === true);
          }
        });
      } catch (error) {
        console.warn('CORS origin validation exception:', error);
        resolve(false);
      }
    });
  }

  /**
   * 🚀 Get cached validation result
   */
  private getCachedResult(origin: string): boolean | null {
    const cached = this.cache.get(origin);
    if (!cached) {
      return null;
    }

    // Check TTL
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(origin);
      return null;
    }

    return cached.allowed;
  }

  /**
   * 🚀 Cache validation result with memory management
   */
  private cacheResult(origin: string, allowed: boolean): void {
    // Prevent cache overflow
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldestEntries();
    }

    this.cache.set(origin, {
      allowed,
      timestamp: Date.now(),
      ttl: this.cacheTtl,
    });
  }

  /**
   * 🚀 Evict oldest cache entries to prevent memory bloat
   */
  private evictOldestEntries(): void {
    const entriesToRemove = Math.floor(this.maxCacheSize * 0.1); // Remove 10%
    const entries = Array.from(this.cache.entries());

    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * 🚀 Start cleanup timer for expired entries
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.cacheTtl);

    // Only add process listeners once
    if (!OriginValidator.processListenersAdded) {
      OriginValidator.processListenersAdded = true;
      process.on('exit', () => OriginValidator.cleanupAll());
      process.on('SIGINT', () => OriginValidator.cleanupAll());
      process.on('SIGTERM', () => OriginValidator.cleanupAll());
    }

    // Track this instance for cleanup
    OriginValidator.instances.add(this);
  }

  /**
   * 🚀 Clean up expired cache entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    for (const [origin, result] of this.cache.entries()) {
      if (now - result.timestamp > result.ttl) {
        this.cache.delete(origin);
      }
    }
  }

  /**
   * 🚀 Get cache statistics for monitoring
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    memoryUsage: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate: 0, // TODO: Implement hit rate tracking
      memoryUsage: this.estimateCacheMemoryUsage(),
    };
  }

  /**
   * 🚀 Estimate cache memory usage
   */
  private estimateCacheMemoryUsage(): number {
    // Rough estimation: each entry ~100 bytes
    return this.cache.size * 100;
  }

  /**
   * 🚀 Clear cache manually
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 🚀 Cleanup resources
   */
  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    OriginValidator.instances.delete(this);
  }

  /**
   * 🚀 Static cleanup for all instances
   */
  static cleanupAll(): void {
    for (const instance of this.instances) {
      instance.cleanup();
    }
    this.instances.clear();
  }
}
