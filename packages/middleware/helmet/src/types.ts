/**
 * @nextrush/helmet - Type definitions
 *
 * Comprehensive type definitions for security headers middleware.
 * All types are designed for type safety and runtime validation.
 *
 * @packageDocumentation
 */

// ============================================================================
// Context Types
// ============================================================================

/**
 * Middleware function type for compatibility with NextRush.
 */
export type Middleware<TContext = unknown> = (
  ctx: TContext,
  next?: () => Promise<void>
) => Promise<void>;

/**
 * Minimal context interface for Helmet middleware.
 * Allows Helmet to work with any compatible context implementation.
 */
export interface HelmetContext {
  /** HTTP request method */
  method: string;
  /** Request path */
  path: string;
  /** Response status code */
  status: number;
  /** Set a response header */
  set: (name: string, value: string) => void;
  /** Get a request header */
  get?: (name: string) => string | undefined;
}

/**
 * Helmet middleware function type.
 */
export type HelmetMiddleware = (
  ctx: HelmetContext,
  next?: () => Promise<void>
) => Promise<void>;

// ============================================================================
// Content Security Policy Types
// ============================================================================

/**
 * CSP source values that can be used in directives.
 */
export type CspSourceValue =
  | "'self'"
  | "'unsafe-inline'"
  | "'unsafe-eval'"
  | "'unsafe-hashes'"
  | "'strict-dynamic'"
  | "'report-sample'"
  | "'wasm-unsafe-eval'"
  | "'none'"
  | 'blob:'
  | 'data:'
  | 'mediastream:'
  | 'filesystem:'
  | `'nonce-${string}'`
  | `'sha256-${string}'`
  | `'sha384-${string}'`
  | `'sha512-${string}'`
  | `https://${string}`
  | `http://${string}`
  | `wss://${string}`
  | `ws://${string}`
  | '*'
  | string;

/**
 * CSP sandbox values.
 */
export type CspSandboxValue =
  | 'allow-downloads'
  | 'allow-downloads-without-user-activation'
  | 'allow-forms'
  | 'allow-modals'
  | 'allow-orientation-lock'
  | 'allow-pointer-lock'
  | 'allow-popups'
  | 'allow-popups-to-escape-sandbox'
  | 'allow-presentation'
  | 'allow-same-origin'
  | 'allow-scripts'
  | 'allow-storage-access-by-user-activation'
  | 'allow-top-navigation'
  | 'allow-top-navigation-by-user-activation'
  | 'allow-top-navigation-to-custom-protocols';

/**
 * Content Security Policy directive names.
 */
export type CspDirectiveName =
  | 'default-src'
  | 'script-src'
  | 'script-src-attr'
  | 'script-src-elem'
  | 'style-src'
  | 'style-src-attr'
  | 'style-src-elem'
  | 'img-src'
  | 'font-src'
  | 'connect-src'
  | 'media-src'
  | 'object-src'
  | 'frame-src'
  | 'child-src'
  | 'worker-src'
  | 'frame-ancestors'
  | 'form-action'
  | 'base-uri'
  | 'manifest-src'
  | 'navigate-to'
  | 'prefetch-src'
  | 'sandbox'
  | 'block-all-mixed-content'
  | 'upgrade-insecure-requests'
  | 'require-trusted-types-for'
  | 'trusted-types'
  | 'report-uri'
  | 'report-to';

/**
 * Content Security Policy directive values.
 * Provides type-safe CSP configuration.
 */
