/**
 * @nextrush/helmet - Security Headers Middleware
 *
 * Sets various HTTP headers to help protect your app from common web vulnerabilities.
 *
 * @packageDocumentation
 */

/**
 * Minimal context interface for Helmet middleware
 */
export interface HelmetContext {
  method: string;
  path: string;
  status: number;
  set: (name: string, value: string) => void;
}

/**
 * Helmet middleware function type
 */
export type HelmetMiddleware = (
  ctx: HelmetContext,
  next?: () => Promise<void>
) => Promise<void>;

/**
 * Content Security Policy directive values
 */
export interface ContentSecurityPolicyDirectives {
  'default-src'?: string[];
  'script-src'?: string[];
  'script-src-attr'?: string[];
  'script-src-elem'?: string[];
  'style-src'?: string[];
  'style-src-attr'?: string[];
  'style-src-elem'?: string[];
  'img-src'?: string[];
  'font-src'?: string[];
  'connect-src'?: string[];
  'media-src'?: string[];
  'object-src'?: string[];
  'frame-src'?: string[];
  'child-src'?: string[];
  'worker-src'?: string[];
  'frame-ancestors'?: string[];
  'form-action'?: string[];
  'base-uri'?: string[];
  'manifest-src'?: string[];
  'block-all-mixed-content'?: boolean;
  'upgrade-insecure-requests'?: boolean;
  'report-uri'?: string;
  'report-to'?: string;
  sandbox?: string[] | boolean;
}

/**
 * Content Security Policy options
 */
export interface ContentSecurityPolicyOptions {
  /** CSP directives */
  directives?: ContentSecurityPolicyDirectives;
  /** Use report-only mode */
  reportOnly?: boolean;
  /** Use default directives */
  useDefaults?: boolean;
}

/**
 * Strict Transport Security options
 */
export interface StrictTransportSecurityOptions {
  /** Max age in seconds (default: 15552000 = 180 days) */
  maxAge?: number;
  /** Include subdomains */
  includeSubDomains?: boolean;
  /** Preload */
  preload?: boolean;
}

/**
 * Referrer Policy options
 */
export type ReferrerPolicyValue =
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url';

/**
 * X-Frame-Options value
 */
export type XFrameOptionsValue = 'DENY' | 'SAMEORIGIN';

/**
 * Permissions Policy directives
 */
export interface PermissionsPolicyDirectives {
  accelerometer?: string[];
  'ambient-light-sensor'?: string[];
  autoplay?: string[];
  battery?: string[];
  camera?: string[];
  'display-capture'?: string[];
  'document-domain'?: string[];
  'encrypted-media'?: string[];
  fullscreen?: string[];
  geolocation?: string[];
  gyroscope?: string[];
  'layout-animations'?: string[];
  'legacy-image-formats'?: string[];
  magnetometer?: string[];
  microphone?: string[];
  midi?: string[];
  'oversized-images'?: string[];
  payment?: string[];
  'picture-in-picture'?: string[];
  'publickey-credentials-get'?: string[];
  'sync-xhr'?: string[];
  usb?: string[];
  'wake-lock'?: string[];
  'xr-spatial-tracking'?: string[];
}

/**
 * Cross-Origin options
 */
export type CrossOriginValue = 'same-origin' | 'same-site' | 'cross-origin' | 'unsafe-none';

/**
 * Helmet configuration options
 */
export interface HelmetOptions {
  /**
   * Content Security Policy
   * Set to false to disable
   */
  contentSecurityPolicy?: ContentSecurityPolicyOptions | false;

  /**
   * Cross-Origin-Embedder-Policy
   * @default 'require-corp'
   */
  crossOriginEmbedderPolicy?: CrossOriginValue | false;

  /**
   * Cross-Origin-Opener-Policy
   * @default 'same-origin'
   */
  crossOriginOpenerPolicy?: CrossOriginValue | false;

  /**
   * Cross-Origin-Resource-Policy
   * @default 'same-origin'
   */
  crossOriginResourcePolicy?: CrossOriginValue | false;

  /**
   * X-DNS-Prefetch-Control
   * @default 'off'
   */
  dnsPrefetchControl?: 'on' | 'off' | false;

  /**
   * X-Frame-Options
   * @default 'SAMEORIGIN'
   */
  frameguard?: XFrameOptionsValue | false;

  /**
   * Strict-Transport-Security
   */
  hsts?: StrictTransportSecurityOptions | false;

  /**
   * X-Content-Type-Options
   * @default 'nosniff'
   */
  noSniff?: boolean;

