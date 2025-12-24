/**
 * Ultra-fast path splitter for NextRush v2 Router
 *
 * Optimized path parsing with caching for high-frequency routes.
 *
 * Performance optimizations:
 * - Zero-copy path splitting where possible
 * - LRU-style caching for frequently accessed paths
 * - Pre-compiled character codes for fast detection
 *
 * @packageDocumentation
 */

import { ROUTER_CONSTANTS } from '@/core/constants';

/**
 * Ultra-fast path splitter with optimized splitting algorithm
 */
export class PathSplitter {
  private static readonly CACHE_SIZE = ROUTER_CONSTANTS.PATH_CACHE_SIZE;
  private static pathCache = new Map<string, string[]>();

  // Pre-compiled common patterns for faster detection
  private static readonly PARAM_CHAR_CODE = 58; // ':'
  private static readonly SLASH_CHAR_CODE = 47; // '/'

  /**
   * Get cache size for statistics
   */
  static getCacheSize(): number {
    return this.pathCache.size;
  }

  /**
   * Split a URL path into segments
   *
   * @param path - URL path to split
   * @returns Array of path segments (excludes empty and leading slash)
   *
   * @example
   * ```typescript
   * PathSplitter.split('/users/123/profile')
   * // Returns: ['users', '123', 'profile']
   * ```
   */
  static split(path: string): string[] {
    if (path === '/' || path === '') return [];

    // Check cache first for frequently used paths
    const cached = this.pathCache.get(path);
    if (cached) {
      return cached;
    }

    const parts: string[] = [];
    let start = path.charCodeAt(0) === this.SLASH_CHAR_CODE ? 1 : 0;

    // Ultra-optimized splitting using single pass with charCodeAt
    for (let i = start; i <= path.length; i++) {
      const charCode =
        i < path.length ? path.charCodeAt(i) : this.SLASH_CHAR_CODE;

      if (charCode === this.SLASH_CHAR_CODE || i === path.length) {
        if (i > start) {
          parts.push(path.substring(start, i));
        }
        start = i + 1;
      }
    }

    // Cache result for future lookups
    if (this.pathCache.size < this.CACHE_SIZE) {
      this.pathCache.set(path, parts);
    }

    return parts;
  }

  /**
   * Clear the path cache
   */
  static clearCache(): void {
    this.pathCache.clear();
  }

  /**
   * Ultra-fast parameter detection
   *
   * @param segment - Path segment to check
   * @returns true if segment starts with ':'
   */
  static isParameterized(segment: string): boolean {
    return segment.length > 0 && segment.charCodeAt(0) === this.PARAM_CHAR_CODE;
  }

  /**
   * Extract parameter name from path segment
   *
   * @param segment - Path segment (e.g., ':id')
   * @returns Parameter name without colon, or null if not a parameter
   *
   * @example
   * ```typescript
   * PathSplitter.extractParamName(':userId')
   * // Returns: 'userId'
   * ```
   */
  static extractParamName(segment: string): string | null {
    return this.isParameterized(segment) ? segment.substring(1) : null;
  }
}
