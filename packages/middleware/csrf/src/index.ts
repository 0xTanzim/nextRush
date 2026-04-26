/**
 * @nextrush/csrf
 *
 * CSRF protection middleware using the Signed Double-Submit Cookie pattern.
 * Implements OWASP recommended approach with HMAC-SHA256 token signing.
 *
 * @packageDocumentation
 */

// Core middleware
export { csrf } from './middleware.js';

// Types
export type {
  CsrfContext,
  CsrfCookieOptions,
  CsrfMiddleware,
  CsrfOptions,
  SessionIdentifierExtractor,
  TokenExtractor,
} from './types.js';

// Token utilities (for advanced usage)
export { constantTimeEqual, generateToken, validateToken } from './token.js';

// Constants
export {
  CSRF_FIELD,
  CSRF_HEADER,
  DEFAULT_COOKIE_NAME,
  DEFAULT_IGNORED_METHODS,
  DEFAULT_TOKEN_SIZE,
  ERRORS,
  XSRF_HEADER,
} from './constants.js';
