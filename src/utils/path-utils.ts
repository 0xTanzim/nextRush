/**
 * Path utilities - pure functions for path manipulation and validation
 */

/**
 * Normalize path by removing leading/trailing slashes and double slashes
 */
export function normalizePath(path: string): string {
  return path
    .replace(/\/+/g, '/') // Replace multiple slashes with single slash
    .replace(/^\/+|\/+$/g, ''); // Remove leading and trailing slashes
}

/**
 * Join multiple path segments
 */
export function joinPaths(...segments: string[]): string {
  return '/' + segments.filter(Boolean).map(normalizePath).join('/');
}

/**
 * Extract path parameters from URL pattern
 * Example: "/users/:id/posts/:postId" -> ["id", "postId"]
 */
export function extractParamNames(pattern: string): string[] {
  const matches = pattern.match(/:([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
  return matches ? matches.map((match) => match.slice(1)) : [];
}

/**
 * Convert path pattern to RegExp
 * Example: "/users/:id" -> /^\/users\/([^\/]+)$/
 */
export function pathToRegExp(pattern: string): {
  regexp: RegExp;
  paramNames: string[];
} {
  const paramNames = extractParamNames(pattern);

  // Escape special regex characters except for parameter placeholders
  let regexPattern = pattern
    .replace(/[.+*?^${}()|[\]\\]/g, '\\$&') // Escape special chars
    .replace(/:([a-zA-Z_$][a-zA-Z0-9_$]*)/g, '([^/]+)'); // Replace :param with capture group

  // Ensure exact match
  regexPattern = `^${regexPattern}$`;

  return {
    regexp: new RegExp(regexPattern),
    paramNames,
  };
}

/**
 * Match path against pattern and extract parameters
 */
export function matchPath(
  path: string,
  pattern: string | RegExp
): {
  isMatch: boolean;
  params: Record<string, string>;
} {
  if (pattern instanceof RegExp) {
    const match = path.match(pattern);
    return {
      isMatch: !!match,
      params: {}, // RegExp patterns don't extract named params
    };
  }

  const { regexp, paramNames } = pathToRegExp(pattern);
  const match = path.match(regexp);

  if (!match) {
    return { isMatch: false, params: {} };
  }

  const params: Record<string, string> = {};
  paramNames.forEach((name, index) => {
    params[name] = match[index + 1];
  });

  return { isMatch: true, params };
}

/**
 * Validate if path is safe (prevent directory traversal)
 */
export function isSafePath(path: string): boolean {
  const normalized = normalizePath(path);
  return !normalized.includes('..') && !normalized.startsWith('/');
}

/**
 * Get file extension from path
 */
export function getExtension(path: string): string {
  const lastDot = path.lastIndexOf('.');
  return lastDot === -1 ? '' : path.slice(lastDot);
}
