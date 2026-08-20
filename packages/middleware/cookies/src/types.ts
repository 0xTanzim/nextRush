/**
 * @nextrush/cookies — Cookie Types (re-exports)
 *
 * The public cookie data contracts moved to `@nextrush/types` (RFC-034).
 * This module re-exports them so every existing import path
 * (`@nextrush/cookies` → `CookieOptions`, `SameSiteValue`, …) keeps working.
 *
 * @packageDocumentation
 */

export type {
  CookieOptions,
  CookiePriority,
  ParsedCookies,
  SameSiteValue,
} from '@nextrush/types';
