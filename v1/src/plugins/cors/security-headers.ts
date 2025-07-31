/**
 * 🔥 Security Headers Manager - Enterprise-Grade Security
 * OWASP-compliant security headers with CORS integration
 */

import { NextRushRequest, NextRushResponse } from '../../types/express';
import { SecurityHeadersConfig } from './types';

export class SecurityHeadersManager {
  private config: Required<SecurityHeadersConfig>;

  constructor(config: SecurityHeadersConfig = {}) {
    this.config = {
      contentTypeOptions: config.contentTypeOptions ?? true,
      frameOptions: config.frameOptions ?? 'DENY',
      xssProtection: config.xssProtection ?? true,
      referrerPolicy:
        config.referrerPolicy ?? 'strict-origin-when-cross-origin',
      permissionsPolicy:
        config.permissionsPolicy ?? 'geolocation=(), microphone=(), camera=()',
      strictTransportSecurity: {
        enabled: config.strictTransportSecurity?.enabled ?? true,
        maxAge: config.strictTransportSecurity?.maxAge ?? 31536000, // 1 year
        includeSubDomains:
          config.strictTransportSecurity?.includeSubDomains ?? true,
        preload: config.strictTransportSecurity?.preload ?? true,
      },
    };
  }

  /**
   * 🚀 Apply security headers to response
   */
  applySecurityHeaders(req: NextRushRequest, res: NextRushResponse): void {
    // X-Content-Type-Options
    if (this.config.contentTypeOptions) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // X-Frame-Options
    res.setHeader('X-Frame-Options', this.config.frameOptions);

    // X-XSS-Protection (legacy but still useful for older browsers)
    if (this.config.xssProtection) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    // Referrer-Policy
    res.setHeader('Referrer-Policy', this.config.referrerPolicy);

    // Permissions-Policy (successor to Feature-Policy)
    res.setHeader('Permissions-Policy', this.config.permissionsPolicy);

    // Content-Security-Policy (basic default)
    if (!res.getHeader('Content-Security-Policy')) {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
      );
    }

    // Strict-Transport-Security (HTTPS only)
    if (
      this.config.strictTransportSecurity.enabled &&
      this.isSecureConnection(req)
    ) {
      const hsts = this.buildHstsHeader();
      res.setHeader('Strict-Transport-Security', hsts);
    }

    // Cross-Origin headers for enhanced security
    this.applyCrossOriginHeaders(res);
  }

  /**
   * 🚀 Apply cross-origin security headers
   */
  private applyCrossOriginHeaders(res: NextRushResponse): void {
    // Cross-Origin-Embedder-Policy
    if (!res.getHeader('Cross-Origin-Embedder-Policy')) {
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    }

    // Cross-Origin-Opener-Policy
    if (!res.getHeader('Cross-Origin-Opener-Policy')) {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    }

    // Cross-Origin-Resource-Policy
    if (!res.getHeader('Cross-Origin-Resource-Policy')) {
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    }
  }

  /**
   * 🚀 Check if connection is secure
   */
  private isSecureConnection(req: NextRushRequest): boolean {
    return (
      (req as any).secure ||
      req.headers['x-forwarded-proto'] === 'https' ||
      req.headers['x-forwarded-ssl'] === 'on' ||
      (req.connection as any)?.encrypted === true
    );
  }

  /**
   * 🚀 Build HSTS header value
   */
  private buildHstsHeader(): string {
    const { maxAge, includeSubDomains, preload } =
      this.config.strictTransportSecurity;

    let hsts = `max-age=${maxAge}`;

    if (includeSubDomains) {
      hsts += '; includeSubDomains';
    }

    if (preload) {
      hsts += '; preload';
    }

    return hsts;
  }

  /**
   * 🚀 Create middleware function
   */
  middleware() {
    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      this.applySecurityHeaders(req, res);
      next();
    };
  }

  /**
   * 🚀 Get current configuration
   */
  getConfig(): Readonly<Required<SecurityHeadersConfig>> {
    return { ...this.config };
  }

  /**
   * 🚀 Update configuration
   */
  updateConfig(newConfig: Partial<SecurityHeadersConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      strictTransportSecurity: {
        ...this.config.strictTransportSecurity,
        ...newConfig.strictTransportSecurity,
      },
    };
  }
}

/**
 * 🚀 Predefined security configurations
 */
export const SecurityPresets = {
  /**
   * Maximum security for production environments
   */
  strict: (): SecurityHeadersConfig => ({
    contentTypeOptions: true,
    frameOptions: 'DENY',
    xssProtection: true,
    referrerPolicy: 'no-referrer',
    permissionsPolicy:
      'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
    strictTransportSecurity: {
      enabled: true,
      maxAge: 63072000, // 2 years
      includeSubDomains: true,
      preload: true,
    },
  }),

  /**
   * Balanced security for most applications
   */
  balanced: (): SecurityHeadersConfig => ({
    contentTypeOptions: true,
    frameOptions: 'SAMEORIGIN',
    xssProtection: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: 'geolocation=(), microphone=(), camera=()',
    strictTransportSecurity: {
      enabled: true,
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: false,
    },
  }),

  /**
   * Relaxed security for development
   */
  relaxed: (): SecurityHeadersConfig => ({
    contentTypeOptions: true,
    frameOptions: 'SAMEORIGIN',
    xssProtection: false, // Can interfere with development
    referrerPolicy: 'unsafe-url',
    permissionsPolicy: '',
    strictTransportSecurity: {
      enabled: false,
      maxAge: 0,
      includeSubDomains: false,
      preload: false,
    },
  }),
};
