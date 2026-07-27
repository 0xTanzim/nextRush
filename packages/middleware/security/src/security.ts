/**
 * @nextrush/security - Composite secure-by-default preset (task 8.3)
 *
 * Applies helmet + strict cookies + CSRF + rate limiting behind one call, so
 * the secure configuration is the shortest path (`security-boundaries`
 * capability). Each layer's own constructor already validates and throws on
 * misconfiguration (e.g. `csrf()` requiring `getSessionIdentifier` or an
 * explicit `sessionBinding: 'none'`) — `security()` builds every layer
 * eagerly at call time, so an incomplete required option throws here, not on
 * the first request.
 *
 * @packageDocumentation
 */
import { compose } from '@nextrush/core';
import { cookies } from '@nextrush/cookies';
import { csrf, type CsrfOptions } from '@nextrush/csrf';
import { helmet } from '@nextrush/helmet';
import type { CookieMiddlewareOptions } from '@nextrush/cookies';
import type { HelmetOptions } from '@nextrush/helmet';
import { rateLimit } from '@nextrush/rate-limit';
import type { RateLimitOptions } from '@nextrush/rate-limit';
import type { Middleware } from '@nextrush/types';

/**
 * Per-layer configuration for {@link security}. Every layer is optional
 * except `csrf`, which — like calling `csrf()` directly — requires either
 * `getSessionIdentifier` or an explicit `sessionBinding: 'none'`.
 */
export interface SecurityPresetOptions {
  /** Passed to `helmet()`. Omit for helmet's own secure defaults. */
  helmet?: HelmetOptions;
  /** Passed to `cookies()`. Omit for the framework's `secure: 'auto'` default. */
  cookies?: CookieMiddlewareOptions;
  /** Passed to `csrf()`. Required — the one layer with no safe zero-config default. */
  csrf: CsrfOptions;
  /** Passed to `rateLimit()`. Omit for rate-limit's own defaults. */
  rateLimit?: RateLimitOptions;
}

/**
 * Build the composite secure-by-default middleware: helmet + strict cookies
 * + CSRF protection + rate limiting, applied in that order.
 *
 * @param options - Per-layer configuration. `csrf` is required.
 * @returns A single composed {@link Middleware} suitable for `app.use()`.
 * @throws If any layer's own constructor rejects its configuration —
 *   most commonly `csrf()` when neither `getSessionIdentifier` nor
 *   `sessionBinding: 'none'` is supplied.
 *
 * @example
 * ```typescript
 * import { security } from '@nextrush/security';
 *
 * app.use(security({
 *   csrf: { secret: process.env.CSRF_SECRET!, getSessionIdentifier: (ctx) => ctx.state.sessionId },
 * }));
 * ```
 */
export function security(options: SecurityPresetOptions): Middleware {
  const helmetMiddleware = helmet(options.helmet);
  const cookiesMiddleware = cookies(options.cookies);
  const { protect: csrfMiddleware } = csrf(options.csrf);
  const rateLimitMiddleware = rateLimit(options.rateLimit);

  return compose([helmetMiddleware, cookiesMiddleware, rateLimitMiddleware, csrfMiddleware]);
}
