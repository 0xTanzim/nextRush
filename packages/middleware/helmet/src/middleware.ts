/**
 * @nextrush/helmet - Core middleware implementation
 *
 * Enterprise-grade security headers middleware for NextRush v3.
 * Sets comprehensive HTTP security headers following OWASP recommendations.
 *
 * @packageDocumentation
 */

import type { Middleware as NexrushMiddleware } from '@nextrush/types';

import { DEFAULT_CSP_DIRECTIVES, DEFAULT_HSTS_MAX_AGE, HEADERS } from './constants.js';
import { buildCspHeader } from './csp.js';
import { buildPermissionsPolicyHeader } from './permissions.js';
import type {
  ClearSiteDataValue,
  HelmetContext,
  HelmetOptions,
  StrictTransportSecurityOptions,
} from './types.js';
import { sanitizeHeaderValue, securityWarning, validateHstsOptions } from './validation.js';

/**
 * Build HSTS header value.
 */
function buildHstsHeader(options: StrictTransportSecurityOptions): string {
  const { maxAge = DEFAULT_HSTS_MAX_AGE, includeSubDomains = true, preload = false } = options;

  let value = `max-age=${Math.floor(maxAge)}`;
  if (includeSubDomains) value += '; includeSubDomains';
  if (preload) value += '; preload';

  return value;
}

/**
 * Build Reporting-Endpoints header value.
 */
function buildReportingEndpointsHeader(endpoints: Record<string, string>): string {
  return Object.entries(endpoints)
    .map(([name, url]) => {
      const sanitizedName = sanitizeHeaderValue(name);
      const sanitizedUrl = sanitizeHeaderValue(url);
      if (sanitizedUrl.includes('"')) {
        throw new Error(
          `[@nextrush/helmet] Security Error: Reporting endpoint URL contains quote characters.`
        );
      }
      return `${sanitizedName}="${sanitizedUrl}"`;
    })
    .join(', ');
}

/**
 * Build Clear-Site-Data header value.
 */
function buildClearSiteDataHeader(values: ClearSiteDataValue[]): string {
  return values.map((v) => sanitizeHeaderValue(v)).join(', ');
}

/**
 * Create Helmet middleware with comprehensive security headers.
 *
 * @param options - Helmet configuration
 * @returns Middleware function
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
export function helmet(options: HelmetOptions = {}): NexrushMiddleware {
  const {
    contentSecurityPolicy = { useDefaults: true },
    crossOriginEmbedderPolicy = 'require-corp',
    crossOriginOpenerPolicy = 'same-origin',
    crossOriginResourcePolicy = 'same-origin',
    dnsPrefetchControl = 'off',
    frameguard = 'SAMEORIGIN',
    hsts = { maxAge: DEFAULT_HSTS_MAX_AGE, includeSubDomains: true },
    noSniff = true,
    originAgentCluster = true,
    permissionsPolicy,
    referrerPolicy = 'no-referrer',
    xssFilter = false,
    ieNoOpen = true,
    permittedCrossDomainPolicies = 'none',
    clearSiteData,
    reportingEndpoints,
  } = options;

  // Validate HSTS options and warn about issues
  if (hsts !== false) {
    const hstsValidation = validateHstsOptions(hsts);
    if (!hstsValidation.valid) {
      for (const error of hstsValidation.errors) {
        throw new Error(`[@nextrush/helmet] HSTS Error: ${error}`);
      }
    }
    for (const warning of hstsValidation.warnings) {
      securityWarning(warning);
    }
  }

  return (async (ctx: HelmetContext, next?: () => Promise<void>): Promise<void> => {
    // Content-Security-Policy
    if (contentSecurityPolicy !== false) {
      const { directives = {}, reportOnly = false, useDefaults = true } = contentSecurityPolicy;
      const finalDirectives = useDefaults
        ? { ...DEFAULT_CSP_DIRECTIVES, ...directives }
        : directives;
      const headerValue = buildCspHeader(finalDirectives);
      if (headerValue) {
        const headerName = reportOnly ? HEADERS.CSP_REPORT_ONLY : HEADERS.CSP;
        ctx.set(headerName, headerValue);
      }
    }

    // Cross-Origin-Embedder-Policy
    if (crossOriginEmbedderPolicy !== false) {
      ctx.set(HEADERS.COEP, crossOriginEmbedderPolicy);
    }

    // Cross-Origin-Opener-Policy
    if (crossOriginOpenerPolicy !== false) {
      ctx.set(HEADERS.COOP, crossOriginOpenerPolicy);
    }

    // Cross-Origin-Resource-Policy
    if (crossOriginResourcePolicy !== false) {
      ctx.set(HEADERS.CORP, crossOriginResourcePolicy);
    }

    // X-DNS-Prefetch-Control
    if (dnsPrefetchControl !== false) {
      ctx.set(HEADERS.X_DNS_PREFETCH_CONTROL, dnsPrefetchControl);
    }

    // X-Frame-Options (deprecated but still useful for legacy browsers)
    if (frameguard !== false) {
      ctx.set(HEADERS.X_FRAME_OPTIONS, frameguard);
    }

    // Strict-Transport-Security
    if (hsts !== false) {
      ctx.set(HEADERS.HSTS, buildHstsHeader(hsts));
    }

    // X-Content-Type-Options
    if (noSniff) {
      ctx.set(HEADERS.X_CONTENT_TYPE_OPTIONS, 'nosniff');
    }

    // Origin-Agent-Cluster
    if (originAgentCluster) {
      ctx.set(HEADERS.ORIGIN_AGENT_CLUSTER, '?1');
    }

    // Permissions-Policy
    if (permissionsPolicy) {
      const headerValue = buildPermissionsPolicyHeader(permissionsPolicy);
      if (headerValue) {
        ctx.set(HEADERS.PERMISSIONS_POLICY, headerValue);
      }
    }

    // Referrer-Policy
    if (referrerPolicy !== false) {
      const value = Array.isArray(referrerPolicy) ? referrerPolicy.join(', ') : referrerPolicy;
      ctx.set(HEADERS.REFERRER_POLICY, value);
    }

    // X-XSS-Protection
    if ('xssFilter' in options && options.xssFilter === false) {
      // Explicitly disabled - skip header
    } else if (xssFilter === true) {
      ctx.set(HEADERS.X_XSS_PROTECTION, '1; mode=block');
    } else {
      // Default: disable (recommended by OWASP)
      ctx.set(HEADERS.X_XSS_PROTECTION, '0');
    }

    // X-Download-Options (IE only)
    if (ieNoOpen) {
      ctx.set(HEADERS.X_DOWNLOAD_OPTIONS, 'noopen');
    }

    // X-Permitted-Cross-Domain-Policies
    if (permittedCrossDomainPolicies !== false) {
      ctx.set(HEADERS.X_PERMITTED_CROSS_DOMAIN_POLICIES, permittedCrossDomainPolicies);
    }

    // Clear-Site-Data (useful for logout endpoints)
    if (clearSiteData && clearSiteData.length > 0) {
      ctx.set(HEADERS.CLEAR_SITE_DATA, buildClearSiteDataHeader(clearSiteData));
    }

    // Reporting-Endpoints
    if (reportingEndpoints) {
      ctx.set(HEADERS.REPORTING_ENDPOINTS, buildReportingEndpointsHeader(reportingEndpoints));
    }

    // Continue to next middleware
    if (next) await next();
  }) as unknown as NexrushMiddleware;
}

// Default export
export default helmet;
