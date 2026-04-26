/**
 * @nextrush/helmet - CSP Header Builder
 *
 * Build Content Security Policy headers with validation and sanitization.
 * Supports nonce generation, hash-based integrity, and security analysis.
 *
 * @packageDocumentation
 */

import { DEFAULT_CSP_DIRECTIVES, STRICT_CSP_DIRECTIVES } from './constants.js';
import { generateNonce } from './nonce.js';
import type {
    ContentSecurityPolicyDirectives,
    ContentSecurityPolicyOptions,
    CspSourceValue,
    CspWithNonceOptions,
} from './types.js';
import { analyzeCspSecurity, sanitizeCspValue } from './validation.js';

/**
 * Build a CSP header value from directives.
 *
 * @param directives - CSP directives object
 * @returns Formatted CSP header string
 *
 * @example
 * ```typescript
 * const csp = buildCspHeader({
 *   'default-src': ["'self'"],
 *   'script-src': ["'self'", 'cdn.example.com'],
 *   'upgrade-insecure-requests': true
 * });
 * // "default-src 'self'; script-src 'self' cdn.example.com; upgrade-insecure-requests"
 * ```
 */
export function buildCspHeader(directives: ContentSecurityPolicyDirectives): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(directives)) {
    if (value === undefined || value === null) continue;

    // Boolean directives (no value)
    if (typeof value === 'boolean') {
      if (value) {
        parts.push(sanitizeCspValue(key));
      }
      continue;
    }

    // Array of sources
    if (Array.isArray(value)) {
      if (value.length === 0) continue;

      // Sanitize each value
      const sanitizedValues = value.map((v) => sanitizeCspValue(String(v)));
      parts.push(`${sanitizeCspValue(key)} ${sanitizedValues.join(' ')}`);
      continue;
    }

    // String value (e.g., report-uri, report-to)
    if (typeof value === 'string') {
      parts.push(`${sanitizeCspValue(key)} ${sanitizeCspValue(value)}`);
    }
  }

  return parts.join('; ');
}

/**
 * CSP header builder with fluent API.
 *
 * @example
 * ```typescript
 * const csp = new CspBuilder()
 *   .defaultSrc("'self'")
 *   .scriptSrc("'self'", 'cdn.example.com')
 *   .styleSrc("'self'", "'unsafe-inline'")
 *   .imgSrc("'self'", 'data:', 'https:')
 *   .upgradeInsecureRequests()
 *   .build();
 * ```
 */
export class CspBuilder {
  private directives: ContentSecurityPolicyDirectives = {};
  private _reportOnly = false;

  /**
   * Set default-src directive.
   */
  defaultSrc(...sources: CspSourceValue[]): this {
    this.directives['default-src'] = sources;
    return this;
  }

  /**
   * Set script-src directive.
   */
  scriptSrc(...sources: CspSourceValue[]): this {
    this.directives['script-src'] = sources;
    return this;
  }

  /**
   * Set script-src-attr directive.
   */
  scriptSrcAttr(...sources: CspSourceValue[]): this {
    this.directives['script-src-attr'] = sources;
    return this;
  }

  /**
   * Set script-src-elem directive.
   */
  scriptSrcElem(...sources: CspSourceValue[]): this {
    this.directives['script-src-elem'] = sources;
    return this;
  }

  /**
   * Set style-src directive.
   */
  styleSrc(...sources: CspSourceValue[]): this {
    this.directives['style-src'] = sources;
    return this;
  }

  /**
   * Set style-src-attr directive.
   */
  styleSrcAttr(...sources: CspSourceValue[]): this {
    this.directives['style-src-attr'] = sources;
    return this;
  }

  /**
   * Set style-src-elem directive.
   */
  styleSrcElem(...sources: CspSourceValue[]): this {
    this.directives['style-src-elem'] = sources;
    return this;
  }

  /**
   * Set img-src directive.
   */
  imgSrc(...sources: CspSourceValue[]): this {
    this.directives['img-src'] = sources;
    return this;
  }

  /**
   * Set font-src directive.
   */
  fontSrc(...sources: CspSourceValue[]): this {
    this.directives['font-src'] = sources;
    return this;
  }

  /**
   * Set connect-src directive.
   */
  connectSrc(...sources: CspSourceValue[]): this {
    this.directives['connect-src'] = sources;
    return this;
  }

  /**
   * Set media-src directive.
   */
  mediaSrc(...sources: CspSourceValue[]): this {
    this.directives['media-src'] = sources;
    return this;
  }

  /**
   * Set object-src directive.
   */
  objectSrc(...sources: CspSourceValue[]): this {
    this.directives['object-src'] = sources;
    return this;
  }

  /**
   * Set frame-src directive.
   */
  frameSrc(...sources: CspSourceValue[]): this {
    this.directives['frame-src'] = sources;
    return this;
  }

