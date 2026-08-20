/**
 * @nextrush/cookies - Cookie Option Presets
 *
 * `secureOptions()`/`sessionOptions()` helpers, split out of
 * `middleware.ts` to keep that file under the file-size ceiling.
 *
 * @packageDocumentation
 */

import type { CookieOptions } from './types.js';

/**
 * Create secure cookie options for production.
 *
 * @example
 * ```typescript
 * ctx.cookies.set('session', value, secureOptions({ maxAge: 86400 }));
 * ```
 */
export function secureOptions(options: CookieOptions = {}): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: options.path ?? '/',
  };
}

/**
 * Create session cookie options. These cookies are deleted when the
 * browser closes.
 *
 * @example
 * ```typescript
 * ctx.cookies.set('session', value, sessionOptions());
 * ```
 */
export function sessionOptions(options: CookieOptions = {}): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    sameSite: 'lax',
    path: options.path ?? '/',
    // No maxAge or expires = session cookie
    maxAge: undefined,
    expires: undefined,
  };
}
