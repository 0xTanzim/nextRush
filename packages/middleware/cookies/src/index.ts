/**
 * @nextrush/cookies - Cookie Middleware for NextRush
 *
 * A lightweight, secure cookie middleware for NextRush applications.
 * Supports parsing, setting, deleting, and signed cookies.
 *
 * @packageDocumentation
 * @module @nextrush/cookies
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { cookies, secureOptions } from '@nextrush/cookies';
 *
 * const app = createApp();
 *
 * // Add cookie middleware
 * app.use(cookies());
 *
 * app.get('/login', async (ctx) => {
 *   // Set a cookie
 *   ctx.state.cookies.set('session', 'user-session-id', {
 *     httpOnly: true,
 *     secure: true,
 *     maxAge: 86400 // 1 day
 *   });
 *   ctx.json({ success: true });
 * });
 *
 * app.get('/profile', async (ctx) => {
 *   // Read a cookie
 *   const session = ctx.state.cookies.get('session');
 *   ctx.json({ session });
 * });
 *
 * app.get('/logout', async (ctx) => {
 *   // Delete a cookie
 *   ctx.state.cookies.delete('session');
 *   ctx.json({ success: true });
 * });
 * ```
 */

// Middleware
export { cookies, secureOptions, sessionOptions, signedCookies } from './middleware';

// Utilities
export { createDeleteCookie, parseCookies, serializeCookie, signCookie, unsignCookie } from './utils';

// Types
export type {
    CookieContext,
    CookieMiddlewareOptions,
    CookieOptions,
    CookieState,
    ParsedCookies
} from './types';