  /**
   * Set child-src directive.
   */
  childSrc(...sources: CspSourceValue[]): this {
    this.directives['child-src'] = sources;
    return this;
  }

  /**
   * Set worker-src directive.
   */
  workerSrc(...sources: CspSourceValue[]): this {
    this.directives['worker-src'] = sources;
    return this;
  }

  /**
   * Set frame-ancestors directive.
   */
  frameAncestors(...sources: CspSourceValue[]): this {
    this.directives['frame-ancestors'] = sources;
    return this;
  }

  /**
   * Set form-action directive.
   */
  formAction(...sources: CspSourceValue[]): this {
    this.directives['form-action'] = sources;
    return this;
  }

  /**
   * Set base-uri directive.
   */
  baseUri(...sources: CspSourceValue[]): this {
    this.directives['base-uri'] = sources;
    return this;
  }

  /**
   * Set manifest-src directive.
   */
  manifestSrc(...sources: CspSourceValue[]): this {
    this.directives['manifest-src'] = sources;
    return this;
  }

  /**
   * Enable block-all-mixed-content.
   */
  blockAllMixedContent(): this {
    this.directives['block-all-mixed-content'] = true;
    return this;
  }

  /**
   * Enable upgrade-insecure-requests.
   */
  upgradeInsecureRequests(): this {
    this.directives['upgrade-insecure-requests'] = true;
    return this;
  }

  /**
   * Set sandbox restrictions.
   */
  sandbox(...restrictions: string[]): this {
    this.directives.sandbox = restrictions as ContentSecurityPolicyDirectives['sandbox'];
    return this;
  }

  /**
   * Set report-uri (deprecated, use reportTo).
   */
  reportUri(uri: string): this {
    this.directives['report-uri'] = uri;
    return this;
  }

  /**
   * Set report-to endpoint.
   */
  reportTo(endpoint: string): this {
    this.directives['report-to'] = endpoint;
    return this;
  }

  /**
   * Set to report-only mode.
   */
  reportOnly(): this {
    this._reportOnly = true;
    return this;
  }

  /**
   * Add a custom directive.
   */
  directive(name: string, values: string[] | boolean): this {
    (this.directives as Record<string, unknown>)[name] = values;
    return this;
  }

  /**
   * Merge with default directives.
   */
  withDefaults(): this {
    this.directives = { ...DEFAULT_CSP_DIRECTIVES, ...this.directives };
    return this;
  }

  /**
   * Use strict security defaults.
   */
  strict(): this {
    this.directives = { ...STRICT_CSP_DIRECTIVES, ...this.directives };
    return this;
  }

  /**
   * Get the directives object.
   */
  getDirectives(): ContentSecurityPolicyDirectives {
    return { ...this.directives };
  }

  /**
   * Check if in report-only mode.
   */
  isReportOnly(): boolean {
    return this._reportOnly;
  }

  /**
   * Build the CSP header string.
   */
  build(): string {
    return buildCspHeader(this.directives);
  }

  /**
   * Build CSP options object.
   */
  toOptions(): ContentSecurityPolicyOptions {
    return {
      directives: this.directives,
      reportOnly: this._reportOnly,
      useDefaults: false,
    };
  }
}

/**
 * Create a new CSP builder.
 */
export function createCspBuilder(): CspBuilder {
  return new CspBuilder();
}

/**
 * Build CSP options with nonce support.
 *
 * @param options - CSP options with nonce configuration
 * @param requestNonce - Pre-generated nonce for this request (optional)
 * @returns Built CSP options and nonce value
 */
export function buildCspWithNonce(
  options: CspWithNonceOptions,
  requestNonce?: string
): { cspOptions: ContentSecurityPolicyOptions; nonce: string | null } {
  const { generateNonce: nonceConfig, nonceStateKey, ...cspOptions } = options;

  // No nonce generation
  if (!nonceConfig) {
    return { cspOptions, nonce: null };
  }

  // Generate or use provided nonce
  let nonce: string;
  if (requestNonce) {
    nonce = requestNonce;
  } else if (typeof nonceConfig === 'function') {
    const result = nonceConfig();
    nonce = typeof result === 'string' ? result : generateNonce();
  } else {
    nonce = generateNonce();
  }

  // Add nonce to script-src and style-src
  const directives = { ...(cspOptions.directives ?? {}) };
  const nonceValue: CspSourceValue = `'nonce-${nonce}'`;

  if (directives['script-src']) {
    directives['script-src'] = [...directives['script-src'], nonceValue];
  } else {
    directives['script-src'] = ["'self'", nonceValue];
  }

  if (directives['style-src']) {
    directives['style-src'] = [...directives['style-src'], nonceValue];
  }

  return {
    cspOptions: { ...cspOptions, directives },
    nonce,
  };
}

/**
 * Analyze CSP for security issues and return warnings.
 */
export function analyzeCsp(directives: ContentSecurityPolicyDirectives): string[] {
  return analyzeCspSecurity(directives as Record<string, unknown>);
}
