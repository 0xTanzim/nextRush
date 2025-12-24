/**
 * @nextrush/cookies - Cookie Middleware
 *
 * Middleware for parsing and setting cookies in NextRush applications.
 *
 * @packageDocumentation
 */

import type { Context, Middleware } from '@nextrush/types';
import type { CookieContext, CookieMiddlewareOptions, CookieOptions, ParsedCookies } from './types';
import { createDeleteCookie, parseCookies, serializeCookie, signCookie, unsignCookie } from './utils';

/**
 * State with cookies extension
 */
interface StateWithCookies {
  cookies: CookieContext;
  [key: string]: unknown;
}

/**
 * Create cookie middleware
 *
 * Parses cookies from request and provides helpers for setting cookies.
 * Adds `ctx.state.cookies` with get, set, delete, and all methods.
 *
 * @param options - Middleware configuration
 * @returns Cookie middleware
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { cookies } from '@nextrush/cookies';
 *
 * const app = createApp();
 *
 * // Basic usage
 * app.use(cookies());
 *
 * // With signed cookies
 * app.use(cookies({ secret: 'your-secret-key' }));
 *
 * app.get('/profile', async (ctx) => {
 *   const session = ctx.state.cookies.get('session');
 *   if (!session) {
 *     ctx.state.cookies.set('session', 'new-session-id', {
 *       httpOnly: true,
 *       secure: true,
 *       maxAge: 86400
 *     });
 *   }
 *   ctx.json({ session });
 * });
 * ```
 */
export function cookies(options: CookieMiddlewareOptions = {}): Middleware {
  const { decode = decodeURIComponent } = options;

  return async (ctx: Context) => {
    // Parse cookies from request header
    const cookieHeader = ctx.get('cookie');
    const parsed = parseCookies(cookieHeader, decode);

    // Track Set-Cookie headers to send
    const setCookies: string[] = [];

    // Create cookie context
    const cookieContext: CookieContext = {
      /**
       * Get a cookie value
       */
      get(name: string): string | undefined {
        return parsed[name];
      },

      /**
       * Set a cookie
       */
      set(name: string, value: string, cookieOptions: CookieOptions = {}): void {
        const serialized = serializeCookie(name, value, {
          path: '/',
          ...cookieOptions,
        });
        setCookies.push(serialized);
      },

      /**
       * Delete a cookie by setting it to expire
       */
      delete(name: string, cookieOptions: Pick<CookieOptions, 'domain' | 'path'> = {}): void {
        const serialized = createDeleteCookie(name, {
          path: '/',
          ...cookieOptions,
        });
        setCookies.push(serialized);
      },

      /**
       * Get all parsed cookies
       */
      all(): ParsedCookies {
        return { ...parsed };
      },
    };

    // Add to state
    (ctx.state as StateWithCookies).cookies = cookieContext;

    // Continue to next middleware
    await ctx.next();

    // Set cookies on response
    if (setCookies.length > 0) {
      // Get existing Set-Cookie headers
      const raw = ctx.raw as { res?: { getHeader: (name: string) => string | string[] | number | undefined } };
      const existing = raw.res?.getHeader?.('Set-Cookie');

      let allCookies: string[];
      if (Array.isArray(existing)) {
        allCookies = [...existing, ...setCookies];
      } else if (typeof existing === 'string') {
        allCookies = [existing, ...setCookies];
      } else {
        allCookies = setCookies;
      }

      // Set all cookies
      for (let i = 0; i < allCookies.length; i++) {
        const cookie = allCookies[i];
        if (i === 0 && cookie) {
          ctx.set('Set-Cookie', cookie);
        } else if (cookie) {
          // Append additional cookies
          const rawRes = raw.res as { setHeader?: (name: string, value: string[]) => void };
          rawRes.setHeader?.('Set-Cookie', allCookies);
          break;
        }
      }
    }
  };
}

/**
 * Create signed cookie middleware
 *
 * Enhanced version that supports signed cookies for tamper detection.
 *
 * @param secret - Secret key for signing
 * @param options - Additional options
 * @returns Signed cookie middleware
 *
 * @example
 * ```typescript
 * import { signedCookies } from '@nextrush/cookies';
 *
 * app.use(signedCookies('your-secret-key'));
 *
 * app.get('/auth', async (ctx) => {
 *   // Set a signed cookie
 *   await ctx.state.signedCookies.set('user', 'john', { httpOnly: true });
 *
 *   // Get and verify a signed cookie
 *   const user = await ctx.state.signedCookies.get('user');
 * });
 * ```
 */
export function signedCookies(
  secret: string,
  options: Omit<CookieMiddlewareOptions, 'secret' | 'signed'> = {},
): Middleware {
  if (!secret || typeof secret !== 'string') {
    throw new TypeError('Secret key is required for signed cookies');
  }

  const { decode = decodeURIComponent } = options;

  return async (ctx: Context) => {
    const cookieHeader = ctx.get('cookie');
    const parsed = parseCookies(cookieHeader, decode);
    const setCookies: string[] = [];

    // Signed cookie context with async methods
    const signedContext = {
      /**
       * Get and verify a signed cookie
       */
      async get(name: string): Promise<string | undefined> {
        const value = parsed[name];
        if (!value) return undefined;
        return unsignCookie(value, secret);
      },

      /**
       * Set a signed cookie
       */
      async set(name: string, value: string, cookieOptions: CookieOptions = {}): Promise<void> {
        const signedValue = await signCookie(value, secret);
        const serialized = serializeCookie(name, signedValue, {
          path: '/',
          ...cookieOptions,
        });
        setCookies.push(serialized);
      },

      /**
       * Delete a signed cookie
       */
      delete(name: string, cookieOptions: Pick<CookieOptions, 'domain' | 'path'> = {}): void {
        const serialized = createDeleteCookie(name, {
          path: '/',
          ...cookieOptions,
        });
        setCookies.push(serialized);
      },

      /**
       * Get all raw cookies (not verified)
       */
      allRaw(): ParsedCookies {
        return { ...parsed };
      },
    };

    // Add to state
    const state = ctx.state as { signedCookies: typeof signedContext };
    state.signedCookies = signedContext;

    await ctx.next();

    // Set cookies on response
    if (setCookies.length > 0) {
      for (const cookie of setCookies) {
        ctx.set('Set-Cookie', cookie);
      }
    }
  };
}

/**
 * Helper to create secure cookie options for production
 *
 * @param maxAge - Cookie max age in seconds (default: 1 day)
 * @returns Secure cookie options
 *
 * @example
 * ```typescript
 * ctx.state.cookies.set('session', value, secureOptions());
 * ctx.state.cookies.set('session', value, secureOptions(7 * 24 * 60 * 60)); // 7 days
 * ```
 */
export function secureOptions(maxAge: number = 86400): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge,
  };
}

/**
 * Helper to create session cookie options
 * These cookies are deleted when the browser closes
 *
 * @returns Session cookie options
 */
export function sessionOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
  };
}