  /**
   * Origin-Agent-Cluster
   * @default '?1'
   */
  originAgentCluster?: boolean;

  /**
   * Permissions-Policy
   */
  permissionsPolicy?: PermissionsPolicyDirectives | false;

  /**
   * Referrer-Policy
   * @default 'no-referrer'
   */
  referrerPolicy?: ReferrerPolicyValue | ReferrerPolicyValue[] | false;

  /**
   * X-XSS-Protection
   * @default '0' (disabled as recommended)
   */
  xssFilter?: boolean;

  /**
   * X-Download-Options
   * @default 'noopen'
   */
  ieNoOpen?: boolean;

  /**
   * X-Permitted-Cross-Domain-Policies
   * @default 'none'
   */
  permittedCrossDomainPolicies?: 'none' | 'master-only' | 'by-content-type' | 'all' | false;
}

/**
 * Default CSP directives
 */
const DEFAULT_CSP_DIRECTIVES: ContentSecurityPolicyDirectives = {
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
 * Build CSP header value from directives
 */
function buildCspHeader(directives: ContentSecurityPolicyDirectives): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(directives)) {
    if (value === undefined) continue;

    if (typeof value === 'boolean') {
      if (value) {
        parts.push(key);
      }
    } else if (Array.isArray(value)) {
      parts.push(`${key} ${value.join(' ')}`);
    } else {
      parts.push(`${key} ${value}`);
    }
  }

  return parts.join('; ');
}

/**
 * Build Permissions-Policy header value
 */
function buildPermissionsPolicyHeader(directives: PermissionsPolicyDirectives): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(directives)) {
    if (value === undefined) continue;

    if (value.length === 0) {
      parts.push(`${key}=()`);
    } else {
      const formattedValues = value.map((v: string) => {
        if (v === 'self' || v === '*') return v;
        return `"${v}"`;
      });
      parts.push(`${key}=(${formattedValues.join(' ')})`);
    }
  }

  return parts.join(', ');
}

/**
 * Create Helmet middleware with security headers
 *
 * @example
 * ```typescript
 * import { createApp } from '@nextrush/core';
 * import { helmet } from '@nextrush/helmet';
 *
 * const app = createApp();
 *
 * // Use default settings
 * app.use(helmet());
 *
 * // Custom configuration
 * app.use(helmet({
 *   contentSecurityPolicy: {
 *     directives: {
 *       'script-src': ["'self'", 'cdn.example.com'],
 *     },
 *   },
 *   hsts: {
 *     maxAge: 31536000,
 *     includeSubDomains: true,
 *     preload: true,
 *   },
 * }));
 * ```
 */
