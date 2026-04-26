/**
 * @nextrush/helmet - Constants
 *
 * Header names, default values, and security constants.
 *
 * @packageDocumentation
 */

import type { ContentSecurityPolicyDirectives, CspDirectiveName } from './types.js';

// ============================================================================
// Header Names
// ============================================================================

/**
 * Security header names used by Helmet.
 */
export const HEADERS = {
  // Content Security Policy
  CSP: 'Content-Security-Policy',
  CSP_REPORT_ONLY: 'Content-Security-Policy-Report-Only',

  // Cross-Origin Policies
  COEP: 'Cross-Origin-Embedder-Policy',
  COOP: 'Cross-Origin-Opener-Policy',
  CORP: 'Cross-Origin-Resource-Policy',

  // Transport Security
  HSTS: 'Strict-Transport-Security',

  // Legacy Headers
  X_FRAME_OPTIONS: 'X-Frame-Options',
  X_CONTENT_TYPE_OPTIONS: 'X-Content-Type-Options',
  X_DNS_PREFETCH_CONTROL: 'X-DNS-Prefetch-Control',
  X_DOWNLOAD_OPTIONS: 'X-Download-Options',
  X_XSS_PROTECTION: 'X-XSS-Protection',
  X_PERMITTED_CROSS_DOMAIN_POLICIES: 'X-Permitted-Cross-Domain-Policies',

  // Modern Headers
  REFERRER_POLICY: 'Referrer-Policy',
  PERMISSIONS_POLICY: 'Permissions-Policy',
  ORIGIN_AGENT_CLUSTER: 'Origin-Agent-Cluster',

  // Reporting and Clearing
  CLEAR_SITE_DATA: 'Clear-Site-Data',
  REPORTING_ENDPOINTS: 'Reporting-Endpoints',

  // Server Identity
  X_POWERED_BY: 'X-Powered-By',
} as const;

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default HSTS max-age in seconds (180 days).
 */
export const DEFAULT_HSTS_MAX_AGE = 15552000;

/**
 * Recommended HSTS max-age for production (1 year).
 */
export const RECOMMENDED_HSTS_MAX_AGE = 31536000;

/**
 * Minimum HSTS max-age for preload eligibility (1 year).
 */
export const MIN_HSTS_PRELOAD_MAX_AGE = 31536000;

/**
 * Default Content Security Policy directives.
 * Follows OWASP recommendations with secure defaults.
 */
export const DEFAULT_CSP_DIRECTIVES: ContentSecurityPolicyDirectives = {
  'default-src': ["'self'"],
  'base-uri': ["'self'"],
  'font-src': ["'self'", 'https:', 'data:'],
  'form-action': ["'self'"],
  'frame-ancestors': ["'self'"],
  'img-src': ["'self'", 'data:'],
  'object-src': ["'none'"],
  'script-src': ["'self'"],
  'script-src-attr': ["'none'"],
  'style-src': ["'self'", 'https:', "'unsafe-inline'"],
  'upgrade-insecure-requests': true,
};

/**
 * Strict CSP directives for maximum security.
 */
export const STRICT_CSP_DIRECTIVES: ContentSecurityPolicyDirectives = {
  'default-src': ["'none'"],
  'base-uri': ["'self'"],
  'font-src': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'img-src': ["'self'"],
  'object-src': ["'none'"],
  'script-src': ["'self'"],
  'script-src-attr': ["'none'"],
  'style-src': ["'self'"],
  'connect-src': ["'self'"],
  'upgrade-insecure-requests': true,
  'block-all-mixed-content': true,
};

// ============================================================================
// Validation Constants
// ============================================================================

/**
 * All valid CSP directive names.
 */
export const VALID_CSP_DIRECTIVES: readonly CspDirectiveName[] = [
  'default-src',
  'script-src',
  'script-src-attr',
  'script-src-elem',
  'style-src',
  'style-src-attr',
  'style-src-elem',
  'img-src',
  'font-src',
  'connect-src',
  'media-src',
  'object-src',
  'frame-src',
  'child-src',
  'worker-src',
  'frame-ancestors',
  'form-action',
  'base-uri',
  'manifest-src',
  'navigate-to',
  'prefetch-src',
  'sandbox',
  'block-all-mixed-content',
  'upgrade-insecure-requests',
  'require-trusted-types-for',
  'trusted-types',
  'report-uri',
  'report-to',
];

/**
 * CSP directives that are boolean (no value list).
 */
export const BOOLEAN_CSP_DIRECTIVES = [
  'block-all-mixed-content',
  'upgrade-insecure-requests',
] as const;

/**
 * Unsafe CSP values that should trigger warnings.
 */
export const UNSAFE_CSP_VALUES = [
  "'unsafe-inline'",
  "'unsafe-eval'",
  "'unsafe-hashes'",
  '*',
] as const;

/**
 * Characters that are not allowed in CSP values (prevent header injection).
 */
export const CSP_FORBIDDEN_CHARS = /[;\n\r]/;

/**
 * Pattern for valid nonce format.
 */
export const NONCE_PATTERN = /^[A-Za-z0-9+/]+=*$/;

/**
 * Pattern for valid hash format.
 */
export const HASH_PATTERN = /^'sha(256|384|512)-[A-Za-z0-9+/]+=*'$/;