export interface ContentSecurityPolicyDirectives {
  /** Default fallback for other fetch directives */
  'default-src'?: CspSourceValue[];
  /** Valid sources for JavaScript */
  'script-src'?: CspSourceValue[];
  /** Valid sources for inline script event handlers */
  'script-src-attr'?: CspSourceValue[];
  /** Valid sources for script elements */
  'script-src-elem'?: CspSourceValue[];
  /** Valid sources for stylesheets */
  'style-src'?: CspSourceValue[];
  /** Valid sources for inline styles */
  'style-src-attr'?: CspSourceValue[];
  /** Valid sources for stylesheet elements */
  'style-src-elem'?: CspSourceValue[];
  /** Valid sources for images */
  'img-src'?: CspSourceValue[];
  /** Valid sources for fonts */
  'font-src'?: CspSourceValue[];
  /** Valid sources for fetch, XHR, WebSocket */
  'connect-src'?: CspSourceValue[];
  /** Valid sources for audio/video */
  'media-src'?: CspSourceValue[];
  /** Valid sources for plugins */
  'object-src'?: CspSourceValue[];
  /** Valid sources for frames */
  'frame-src'?: CspSourceValue[];
  /** Valid sources for workers and frames */
  'child-src'?: CspSourceValue[];
  /** Valid sources for workers */
  'worker-src'?: CspSourceValue[];
  /** Valid parents for embedding */
  'frame-ancestors'?: CspSourceValue[];
  /** Valid form action URLs */
  'form-action'?: CspSourceValue[];
  /** Valid base URIs */
  'base-uri'?: CspSourceValue[];
  /** Valid sources for manifests */
  'manifest-src'?: CspSourceValue[];
  /** Valid navigation targets */
  'navigate-to'?: CspSourceValue[];
  /** Valid prefetch sources */
  'prefetch-src'?: CspSourceValue[];
  /** Block mixed content */
  'block-all-mixed-content'?: boolean;
  /** Upgrade HTTP to HTTPS */
  'upgrade-insecure-requests'?: boolean;
  /** Require Trusted Types */
  'require-trusted-types-for'?: "'script'"[];
  /** Trusted Types policy names */
  'trusted-types'?: string[];
  /** Sandbox restrictions */
  sandbox?: CspSandboxValue[] | boolean;
  /** Report URI (deprecated, use report-to) */
  'report-uri'?: string;
  /** Reporting API endpoint name */
  'report-to'?: string;
}

/**
 * Content Security Policy options.
 */
export interface ContentSecurityPolicyOptions {
  /** CSP directives */
  directives?: ContentSecurityPolicyDirectives;
  /** Use report-only mode (no enforcement) */
  reportOnly?: boolean;
  /** Merge with default directives */
  useDefaults?: boolean;
}

// ============================================================================
// Strict Transport Security Types
// ============================================================================

/**
 * Strict Transport Security options.
 */
export interface StrictTransportSecurityOptions {
  /**
   * Max age in seconds.
   * @default 15552000 (180 days)
   * @recommended 31536000 (1 year) for production
   */
  maxAge?: number;
  /** Apply to all subdomains */
  includeSubDomains?: boolean;
  /** Allow preloading in browsers */
  preload?: boolean;
}

// ============================================================================
// Referrer Policy Types
// ============================================================================

/**
 * Valid Referrer-Policy values.
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

// ============================================================================
// Frame Options Types
// ============================================================================

/**
 * X-Frame-Options values.
 * @deprecated Use CSP frame-ancestors instead
 */
export type XFrameOptionsValue = 'DENY' | 'SAMEORIGIN';

// ============================================================================
// Cross-Origin Policy Types
// ============================================================================

/**
 * Cross-Origin-Embedder-Policy values.
 */
export type CrossOriginEmbedderPolicyValue =
  | 'require-corp'
  | 'credentialless'
  | 'unsafe-none';

/**
 * Cross-Origin-Opener-Policy values.
 */
export type CrossOriginOpenerPolicyValue =
  | 'same-origin'
  | 'same-origin-allow-popups'
  | 'unsafe-none';

/**
 * Cross-Origin-Resource-Policy values.
 */
export type CrossOriginResourcePolicyValue =
  | 'same-origin'
  | 'same-site'
  | 'cross-origin';

// ============================================================================
// Permissions Policy Types
// ============================================================================

/**
 * Known Permissions-Policy feature names.
 */
export type PermissionsPolicyFeature =
  | 'accelerometer'
  | 'ambient-light-sensor'
  | 'autoplay'
  | 'battery'
  | 'camera'
  | 'display-capture'
  | 'document-domain'
  | 'encrypted-media'
  | 'fullscreen'
  | 'geolocation'
  | 'gyroscope'
  | 'hid'
  | 'identity-credentials-get'
  | 'idle-detection'
  | 'local-fonts'
  | 'magnetometer'
  | 'microphone'
  | 'midi'
  | 'otp-credentials'
  | 'payment'
  | 'picture-in-picture'
  | 'publickey-credentials-create'
  | 'publickey-credentials-get'
  | 'screen-wake-lock'
  | 'serial'
  | 'speaker-selection'
  | 'storage-access'
  | 'usb'
  | 'web-share'
  | 'xr-spatial-tracking';