export function helmet(options: HelmetOptions = {}): HelmetMiddleware {
  const {
    contentSecurityPolicy = { useDefaults: true },
    crossOriginEmbedderPolicy = 'require-corp',
    crossOriginOpenerPolicy = 'same-origin',
    crossOriginResourcePolicy = 'same-origin',
    dnsPrefetchControl = 'off',
    frameguard = 'SAMEORIGIN',
    hsts = { maxAge: 15552000, includeSubDomains: true },
    noSniff = true,
    originAgentCluster = true,
    permissionsPolicy,
    referrerPolicy = 'no-referrer',
    xssFilter = false, // Disabled by default as recommended
    ieNoOpen = true,
    permittedCrossDomainPolicies = 'none',
  } = options;

  return async (ctx: HelmetContext, next?: () => Promise<void>): Promise<void> => {
    // Content-Security-Policy
    if (contentSecurityPolicy !== false) {
      const { directives = {}, reportOnly = false, useDefaults = true } = contentSecurityPolicy;
      const finalDirectives = useDefaults
        ? { ...DEFAULT_CSP_DIRECTIVES, ...directives }
        : directives;
      const headerValue = buildCspHeader(finalDirectives);
      if (headerValue) {
        const headerName = reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
        ctx.set(headerName, headerValue);
      }
    }

    // Cross-Origin-Embedder-Policy
    if (crossOriginEmbedderPolicy !== false) {
      ctx.set('Cross-Origin-Embedder-Policy', crossOriginEmbedderPolicy);
    }

    // Cross-Origin-Opener-Policy
    if (crossOriginOpenerPolicy !== false) {
      ctx.set('Cross-Origin-Opener-Policy', crossOriginOpenerPolicy);
    }

    // Cross-Origin-Resource-Policy
    if (crossOriginResourcePolicy !== false) {
      ctx.set('Cross-Origin-Resource-Policy', crossOriginResourcePolicy);
    }

    // X-DNS-Prefetch-Control
    if (dnsPrefetchControl !== false) {
      ctx.set('X-DNS-Prefetch-Control', dnsPrefetchControl);
    }

    // X-Frame-Options
    if (frameguard !== false) {
      ctx.set('X-Frame-Options', frameguard);
    }

    // Strict-Transport-Security
    if (hsts !== false) {
      const { maxAge = 15552000, includeSubDomains = true, preload = false } = hsts;
      let hstsValue = `max-age=${maxAge}`;
      if (includeSubDomains) hstsValue += '; includeSubDomains';
      if (preload) hstsValue += '; preload';
      ctx.set('Strict-Transport-Security', hstsValue);
    }

    // X-Content-Type-Options
    if (noSniff) {
      ctx.set('X-Content-Type-Options', 'nosniff');
    }

    // Origin-Agent-Cluster
    if (originAgentCluster) {
      ctx.set('Origin-Agent-Cluster', '?1');
    }

    // Permissions-Policy
    if (permissionsPolicy) {
      const headerValue = buildPermissionsPolicyHeader(permissionsPolicy);
      if (headerValue) {
        ctx.set('Permissions-Policy', headerValue);
      }
    }

    // Referrer-Policy
    if (referrerPolicy !== false) {
      const value = Array.isArray(referrerPolicy) ? referrerPolicy.join(', ') : referrerPolicy;
      ctx.set('Referrer-Policy', value);
    }

    // X-XSS-Protection
    // xssFilter: true → set '1; mode=block'
    // xssFilter: false (explicit) → skip header entirely
    // xssFilter: undefined (default) → set '0' (recommended)
    if ('xssFilter' in options && options.xssFilter === false) {
      // Explicitly disabled - skip
    } else if (xssFilter === true) {
      ctx.set('X-XSS-Protection', '1; mode=block');
    } else {
      ctx.set('X-XSS-Protection', '0');
    }

    // X-Download-Options
    if (ieNoOpen) {
      ctx.set('X-Download-Options', 'noopen');
    }

    // X-Permitted-Cross-Domain-Policies
    if (permittedCrossDomainPolicies !== false) {
      ctx.set('X-Permitted-Cross-Domain-Policies', permittedCrossDomainPolicies);
    }

    // Continue to next middleware
    if (next) await next();
  };
}

/**
 * Individual header middleware factories
 */

/**
 * Content Security Policy middleware
 */
export function contentSecurityPolicy(options: ContentSecurityPolicyOptions = {}): HelmetMiddleware {
  return helmet({
    contentSecurityPolicy: options,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    dnsPrefetchControl: false,
    frameguard: false,
    hsts: false,
    noSniff: false,
    originAgentCluster: false,
    referrerPolicy: false,
    xssFilter: false,
    ieNoOpen: false,
    permittedCrossDomainPolicies: false,
  });
}

/**
 * HSTS middleware
 */
export function hsts(options: StrictTransportSecurityOptions = {}): HelmetMiddleware {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    dnsPrefetchControl: false,
    frameguard: false,
    hsts: options,
    noSniff: false,
    originAgentCluster: false,
    referrerPolicy: false,
    xssFilter: false,
    ieNoOpen: false,
    permittedCrossDomainPolicies: false,
  });
}

/**
 * X-Frame-Options middleware
 */
export function frameguard(action: XFrameOptionsValue = 'SAMEORIGIN'): HelmetMiddleware {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    dnsPrefetchControl: false,
    frameguard: action,
    hsts: false,
    noSniff: false,
    originAgentCluster: false,
    referrerPolicy: false,
    xssFilter: false,
    ieNoOpen: false,
    permittedCrossDomainPolicies: false,
  });
}

/**
 * X-Content-Type-Options middleware
 */
export function noSniff(): HelmetMiddleware {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    dnsPrefetchControl: false,
    frameguard: false,
    hsts: false,
    noSniff: true,
    originAgentCluster: false,
    referrerPolicy: false,
    xssFilter: false,
    ieNoOpen: false,
    permittedCrossDomainPolicies: false,
  });
}

/**
 * Referrer-Policy middleware
 */
export function referrerPolicy(policy: ReferrerPolicyValue | ReferrerPolicyValue[] = 'no-referrer'): HelmetMiddleware {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    dnsPrefetchControl: false,
    frameguard: false,
    hsts: false,
    noSniff: false,
    originAgentCluster: false,
    referrerPolicy: policy,
    xssFilter: false,
    ieNoOpen: false,
    permittedCrossDomainPolicies: false,
  });
}

// Default export for convenience
export default helmet;
