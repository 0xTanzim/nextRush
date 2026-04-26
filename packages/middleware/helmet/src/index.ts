/**
 * @nextrush/helmet - Security Headers Middleware
 *
 * Enterprise-grade security headers middleware for NextRush v3.
 * Sets comprehensive HTTP headers following OWASP recommendations.
 *
 * @security Features:
 * - Content Security Policy with nonce support
 * - HSTS with preload validation
 * - Permissions-Policy with type-safe features
 * - Input validation and sanitization
 * - Header injection prevention
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Middleware
// ============================================================================

export { helmet } from './middleware.js';
export default helmet;
import { helmet } from './middleware.js';

// ============================================================================
// Presets
// ============================================================================

export {
  apiHelmet,
  // Individual header middleware
  contentSecurityPolicy,
  devHelmet,
  frameguard,
  hidePoweredBy,
  hsts,
  logoutHelmet,
  noSniff,
  referrerPolicy,
  staticHelmet,
  // Security presets
  strictHelmet,
} from './presets.js';

// ============================================================================
// Builders
// ============================================================================

export {
  analyzeCsp,
  // CSP
  buildCspHeader,
  buildCspWithNonce,
  createCspBuilder,
  CspBuilder,
} from './csp.js';

export {
  // Permissions-Policy
  buildPermissionsPolicyHeader,
  createPermissionsPolicyBuilder,
  PermissionsPolicyBuilder,
  restrictivePermissionsPolicy,
} from './permissions.js';

// ============================================================================
// Nonce Utilities
// ============================================================================

export {
  createNoncedScript,
  createNoncedStyle,
  createNonceProvider,
  extractNonce,
  generateCspNonce,
  generateNonce,
  validateNonce,
} from './nonce.js';

// ============================================================================
// Validation
// ============================================================================

export {
  analyzeCspSecurity,
  isBooleanCspDirective,
  isCspValueSafe,
  isUnsafeCspValue,
  isValidCspDirective,
  isValidHash,
  isValidNonce,
  sanitizeCspValue,
  sanitizeHeaderValue,
  securityWarning,
  validateHstsOptions,
} from './validation.js';

export type { HstsValidationResult } from './validation.js';

// ============================================================================
// Constants
// ============================================================================

export {
  BOOLEAN_CSP_DIRECTIVES,
  DEFAULT_CSP_DIRECTIVES,
  DEFAULT_HSTS_MAX_AGE,
  HEADERS,
  MIN_HSTS_PRELOAD_MAX_AGE,
  RECOMMENDED_HSTS_MAX_AGE,
  STRICT_CSP_DIRECTIVES,
  UNSAFE_CSP_VALUES,
  VALID_CSP_DIRECTIVES,
} from './constants.js';

// ============================================================================
// Types
// ============================================================================

export type {
  // Clear Site Data
  ClearSiteDataValue,
  ContentSecurityPolicyDirectives,
  ContentSecurityPolicyOptions,
  // Cross-Origin
  CrossOriginEmbedderPolicyValue,
  CrossOriginOpenerPolicyValue,
  CrossOriginResourcePolicyValue,
  CspDirectiveName,
  CspSandboxValue,
  // CSP
  CspSourceValue,
  CspWithNonceOptions,
  // Context
  HelmetContext,
  HelmetMiddleware,
  // Main Options
  HelmetOptions,
  // Re-exports
  Middleware,
  NonceProvider,
  PermissionsPolicyAllowlist,
  PermissionsPolicyDirectives,
  // Permissions
  PermissionsPolicyFeature,
  // Referrer
  ReferrerPolicyValue,
  // HSTS
  StrictTransportSecurityOptions,
  // Frame Options
  XFrameOptionsValue,
} from './types.js';
