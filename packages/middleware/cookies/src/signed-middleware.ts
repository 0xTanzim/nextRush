/**
 * @nextrush/cookies - Signed Cookie Middleware
 *
 * Split out of `middleware.ts` to keep that file under the file-size
 * ceiling. Threads the cookie name through `signCookie`/`unsignCookie` so
 * verification is always context-bound (SEC-07, RFC-031).
 *
 * @packageDocumentation
 */

import type { Context, Middleware } from '@nextrush/types';
import type { SignedCookieContext, SignedCookieMiddlewareOptions } from './middleware-types.js';
import { parseCookies } from './parser.js';
import { createDeleteCookie, serializeCookie } from './serializer.js';
import { resolveSecureOption } from './secure-resolution.js';
import { signCookie, unsignCookieWithRotation } from './signing.js';
import type { CookieOptions } from './types.js';

/**
 * Create signed cookie middleware.
 *
 * Enhanced version that supports HMAC-signed cookies for tamper detection.
 * Supports key rotation for seamless secret updates.
 *
 * @param options - Options with required secret
 * @returns Signed cookie middleware
 *
 * @example
 * ```typescript
 * import { signedCookies } from '@nextrush/cookies';
 *
 * app.use(signedCookies({
 *   secret: process.env.COOKIE_SECRET!,
 *   previousSecrets: [process.env.OLD_SECRET!] // For key rotation
 * }));
 *
 * app.use(async (ctx) => {
 *   // Set a signed cookie
 *   await ctx.state.signedCookies?.set('user', 'john', { httpOnly: true });
 *
 *   // Get and verify a signed cookie
 *   const user = await ctx.state.signedCookies?.get('user');
 *   if (user === undefined) {
 *     // Cookie was tampered with, replayed under another name, expired, or
 *     // doesn't exist.
 *   }
 * });
 * ```
 */
export function signedCookies(options: SignedCookieMiddlewareOptions): Middleware {
  const { secret, previousSecrets, trustProxy = false, maxAge, acceptLegacySignatures } = options;

  if (!secret || typeof secret !== 'string') {
    throw new TypeError('signedCookies requires a secret string');
  }

  return async function signedCookiesMiddleware(ctx: Context, next) {
    const rawCookie = ctx.get('cookie') ?? ctx.headers.cookie;
    const cookieHeader = Array.isArray(rawCookie) ? rawCookie.join('; ') : rawCookie;
    const parsed = parseCookies(cookieHeader);

    const signedContext: SignedCookieContext = {
      async get(name: string): Promise<string | undefined> {
        const value = parsed[name];
        if (!value) return undefined;

        // Verify signature with key rotation support. Threading `name`
        // through closes SEC-07: verification cannot succeed without
        // knowing which cookie the value was presented as.
        return unsignCookieWithRotation(
          name,
          value,
          { current: secret, previous: previousSecrets },
          { maxAge, acceptLegacySignatures }
        );
      },

      async set(name: string, value: string, cookieOptions: CookieOptions = {}): Promise<void> {
        const signedValue = await signCookie(name, value, secret, { maxAge });
        const secure = resolveSecureOption(ctx, cookieOptions, trustProxy);
        const serialized = serializeCookie(name, signedValue, {
          path: '/',
          ...cookieOptions,
          secure,
        });
        // Eager write (CK-1). Store the signed value so get() within the same
        // request round-trips the value (CK-4 read-after-write).
        ctx.set('Set-Cookie', serialized);
        parsed[name] = signedValue;
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
    };

    ctx.state.signedCookies = signedContext;

    await next();
  };
}
