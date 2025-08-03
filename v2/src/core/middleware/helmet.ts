/**
 * Helmet Middleware for NextRush v2
 *
 * Provides security headers to protect against common vulnerabilities
 *
 * @packageDocumentation
 */

import type { Context } from '@/types/context';
import type { HelmetOptions, Middleware } from './types';

/**
 * Default Helmet security options
 */
const DEFAULT_HELMET_OPTIONS: HelmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'SAMEORIGIN' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
};

/**
 * Generate Content Security Policy header value
 */
function generateCSPHeader(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
}

/**
 * Create Helmet middleware for security headers
 *
 * @param options - Helmet configuration options
 * @returns Helmet middleware function
 *
 * @example
 * ```typescript
 * import { helmet } from '@/core/middleware/helmet';
 *
 * const app = createApp();
 * app.use(helmet());
 *
 * // With custom options
 * app.use(helmet({
 *   contentSecurityPolicy: {
 *     directives: {
 *       defaultSrc: ["'self'"],
 *       scriptSrc: ["'self'", "'unsafe-inline'"],
 *     },
 *   },
 * }));
 * ```
 */
export function helmet(options: HelmetOptions = {}): Middleware {
  const config = { ...DEFAULT_HELMET_OPTIONS, ...options };

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    // Hide X-Powered-By header
    if (config.hidePoweredBy) {
      ctx.res.removeHeader('X-Powered-By');
    }

    // X-Content-Type-Options: nosniff
    if (config.noSniff) {
      ctx.res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // X-Frame-Options: DENY
    if (config.frameguard) {
      const action = config.frameguard.action || 'deny';
      ctx.res.setHeader('X-Frame-Options', action.toUpperCase());
    }

    // X-XSS-Protection: 1; mode=block
    if (config.xssFilter) {
      ctx.res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    // X-DNS-Prefetch-Control
    if (config.dnsPrefetchControl) {
      const allow = config.dnsPrefetchControl.allow || false;
      ctx.res.setHeader('X-DNS-Prefetch-Control', allow ? 'on' : 'off');
    }

    // X-Download-Options: noopen
    if (config.ieNoOpen) {
      ctx.res.setHeader('X-Download-Options', 'noopen');
    }

    // X-Permitted-Cross-Domain-Policies
    if (config.permittedCrossDomainPolicies) {
      const policy =
        config.permittedCrossDomainPolicies.permittedPolicies || 'none';
      ctx.res.setHeader('X-Permitted-Cross-Domain-Policies', policy);
    }

    // Referrer-Policy
    if (config.referrerPolicy) {
      const policy =
        config.referrerPolicy.policy || 'strict-origin-when-cross-origin';
      ctx.res.setHeader('Referrer-Policy', policy);
    }

    // Strict-Transport-Security
    if (config.hsts) {
      const maxAge = config.hsts.maxAge || 31536000;
      const includeSubDomains = config.hsts.includeSubDomains || false;
      const preload = config.hsts.preload || false;

      let hstsValue = `max-age=${maxAge}`;
      if (includeSubDomains) hstsValue += '; includeSubDomains';
      if (preload) hstsValue += '; preload';

      ctx.res.setHeader('Strict-Transport-Security', hstsValue);
    }

    // Content-Security-Policy
    if (config.contentSecurityPolicy) {
      const cspValue = generateCSPHeader(
        config.contentSecurityPolicy.directives
      );
      ctx.res.setHeader('Content-Security-Policy', cspValue);
    }

    await next();
  };
}

/**
 * Create Helmet middleware with metrics
 *
 * @param options - Helmet configuration options
 * @returns Helmet middleware function with performance monitoring
 */
export function helmetWithMetrics(options: HelmetOptions = {}): Middleware {
  const helmetMiddleware = helmet(options);

  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    const start = process.hrtime.bigint();

    await helmetMiddleware(ctx, async () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds

      // Store duration in context for external monitoring
      (ctx as any).helmetDuration = duration;

      await next();
    });
  };
}

/**
 * Helmet utilities for testing and advanced usage
 */
export const helmetUtils = {
  /**
   * Generate CSP header value for testing
   */
  generateCSPHeader,

  /**
   * Default helmet options
   */
  DEFAULT_OPTIONS: DEFAULT_HELMET_OPTIONS,
};
