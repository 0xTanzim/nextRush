/**
 * @nextrush/cookies - Cookie Middleware
 *
 * Middleware for parsing and setting cookies in NextRush applications.
 * Includes security hardening: CRLF prevention, prefix validation, domain
 * validation, and `secure: 'auto'` transport resolution (SEC-08). Signed
 * cookies live in `signed-middleware.ts`; option presets in
 * `option-presets.ts`.
 *
 * @packageDocumentation
 */

import type { Context, Middleware } from '@nextrush/types';
import type { CookieContext, CookieMiddlewareOptions } from './middleware-types.js';
import { parseCookies } from './parser.js';
import { createDeleteCookie, serializeCookie } from './serializer.js';
import { resolveSecureOption } from './secure-resolution.js';
import type { CookieOptions, ParsedCookies } from './types.js';
import { sanitizeCookieValue } from './validation.js';

export { secureOptions, sessionOptions } from './option-presets.js';
export { signedCookies } from './signed-middleware.js';

/**
 * Create cookie middleware.
 *
 * Parses incoming cookies and provides `ctx.state.cookies` for
 * getting, setting, and deleting cookies.
 *
 * Security Features:
 * - CRLF injection prevention
 * - Cookie prefix validation (__Secure-, __Host-)
 * - Domain/path validation
 * - Size limit enforcement
 * - `secure: 'auto'` by default (SEC-08) — see {@link resolveSecureOption}
 *
 * @param options - Middleware options
 * @returns Cookie middleware
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { cookies } from '@nextrush/cookies';
 *
 * const app = createApp();
 *
 * app.use(cookies());
 *
 * app.use(async (ctx) => {
 *   // Get a cookie
 *   const session = ctx.state.cookies?.get('session');
 *
 *   // Set a cookie (defaults: HttpOnly + SameSite=Lax + Path=/ + Secure auto)
 *   ctx.state.cookies?.set('theme', 'dark', {
 *     maxAge: 86400,
 *     httpOnly: true
 *   });
 *
 *   // Delete a cookie
 *   ctx.state.cookies?.delete('old-cookie');
 *
 *   ctx.json({ session });
 * });
 * ```
 */
export function cookies(options: CookieMiddlewareOptions = {}): Middleware {
  const { decode, trustProxy = false } = options;

  return async function cookiesMiddleware(ctx: Context, next) {
    // Parse incoming cookies from request header. Some proxies / HTTP/2 stacks
    // surface repeated Cookie headers as an array — join them (CK-9).
    const rawCookie = ctx.get('cookie') ?? ctx.headers.cookie;
    const cookieHeader = Array.isArray(rawCookie) ? rawCookie.join('; ') : rawCookie;
    const parsed = parseCookies(cookieHeader, {
      decode: decode === undefined,
    });

    // Apply custom decode if provided
    if (decode) {
      for (const [name, value] of Object.entries(parsed)) {
        try {
          const decoded = decode(value);
          // Re-sanitize after custom decode to prevent CRLF injection
          parsed[name] = sanitizeCookieValue(decoded);
        } catch {
          // Custom decode failed — retain the parser-sanitized value.
          // Record failure for observability without disrupting request flow.
          ctx.state.cookieDecodeErrors ??= [];
          (ctx.state.cookieDecodeErrors as string[]).push(name);
        }
      }
    }

    // Create cookie context
    const cookieContext: CookieContext = {
      get(name: string): string | undefined {
        return parsed[name];
      },

      set(name: string, value: string, cookieOptions: CookieOptions = {}): void {
        const secure = resolveSecureOption(ctx, cookieOptions, trustProxy);
        const serialized = serializeCookie(name, value, {
          path: '/',
          ...cookieOptions,
          secure,
        });
        // Write eagerly (CK-1): the Node adapter commits the response the moment
        // the handler calls ctx.json()/send(), so Set-Cookie must be emitted at
        // set() time (before the commit), not deferred to after next(). ctx.set
        // appends Set-Cookie on every runtime, so multiple cookies accumulate.
        ctx.set('Set-Cookie', serialized);
        // Update parsed cookies for subsequent reads within this request
        parsed[name] = value;
      },

      delete(name: string, cookieOptions: Pick<CookieOptions, 'domain' | 'path'> = {}): void {
        const serialized = createDeleteCookie(name, {
          path: '/',
          ...cookieOptions,
        });
        ctx.set('Set-Cookie', serialized);
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete parsed[name];
      },

      all(): ParsedCookies {
        return { ...parsed };
      },

      has(name: string): boolean {
        return Object.hasOwn(parsed, name);
      },
    };

    // Add to state
    ctx.state.cookies = cookieContext;

    // Continue to next middleware. Set-Cookie headers were already written
    // eagerly at set()/delete() time, so nothing to flush here.
    await next();
  };
}
