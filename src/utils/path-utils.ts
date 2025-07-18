/**
 * Path Utilities - URL and path matching utilities
 */

export interface PathMatch {
  path: string;
  params: Record<string, string>;
  isMatch: boolean;
}

/**
 * Convert a path pattern to a regular expression
 */
export function pathToRegex(path: string): RegExp {
  // Handle exact matches
  if (!path.includes(':') && !path.includes('*')) {
    return new RegExp(`^${escapeRegex(path)}/?$`);
  }

  // Escape special regex characters FIRST, but preserve : and * for parameter conversion
  let regexPath = path.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

  // Convert path parameters to regex groups
  regexPath = regexPath
    // Handle :param patterns
    .replace(/:([^/]+)/g, '([^/]+)')
    // Handle wildcard patterns
    .replace(/\*/g, '(.*)');

  return new RegExp(`^${regexPath}/?$`);
}

/**
 * Match a URL path against a pattern
 */
export function matchPath(pattern: string, path: string): PathMatch {
  const regex = pathToRegex(pattern);
  const match = path.match(regex);

  if (!match) {
    return {
      path: pattern,
      params: {},
      isMatch: false,
    };
  }

  // Extract parameter names from pattern
  const paramNames = extractParamNames(pattern);
  const params: Record<string, string> = {};

  // Map matched groups to parameter names
  for (let i = 0; i < paramNames.length; i++) {
    const paramName = paramNames[i];
    const paramValue = match[i + 1];
    if (paramName && paramValue !== undefined) {
      params[paramName] = decodeURIComponent(paramValue);
    }
  }

  return {
    path: pattern,
    params,
    isMatch: true,
  };
}

/**
 * Extract parameter names from a path pattern
 */
function extractParamNames(pattern: string): string[] {
  const paramRegex = /:([^/]+)/g;
  const params: string[] = [];
  let match;

  while ((match = paramRegex.exec(pattern)) !== null) {
    params.push(match[1]);
  }

  return params;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize a path by removing double slashes and trailing slashes
 */
export function normalizePath(path: string): string {
  return path
    .replace(/\/+/g, '/') // Replace multiple slashes with single slash
    .replace(/\/$/, '') // Remove trailing slash
    .replace(/^$/, '/'); // Ensure root path is '/'
}

/**
 * Join path segments
 */
export function joinPaths(...segments: string[]): string {
  return normalizePath(segments.join('/'));
}

/**
 * Check if a path matches any of the given patterns
 */
export function matchesAnyPattern(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchPath(pattern, path).isMatch);
}
