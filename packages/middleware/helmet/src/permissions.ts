/**
 * @nextrush/helmet - Permissions Policy Builder
 *
 * Build Permissions-Policy headers with type-safe feature names.
 *
 * @packageDocumentation
 */

import type { PermissionsPolicyAllowlist, PermissionsPolicyDirectives, PermissionsPolicyFeature } from './types.js';
import { sanitizeHeaderValue } from './validation.js';

/**
 * Build Permissions-Policy header value from directives.
 *
 * @param directives - Permissions-Policy directives
 * @returns Formatted header value
 *
 * @example
 * ```typescript
 * const policy = buildPermissionsPolicyHeader({
 *   camera: [],
 *   microphone: [],
 *   geolocation: ['self'],
 *   fullscreen: ['self', 'https://example.com']
 * });
 * // "camera=(), microphone=(), geolocation=(self), fullscreen=(self "https://example.com")"
 * ```
 */
export function buildPermissionsPolicyHeader(directives: PermissionsPolicyDirectives): string {
  const parts: string[] = [];

  for (const [feature, allowlist] of Object.entries(directives)) {
    if (allowlist === undefined) continue;

    // Validate feature name (no special characters)
    const sanitizedFeature = sanitizeHeaderValue(feature);

    if (allowlist.length === 0) {
      // Empty allowlist = disabled
      parts.push(`${sanitizedFeature}=()`);
    } else {
      // Format allowlist values
      const formattedValues = allowlist.map((value) => {
        const sanitized = sanitizeHeaderValue(value);
        if (sanitized === 'self' || sanitized === '*') {
          return sanitized;
        }
        // Quote origins
        return `"${sanitized}"`;
      });
      parts.push(`${sanitizedFeature}=(${formattedValues.join(' ')})`);
    }
  }

  return parts.join(', ');
}

/**
 * Permissions-Policy builder with fluent API.
 *
 * @example
 * ```typescript
 * const policy = new PermissionsPolicyBuilder()
 *   .disable('camera', 'microphone', 'geolocation')
 *   .allow('fullscreen', 'self')
 *   .allow('payment', 'self', 'https://payment.example.com')
 *   .build();
 * ```
 */
export class PermissionsPolicyBuilder {
  private directives: PermissionsPolicyDirectives = {};

  /**
   * Disable features completely (empty allowlist).
   */
  disable(...features: PermissionsPolicyFeature[]): this {
    for (const feature of features) {
      this.directives[feature] = [];
    }
    return this;
  }

  /**
   * Allow a feature for specific origins.
   */
  allow(feature: PermissionsPolicyFeature, ...allowlist: PermissionsPolicyAllowlist[]): this {
    this.directives[feature] = allowlist;
    return this;
  }

  /**
   * Allow a feature for self only.
   */
  allowSelf(feature: PermissionsPolicyFeature): this {
    this.directives[feature] = ['self'];
    return this;
  }

  /**
   * Allow a feature for all origins.
   */
  allowAll(feature: PermissionsPolicyFeature): this {
    this.directives[feature] = ['*'];
    return this;
  }

  /**
   * Set camera policy.
   */
  camera(...allowlist: PermissionsPolicyAllowlist[]): this {
    this.directives.camera = allowlist;
    return this;
  }

  /**
   * Set microphone policy.
   */
  microphone(...allowlist: PermissionsPolicyAllowlist[]): this {
    this.directives.microphone = allowlist;
    return this;
  }

  /**
   * Set geolocation policy.
   */
  geolocation(...allowlist: PermissionsPolicyAllowlist[]): this {
    this.directives.geolocation = allowlist;
    return this;
  }

  /**
   * Set fullscreen policy.
   */
  fullscreen(...allowlist: PermissionsPolicyAllowlist[]): this {
    this.directives.fullscreen = allowlist;
    return this;
  }

  /**
   * Set payment policy.
   */
  payment(...allowlist: PermissionsPolicyAllowlist[]): this {
    this.directives.payment = allowlist;
    return this;
  }

  /**
   * Set USB policy.
   */
  usb(...allowlist: PermissionsPolicyAllowlist[]): this {
    this.directives.usb = allowlist;
    return this;
  }

  /**
   * Set autoplay policy.
   */
  autoplay(...allowlist: PermissionsPolicyAllowlist[]): this {
    this.directives.autoplay = allowlist;
    return this;
  }

  /**
   * Set picture-in-picture policy.
   */
  pictureInPicture(...allowlist: PermissionsPolicyAllowlist[]): this {
    this.directives['picture-in-picture'] = allowlist;
    return this;
  }

  /**
   * Set a custom directive.
   */
  directive(name: string, allowlist: PermissionsPolicyAllowlist[]): this {
    (this.directives as Record<string, PermissionsPolicyAllowlist[]>)[name] = allowlist;
    return this;
  }

  /**
   * Get the directives object.
   */
  getDirectives(): PermissionsPolicyDirectives {
    return { ...this.directives };
  }

  /**
   * Build the header string.
   */
  build(): string {
    return buildPermissionsPolicyHeader(this.directives);
  }
}

/**
 * Create a new Permissions-Policy builder.
 */
export function createPermissionsPolicyBuilder(): PermissionsPolicyBuilder {
  return new PermissionsPolicyBuilder();
}

/**
 * Restrictive Permissions-Policy preset.
 * Disables most powerful features by default.
 */
export function restrictivePermissionsPolicy(): PermissionsPolicyDirectives {
  return {
    accelerometer: [],
    'ambient-light-sensor': [],
    autoplay: [],
    battery: [],
    camera: [],
    'display-capture': [],
    'document-domain': [],
    'encrypted-media': [],
    fullscreen: ['self'],
    geolocation: [],
    gyroscope: [],
    magnetometer: [],
    microphone: [],
    midi: [],
    payment: [],
    'picture-in-picture': ['self'],
    usb: [],
    'xr-spatial-tracking': [],
  };
}
