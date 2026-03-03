/**
 * @nextrush/helmet - Security presets
 *
 * Pre-configured security header configurations for common use cases.
 * Choose a preset that matches your application's security requirements.
 *
 * @packageDocumentation
 */

import { STRICT_CSP_DIRECTIVES } from './constants.js';
import { helmet } from './middleware.js';
import { restrictivePermissionsPolicy } from './permissions.js';
import type {
  ContentSecurityPolicyOptions,
  HelmetMiddleware,
  HelmetOptions,
  StrictTransportSecurityOptions,
} from './types.js';

// ============================================================================
// Individual Header Middleware
// ============================================================================

/**
 * Content Security Policy only middleware.
 *
 * @param options - CSP options
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * app.use(contentSecurityPolicy({
 *   directives: {
 *     'default-src': ["'self'"],
 *     'script-src': ["'self'", 'cdn.example.com'],
 *   }
 * }));
 * ```
 */
export function contentSecurityPolicy(
  options: ContentSecurityPolicyOptions = {}
): HelmetMiddleware {
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
 * HSTS only middleware.
 *
 * @param options - HSTS options
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * app.use(hsts({
 *   maxAge: 31536000,
 *   includeSubDomains: true,
 *   preload: true
 * }));
 * ```
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
 * X-Frame-Options only middleware.
 *
 * @param action - Frame action ('DENY' or 'SAMEORIGIN')
 * @returns Middleware function
 *
 * @deprecated Use CSP frame-ancestors instead
 */
export function frameguard(action: 'DENY' | 'SAMEORIGIN' = 'SAMEORIGIN'): HelmetMiddleware {
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
 * X-Content-Type-Options only middleware.
 *
 * @returns Middleware function
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
 * Referrer-Policy only middleware.
 *
 * @param policy - Referrer policy value(s)
 * @returns Middleware function
 */
export function referrerPolicy(
  policy: HelmetOptions['referrerPolicy'] = 'no-referrer'
): HelmetMiddleware {
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

// ============================================================================
// Security Presets
// ============================================================================

/**
 * Strict security preset - maximum protection.
 *
 * Use for applications handling sensitive data or requiring high security.
 *
 * @param overrides - Optional overrides for specific headers
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * // Maximum security for banking app
 * app.use(strictHelmet());
 *
 * // With overrides
 * app.use(strictHelmet({
 *   contentSecurityPolicy: {
 *     directives: { 'script-src': ["'self'"] }
 *   }
 * }));
 * ```
 */
export function strictHelmet(overrides: Partial<HelmetOptions> = {}): HelmetMiddleware {
  const strictOptions: HelmetOptions = {
    contentSecurityPolicy: {
      directives: STRICT_CSP_DIRECTIVES,
      useDefaults: false,
    },
    crossOriginEmbedderPolicy: 'require-corp',
    crossOriginOpenerPolicy: 'same-origin',
    crossOriginResourcePolicy: 'same-origin',
    dnsPrefetchControl: 'off',
    frameguard: 'DENY',
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    originAgentCluster: true,
    permissionsPolicy: restrictivePermissionsPolicy(),
    referrerPolicy: 'no-referrer',
    xssFilter: false,
    ieNoOpen: true,
    permittedCrossDomainPolicies: 'none',
  };

  return helmet({ ...strictOptions, ...overrides });
}

/**
 * API security preset - optimized for JSON APIs.
 *
 * Use for REST/GraphQL APIs that don't serve HTML.
 *
 * @param overrides - Optional overrides
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * app.use(apiHelmet());
 * ```
 */
export function apiHelmet(overrides: Partial<HelmetOptions> = {}): HelmetMiddleware {
  const apiOptions: HelmetOptions = {
    contentSecurityPolicy: false, // Not needed for APIs
    crossOriginEmbedderPolicy: false, // Can cause issues with API responses
    crossOriginOpenerPolicy: 'same-origin',
    crossOriginResourcePolicy: 'same-origin',
    dnsPrefetchControl: 'off',
    frameguard: 'DENY',
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
    noSniff: true,
    originAgentCluster: false,
    permissionsPolicy: undefined,
    referrerPolicy: 'no-referrer',
    xssFilter: false,
    ieNoOpen: true,
    permittedCrossDomainPolicies: 'none',
  };

  return helmet({ ...apiOptions, ...overrides });
}

/**
 * Development preset - relaxed for local development.
 *
 * @warning DO NOT use in production!
 *
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * if (process.env.NODE_ENV === 'development') {
 *   app.use(devHelmet());
 * }
 * ```
 */
export function devHelmet(): HelmetMiddleware {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    console.warn(
      '[@nextrush/helmet] WARNING: devHelmet() is being used in production. ' +
        'This provides relaxed security and is NOT recommended.'
    );
  }

  return helmet({
    contentSecurityPolicy: false, // Allow inline scripts for HMR
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    dnsPrefetchControl: false,
    frameguard: false,
    hsts: false, // Don't force HTTPS in dev
    noSniff: true, // Keep this
    originAgentCluster: false,
    referrerPolicy: 'no-referrer-when-downgrade',
    xssFilter: false,
    ieNoOpen: false,
    permittedCrossDomainPolicies: false,
  });
}

/**
 * Static assets preset - optimized for serving static files.
 *
 * @param overrides - Optional overrides
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * app.use('/static', staticHelmet());
 * ```
 */
export function staticHelmet(overrides: Partial<HelmetOptions> = {}): HelmetMiddleware {
  const staticOptions: HelmetOptions = {
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'none'"],
        'img-src': ["'self'"],
        'font-src': ["'self'"],
        'style-src': ["'self'"],
      },
      useDefaults: false,
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: 'cross-origin', // Allow cross-origin resource loading
    dnsPrefetchControl: 'off',
    frameguard: false, // Allow embedding
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
    noSniff: true,
    originAgentCluster: false,
    referrerPolicy: 'no-referrer',
    xssFilter: false,
    ieNoOpen: true,
    permittedCrossDomainPolicies: 'none',
  };

  return helmet({ ...staticOptions, ...overrides });
}

/**
 * Logout endpoint preset - clears browser data.
 *
 * Use for logout or session termination endpoints.
 *
 * @param clearData - Data types to clear
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * app.post('/logout', logoutHelmet(), async (ctx) => {
 *   // Logout logic
 *   ctx.json({ success: true });
 * });
 * ```
 */
export function logoutHelmet(
  clearData: HelmetOptions['clearSiteData'] = ['"cache"', '"cookies"', '"storage"']
): HelmetMiddleware {
  return helmet({
    clearSiteData: clearData,
    // Keep minimal security headers
    noSniff: true,
    referrerPolicy: 'no-referrer',
    // Disable most headers for this endpoint
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    dnsPrefetchControl: false,
    frameguard: false,
    hsts: false,
    originAgentCluster: false,
    xssFilter: false,
    ieNoOpen: false,
    permittedCrossDomainPolicies: false,
  });
}
