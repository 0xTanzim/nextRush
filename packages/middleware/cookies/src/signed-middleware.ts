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
import { CapabilityNotInitializedError } from '@nextrush/errors';
import { UNINITIALIZED_COOKIES } from '@nextrush/runtime';
import { parseCookies } from './parser.js';
import { createDeleteCookie, serializeCookie } from './serializer.js';
import { resolveSecureOption } from './secure-resolution.js';
import { signCookie, unsignCookieWithRotation } from './signing.js';
import type { CookieOptions } from './types.js';

/**
 * Create signed cookie middleware.
 *
 * Activates the `ctx.cookies.signed` sub-capability: HMAC-signed cookies for
 * tamper detection, with key rotation support. Requires `cookies()` to be
 * registered first (RFC-034).
 *
 * @param options - Options with required secret
 * @returns Signed cookie middleware
 *
 * @example
 * ```typescript
 * import { cookies, signedCookies } from '@nextrush/cookies';
 *
 * app.use(cookies());
 * app.use(signedCookies({
 *   secret: process.env.COOKIE_SECRET!,
 *   previousSecrets: [process.env.OLD_SECRET!] // For key rotation
 * }));
 *
 * app.use(async (ctx) => {
 *   // Set a signed cookie
 *   await ctx.cookies.signed.set('user', 'john', { httpOnly: true });
 *
 *   // Get and verify a signed cookie
 *   const user = await ctx.cookies.signed.get('user');
 *   if (user === undefined) {
 *     // Cookie was tampered with, replayed under another name, expired, or
 *     // doesn't exist.
 *   }
 * });
 * ```
 */
/** Maximum number of previous secrets accepted for rotation (RFC-034 §21). */
const MAX_PREVIOUS_SECRETS = 10;

export function signedCookies(options: SignedCookieMiddlewareOptions): Middleware {
  const { secret, previousSecrets, trustProxy = false, maxAge, acceptLegacySignatures } = options;

  if (!secret || typeof secret !== 'string') {
    throw new TypeError('signedCookies requires a secret string');
  }
  if (previousSecrets && previousSecrets.length > MAX_PREVIOUS_SECRETS) {
    throw new TypeError(
      `signedCookies accepts at most ${String(MAX_PREVIOUS_SECRETS)} previousSecrets ` +
        `(got ${String(previousSecrets.length)})`
    );
  }

  return async function signedCookiesMiddleware(ctx: Context, next) {
    // RFC-034: signed cookies are a sub-capability of ctx.cookies. Require
    // cookies() to have activated the parent capability first — throwing the
    // diagnostic is more actionable than "Cannot read properties of undefined".
    if (ctx.cookies === UNINITIALIZED_COOKIES) {
      throw new CapabilityNotInitializedError(
        'cookies',
        'signedCookies requires cookies() to be registered first:\n' +
          '  import { cookies, signedCookies } from \'@nextrush/cookies\';\n' +
          '  app.use(cookies());\n' +
          '  app.use(signedCookies({ secret: process.env.COOKIE_SECRET }));'
      );
    }

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

    // Activate the signed sub-capability (RFC-034): the store's `signed`
    // member started as the shared uninitialized stub (set by cookies()).
    ctx.cookies.signed = signedContext;

    // Deprecated alias for one release cycle.
    ctx.state.signedCookies = signedContext;

    await next();
  };
}
