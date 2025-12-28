/**
 * @nextrush/body-parser - Body Parsing Middleware
 *
 * Parse incoming request bodies in middleware before your handlers.
 * Supports JSON, URL-encoded, text, and raw binary bodies.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { bodyParser, json, urlencoded, text, raw } from '@nextrush/body-parser';
 *
 * const app = createApp();
 *
 * // Use combined parser (recommended)
 * app.use(bodyParser());
 *
 * // Or use individual parsers
 * app.use(json({ limit: '10mb', strict: true }));
 * app.use(urlencoded({ extended: true, depth: 5 }));
 * app.use(text({ type: ['text/plain', 'text/html'] }));
 * app.use(raw({ type: 'application/octet-stream' }));
 * ```
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  BodyParserContext, BodyParserErrorCode, BodyParserMiddleware, BodyParserOptions, JsonOptions, RawOptions, TextOptions, UrlEncodedOptions
} from './types.js';

// =============================================================================
// ERROR EXPORTS
// =============================================================================

export { BodyParserError, Errors } from './errors.js';

// =============================================================================
// CONSTANTS EXPORTS
// =============================================================================

export {
  BODYLESS_METHODS, DEFAULT_CONTENT_TYPES, DEFAULT_LIMITS, DEFAULT_PARAMETER_LIMITS, PATTERNS, SIZE_UNITS,
  SUPPORTED_CHARSETS
} from './constants.js';

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export {
  bufferToString,
  concatBuffers
} from './utils/buffer.js';

export {
  extractCharset, getContentLength, getContentType, isJsonContentType,
  matchContentType, normalizeCharset
} from './utils/content-type.js';

export {
  formatBytes, parseLimit
} from './utils/limit.js';

export {
  parseUrlEncoded, safeDecodeURIComponent, setNestedValue
} from './utils/url-decode.js';

// =============================================================================
// PARSER EXPORTS
// =============================================================================

export { bodyParser } from './parsers/combined.js';
export { json } from './parsers/json.js';
export { raw } from './parsers/raw.js';
export { readBody } from './parsers/reader.js';
export { text } from './parsers/text.js';
export { urlencoded } from './parsers/urlencoded.js';

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

import { bodyParser } from './parsers/combined.js';
export default bodyParser;
