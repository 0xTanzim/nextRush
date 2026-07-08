/**
 * @nextrush/decorators - Path normalization utilities
 *
 * Single source of truth for path normalization shared by the controller
 * decorator and the route decorators. These two historically diverged:
 * `@Controller` strips a trailing slash while route decorators (`@Get`, etc.)
 * do not. That divergence is intentional (a controller base path is a prefix,
 * a route path may legitimately end in `/`), so it is preserved behind an
 * explicit option rather than silently unified.
 */

/**
 * Options controlling {@link normalizePath} behavior.
 */
export interface NormalizePathOptions {
  /**
   * Strip a single trailing slash for paths longer than `/`.
   * `@Controller` sets this; route decorators leave it off.
   */
  readonly stripTrailingSlash?: boolean;
}

/**
 * Normalize a path so it starts with exactly one leading slash.
 *
 * By default a trailing slash is preserved (route-decorator semantics). Pass
 * `{ stripTrailingSlash: true }` to also remove a trailing slash for paths
 * longer than `/` (controller semantics).
 */
export function normalizePath(path: string, options: NormalizePathOptions = {}): string {
  let normalized = path.trim();

  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  if (options.stripTrailingSlash && normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}
