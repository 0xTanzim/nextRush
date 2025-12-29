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

/**
 * @nextrush/cookies - Cookie Middleware for NextRush
 *
 * Secure cookie parsing and serialization with RFC 6265 compliance.
 *
 * Features:
 * - HTTP Response Splitting (CRLF) prevention
 * - Cookie prefix validation (__Secure-, __Host-)
 * - Domain and path validation
 * - HMAC-SHA256 cookie signing with key rotation
 * - Runtime-compatible (Node.js, Bun, Deno, Edge)
 *
 * @packageDocumentation
 * @module @nextrush/cookies
 */

// Middleware
export { cookies, secureOptions, sessionOptions, signedCookies } from './middleware.js';

// Serialization
export {
    createDeleteCookie, createHostPrefixCookie, createSecurePrefixCookie, serializeCookie
} from './serializer.js';

// Parsing
export { getCookie, getCookieNames, hasCookie, parseCookies } from './parser.js';
export type { ParseOptions } from './parser.js';

// Signing
export {
    signCookie, timingSafeEqual, unsignCookie,
    unsignCookieWithRotation
} from './signing.js';
export type { SigningKeys } from './signing.js';

// Validation
export {
    SecurityError, isPublicSuffix, isValidCookieName,
    isValidCookieValue, isValidDomain, isValidPath, sanitizeCookieValue, validateCookieOptions, validateCookiePrefix
} from './validation.js';

// Constants
export {
    COMMON_PUBLIC_SUFFIXES, COOKIE_PREFIXES, DEFAULT_COOKIE_OPTIONS, MAX_COOKIE_SIZE,
    MAX_NAME_LENGTH,
    MAX_VALUE_LENGTH
} from './constants.js';

// Types
export type {
    CookieContext, CookieMiddlewareOptions, CookieOptions, CookiePriority, CookieState, ParsedCookies,
    SameSiteValue, SignedCookieContext, SignedCookieMiddlewareOptions, SignedCookieState
} from './types.js';
