/**
 * @nextrush/cors - Enterprise-grade CORS middleware
 *
 * A security-hardened, spec-compliant CORS middleware for NextRush v3.
 * Implements all OWASP recommendations and modern security features.
 *
 * @security
 * - Null origin attack protection
 * - Regex ReDoS mitigation
 * - Credential+wildcard validation
 * - Private Network Access (PNA) support
 * - Origin format validation
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Middleware
// ============================================================================

export { cors, CorsOptionsBuilder, createCorsOptions } from './middleware.js';

// ============================================================================
// Presets
// ============================================================================

export {
  devCors,
  internalCors, simpleCors, staticAssetsCors, strictCors
} from './presets.js';

// ============================================================================
// Types
// ============================================================================

export type {
  CorsContext,
  CorsMiddleware,
  CorsOptions,
  OriginOption,
  OriginValidator
} from './types.js';

// ============================================================================
// Utilities (for advanced use cases)
// ============================================================================

export {
  createOriginCache, isOriginAllowed,
  isOriginInList,
  isOriginMatchingPattern
} from './validation.js';

export {
  appendVary, buildMethodList, headerContains, normalizeHeaders, parseHeaderList, setVaryHeaders
} from './headers.js';

export {
  isOriginSecure, isRegexSafe, isValidOriginFormat, securityWarning
} from './security.js';

export type { SecuritySeverity } from './security.js';

// ============================================================================
// Constants (for custom implementations)
// ============================================================================

export {
  CORS_HEADERS, DEFAULT_MAX_AGE, DEFAULT_METHODS,
  DEFAULT_OPTIONS_SUCCESS_STATUS, ORIGIN_HEADER, PREFLIGHT_INDICATORS, VARY_HEADER
} from './constants.js';

// ============================================================================
// Re-exports from @nextrush/types
// ============================================================================

export type { Context, Middleware, Next } from '@nextrush/types';

// ============================================================================
// Default Export
// ============================================================================

import { cors } from './middleware.js';
export default cors;
