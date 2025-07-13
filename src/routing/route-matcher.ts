/**
 * Route matcher - handles route pattern matching and parameter extraction
 */
import { Path, Route, RouteMatch } from '../types/routing';
import { matchPath } from '../utils/path-utils';

export interface RouteMatcherOptions {
  caseSensitive?: boolean;
  strict?: boolean;
}

export class RouteMatcher {
  private options: RouteMatcherOptions;

  constructor(options: RouteMatcherOptions = {}) {
    this.options = {
      caseSensitive: false,
      strict: false,
      ...options,
    };
  }

  /**
   * Check if a request path matches a route pattern
   */
  match(requestPath: string, route: Route): RouteMatch | null {
    const normalizedPath = this.normalizePath(requestPath);
    const result = this.matchPattern(normalizedPath, route.path);

    if (!result.isMatch) {
      return null;
    }

    return {
      route,
      params: result.params,
    };
  }

  /**
   * Find the first matching route from a list of routes
   */
  findMatch(requestPath: string, routes: Route[]): RouteMatch | null {
    for (const route of routes) {
      const match = this.match(requestPath, route);
      if (match) {
        return match;
      }
    }
    return null;
  }

  /**
   * Find all matching routes from a list of routes
   */
  findAllMatches(requestPath: string, routes: Route[]): RouteMatch[] {
    const matches: RouteMatch[] = [];

    for (const route of routes) {
      const match = this.match(requestPath, route);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  }

  private matchPattern(
    path: string,
    pattern: Path
  ): { isMatch: boolean; params: Record<string, string> } {
    if (typeof pattern === 'string') {
      const normalizedPattern = this.normalizePath(pattern);
      return matchPath(path, normalizedPattern);
    }

    // Handle RegExp patterns
    if (pattern instanceof RegExp) {
      const isMatch = pattern.test(path);
      return { isMatch, params: {} };
    }

    return { isMatch: false, params: {} };
  }

  private normalizePath(path: string): string {
    if (!this.options.caseSensitive) {
      path = path.toLowerCase();
    }

    if (!this.options.strict) {
      // Remove trailing slash unless it's the root path
      if (path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
      }
    }

    return path;
  }

  /**
   * Configure the matcher options
   */
  configure(options: Partial<RouteMatcherOptions>): void {
    this.options = { ...this.options, ...options };
  }
}