/**
 * Permissions-Policy allowlist values.
 */
export type PermissionsPolicyAllowlist = 'self' | '*' | string;

/**
 * Permissions-Policy directives.
 */
export type PermissionsPolicyDirectives = {
  [K in PermissionsPolicyFeature]?: PermissionsPolicyAllowlist[];
} & {
  [key: string]: PermissionsPolicyAllowlist[] | undefined;
};

// ============================================================================
// Clear-Site-Data Types
// ============================================================================

/**
 * Clear-Site-Data directive values.
 */
export type ClearSiteDataValue =
  | '"cache"'
  | '"cookies"'
  | '"storage"'
  | '"executionContexts"'
  | '"*"';

// ============================================================================
// Main Options Types
// ============================================================================

/**
 * Comprehensive Helmet configuration options.
 * All headers can be disabled by setting to `false`.
 */
export interface HelmetOptions {
  /**
   * Content Security Policy configuration.
   * @default { useDefaults: true }
   */
  contentSecurityPolicy?: ContentSecurityPolicyOptions | false;

  /**
   * Cross-Origin-Embedder-Policy header.
   * @default 'require-corp'
   */
  crossOriginEmbedderPolicy?: CrossOriginEmbedderPolicyValue | false;

  /**
   * Cross-Origin-Opener-Policy header.
   * @default 'same-origin'
   */
  crossOriginOpenerPolicy?: CrossOriginOpenerPolicyValue | false;

  /**
   * Cross-Origin-Resource-Policy header.
   * @default 'same-origin'
   */
  crossOriginResourcePolicy?: CrossOriginResourcePolicyValue | false;

  /**
   * X-DNS-Prefetch-Control header.
   * @default 'off'
   */
  dnsPrefetchControl?: 'on' | 'off' | false;

  /**
   * X-Frame-Options header.
   * @default 'SAMEORIGIN'
   * @deprecated Use CSP frame-ancestors instead
   */
  frameguard?: XFrameOptionsValue | false;

  /**
   * Strict-Transport-Security header.
   * @default { maxAge: 15552000, includeSubDomains: true }
   */
  hsts?: StrictTransportSecurityOptions | false;

  /**
   * X-Content-Type-Options header.
   * @default true (sets 'nosniff')
   */
  noSniff?: boolean;

  /**
   * Origin-Agent-Cluster header.
   * @default true (sets '?1')
   */
  originAgentCluster?: boolean;

  /**
   * Permissions-Policy header.
   * @default undefined (not set)
   */
  permissionsPolicy?: PermissionsPolicyDirectives | false;

  /**
   * Referrer-Policy header.
   * @default 'no-referrer'
   */
  referrerPolicy?: ReferrerPolicyValue | ReferrerPolicyValue[] | false;

  /**
   * X-XSS-Protection header.
   * @default false (sets '0' which is recommended)
   */
  xssFilter?: boolean;

  /**
   * X-Download-Options header (IE only).
   * @default true (sets 'noopen')
   */
  ieNoOpen?: boolean;

  /**
   * X-Permitted-Cross-Domain-Policies header.
   * @default 'none'
   */
  permittedCrossDomainPolicies?: 'none' | 'master-only' | 'by-content-type' | 'all' | false;

  /**
   * Clear-Site-Data header (useful for logout).
   * @default undefined (not set)
   */
  clearSiteData?: ClearSiteDataValue[] | false;

  /**
   * Reporting-Endpoints header.
   * @default undefined (not set)
   */
  reportingEndpoints?: Record<string, string> | false;
}

/**
 * Nonce provider function type.
 * Called for each request to get a unique nonce.
 */
export type NonceProvider = () => string | Promise<string>;

/**
 * CSP options with nonce support.
 */
export interface CspWithNonceOptions extends ContentSecurityPolicyOptions {
  /** Generate nonce for scripts */
  generateNonce?: boolean | NonceProvider;
  /** State key to store nonce */
  nonceStateKey?: string;
}
