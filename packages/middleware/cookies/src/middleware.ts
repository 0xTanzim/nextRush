/**
 * @nextrush/cookies - Cookie Middleware
 *
 * Middleware for parsing and setting cookies in NextRush applications.
 * Includes security hardening: CRLF prevention, prefix validation, domain validation.
 *
 * @packageDocumentation
 */

import type { Context, Middleware } from '@nextrush/types';
import { parseCookies } from './parser.js';
import { createDeleteCookie, serializeCookie } from './serializer.js';
import { signCookie, unsignCookieWithRotation } from './signing.js';
import type {
  CookieContext,
  CookieMiddlewareOptions,
  CookieOptions,
  ParsedCookies,
  SignedCookieContext,
  SignedCookieMiddlewareOptions,
} from './types.js';
import { sanitizeCookieValue } from './validation.js';

// ============================================================================
// State Types
// ============================================================================

// ============================================================================
// Cookie Middleware
// ============================================================================

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
 *   // Set a cookie (defaults: HttpOnly + SameSite=Lax + Path=/; add secure:true in production)
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
  const { decode } = options;

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
        const serialized = serializeCookie(name, value, {
          path: '/',
          ...cookieOptions,
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

// ============================================================================
// Signed Cookie Middleware
// ============================================================================

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
 *     // Cookie was tampered with or doesn't exist
 *   }
 * });
 * ```
 */
export function signedCookies(options: SignedCookieMiddlewareOptions): Middleware {
  const { secret, previousSecrets } = options;

  if (!secret || typeof secret !== 'string') {
    throw new TypeError('signedCookies requires a secret string');
  }

  return async function signedCookiesMiddleware(ctx: Context, next) {
    const rawCookie = ctx.get('cookie') ?? ctx.headers.cookie;
    const cookieHeader = Array.isArray(rawCookie) ? rawCookie.join('; ') : rawCookie;
    const parsed = parseCookies(cookieHeader);

    // Signed cookie context with async methods
    const signedContext: SignedCookieContext = {
      async get(name: string): Promise<string | undefined> {
        const value = parsed[name];
        if (!value) return undefined;

        // Verify signature with key rotation support
        return unsignCookieWithRotation(value, {
          current: secret,
          previous: previousSecrets,
        });
      },

      async set(name: string, value: string, cookieOptions: CookieOptions = {}): Promise<void> {
        const signedValue = await signCookie(value, secret);
        const serialized = serializeCookie(name, signedValue, {
          path: '/',
          ...cookieOptions,
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

    // Add to state
    ctx.state.signedCookies = signedContext;

    await next();
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create secure cookie options for production.
 *
 * @param options - Additional options to merge
 * @returns Secure cookie options
 *
 * @example
 * ```typescript
 * ctx.state.cookies?.set('session', value, secureOptions({ maxAge: 86400 }));
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
 * Create session cookie options.
 * These cookies are deleted when the browser closes.
 *
 * @param options - Additional options to merge
 * @returns Session cookie options
 *
 * @example
 * ```typescript
 * ctx.state.cookies?.set('session', value, sessionOptions());
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
