import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  analyzeCsp,
  apiHelmet,
  buildCspHeader,
  buildCspWithNonce,
  buildPermissionsPolicyHeader,
  contentSecurityPolicy,
  createCspBuilder,
  createNoncedScript,
  createNoncedStyle,
  createNonceProvider,
  createPermissionsPolicyBuilder,
  CspBuilder,
  devHelmet,
  extractNonce,
  frameguard,
  generateCspNonce,
  generateNonce,
  helmet,
  hidePoweredBy,
  hsts,
  isBooleanCspDirective,
  isUnsafeCspValue,
  isValidCspDirective,
  isValidHash,
  isValidNonce,
  logoutHelmet,
  noSniff,
  PermissionsPolicyBuilder,
  referrerPolicy,
  restrictivePermissionsPolicy,
  sanitizeCspValue,
  sanitizeHeaderValue,
  securityWarning,
  staticHelmet,
  strictHelmet,
  validateHstsOptions,
  validateNonce,
  type HelmetContext,
} from '../index';

function createMockContext(): HelmetContext & { headers: Map<string, string> } {
  const headers = new Map<string, string>();
  return {
    method: 'GET',
    path: '/',
    status: 200,
    headers,
    set: (name: string, value: string) => headers.set(name, value),
    remove: (name: string) => headers.delete(name),
  };
}

describe('helmet middleware', () => {
  let ctx: ReturnType<typeof createMockContext>;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ctx = createMockContext();
    next = vi.fn().mockResolvedValue(undefined);
  });

  describe('default configuration', () => {
    it('should set all default security headers', async () => {
      const middleware = helmet();
      await middleware(ctx, next);

      expect(ctx.headers.has('Content-Security-Policy')).toBe(true);
      expect(ctx.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
      expect(ctx.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
      expect(ctx.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
      expect(ctx.headers.get('X-DNS-Prefetch-Control')).toBe('off');
      expect(ctx.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
      expect(ctx.headers.has('Strict-Transport-Security')).toBe(true);
      expect(ctx.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(ctx.headers.get('Origin-Agent-Cluster')).toBe('?1');
      expect(ctx.headers.get('Referrer-Policy')).toBe('no-referrer');
      expect(ctx.headers.get('X-XSS-Protection')).toBe('0');
      expect(ctx.headers.get('X-Download-Options')).toBe('noopen');
      expect(ctx.headers.get('X-Permitted-Cross-Domain-Policies')).toBe('none');
    });

    it('should call next middleware', async () => {
      const middleware = helmet();
      await middleware(ctx, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('should work without next function', async () => {
      const middleware = helmet();
      await expect(middleware(ctx)).resolves.not.toThrow();
    });
  });

  describe('Content-Security-Policy', () => {
    it('should set default CSP directives', async () => {
      const middleware = helmet();
      await middleware(ctx, next);

      const csp = ctx.headers.get('Content-Security-Policy');
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("object-src 'none'");
    });

    it('should allow custom directives', async () => {
      const middleware = helmet({
        contentSecurityPolicy: {
          directives: {
            'script-src': ["'self'", 'cdn.example.com'],
            'img-src': ["'self'", 'images.example.com'],
          },
          useDefaults: false,
        },
      });
      await middleware(ctx, next);

      const csp = ctx.headers.get('Content-Security-Policy');
      expect(csp).toContain("script-src 'self' cdn.example.com");
      expect(csp).toContain("img-src 'self' images.example.com");
    });

    it('should merge custom directives with defaults', async () => {
      const middleware = helmet({
        contentSecurityPolicy: {
          directives: {
            'script-src': ["'self'", 'cdn.example.com'],
          },
          useDefaults: true,
        },
      });
      await middleware(ctx, next);

      const csp = ctx.headers.get('Content-Security-Policy');
      expect(csp).toContain("script-src 'self' cdn.example.com");
      expect(csp).toContain("object-src 'none'"); // From defaults
    });

    it('should support report-only mode', async () => {
      const middleware = helmet({
        contentSecurityPolicy: {
          reportOnly: true,
          useDefaults: true,
        },
      });
      await middleware(ctx, next);

      expect(ctx.headers.has('Content-Security-Policy-Report-Only')).toBe(true);
      expect(ctx.headers.has('Content-Security-Policy')).toBe(false);
    });

    it('should support boolean directives like upgrade-insecure-requests', async () => {
      const middleware = helmet({
        contentSecurityPolicy: {
          directives: {
            'upgrade-insecure-requests': true,
            'block-all-mixed-content': true,
          },
          useDefaults: false,
        },
      });
      await middleware(ctx, next);

      const csp = ctx.headers.get('Content-Security-Policy');
      expect(csp).toContain('upgrade-insecure-requests');
      expect(csp).toContain('block-all-mixed-content');
    });

    it('should disable CSP when set to false', async () => {
      const middleware = helmet({
        contentSecurityPolicy: false,
      });
      await middleware(ctx, next);

      expect(ctx.headers.has('Content-Security-Policy')).toBe(false);
      expect(ctx.headers.has('Content-Security-Policy-Report-Only')).toBe(false);
    });

    it('should handle report-uri directive', async () => {
      const middleware = helmet({
        contentSecurityPolicy: {
          directives: {
            'default-src': ["'self'"],
            'report-uri': '/csp-report',
          },
          useDefaults: false,
        },
      });
      await middleware(ctx, next);

      const csp = ctx.headers.get('Content-Security-Policy');
      expect(csp).toContain('report-uri /csp-report');
    });
  });

  describe('Cross-Origin headers', () => {
    it('should set Cross-Origin-Embedder-Policy', async () => {
      const middleware = helmet({
        crossOriginEmbedderPolicy: 'unsafe-none',
      });
      await middleware(ctx, next);

      expect(ctx.headers.get('Cross-Origin-Embedder-Policy')).toBe('unsafe-none');
    });

    it('should disable Cross-Origin-Embedder-Policy', async () => {
      const middleware = helmet({
        crossOriginEmbedderPolicy: false,
      });
      await middleware(ctx, next);

      expect(ctx.headers.has('Cross-Origin-Embedder-Policy')).toBe(false);
    });

    it('should set Cross-Origin-Opener-Policy', async () => {
      const middleware = helmet({
        crossOriginOpenerPolicy: 'same-origin-allow-popups',
      });
      await middleware(ctx, next);

      expect(ctx.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin-allow-popups');
    });

    it('should disable Cross-Origin-Opener-Policy', async () => {
      const middleware = helmet({
        crossOriginOpenerPolicy: false,
      });
      await middleware(ctx, next);

      expect(ctx.headers.has('Cross-Origin-Opener-Policy')).toBe(false);
    });

    it('should set Cross-Origin-Resource-Policy', async () => {
      const middleware = helmet({
        crossOriginResourcePolicy: 'cross-origin',
      });
      await middleware(ctx, next);

      expect(ctx.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin');
    });

    it('should disable Cross-Origin-Resource-Policy', async () => {
      const middleware = helmet({
        crossOriginResourcePolicy: false,
      });
      await middleware(ctx, next);

      expect(ctx.headers.has('Cross-Origin-Resource-Policy')).toBe(false);
    });
  });

  describe('X-DNS-Prefetch-Control', () => {
    it('should set to off by default', async () => {
      const middleware = helmet();
      await middleware(ctx, next);

      expect(ctx.headers.get('X-DNS-Prefetch-Control')).toBe('off');
    });

    it('should allow setting to on', async () => {
      const middleware = helmet({
        dnsPrefetchControl: 'on',
      });
      await middleware(ctx, next);

      expect(ctx.headers.get('X-DNS-Prefetch-Control')).toBe('on');
    });

    it('should disable when set to false', async () => {
      const middleware = helmet({
        dnsPrefetchControl: false,
      });
      await middleware(ctx, next);

      expect(ctx.headers.has('X-DNS-Prefetch-Control')).toBe(false);
    });
  });

  describe('X-Frame-Options (frameguard)', () => {
    it('should set SAMEORIGIN by default', async () => {
      const middleware = helmet();
      await middleware(ctx, next);

      expect(ctx.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    });

    it('should allow DENY', async () => {
      const middleware = helmet({
        frameguard: 'DENY',
      });
      await middleware(ctx, next);

      expect(ctx.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('should disable when set to false', async () => {
      const middleware = helmet({
        frameguard: false,
      });
      await middleware(ctx, next);

      expect(ctx.headers.has('X-Frame-Options')).toBe(false);
    });
  });

  describe('Strict-Transport-Security (HSTS)', () => {
    it('should set HSTS with defaults', async () => {
      const middleware = helmet();
      await middleware(ctx, next);

      const hsts = ctx.headers.get('Strict-Transport-Security');
      expect(hsts).toContain('max-age=15552000');
      expect(hsts).toContain('includeSubDomains');
      expect(hsts).not.toContain('preload');
    });

    it('should allow custom maxAge', async () => {
      const middleware = helmet({
        hsts: { maxAge: 31536000 },
      });
      await middleware(ctx, next);

      const hsts = ctx.headers.get('Strict-Transport-Security');
      expect(hsts).toContain('max-age=31536000');
    });

    it('should support preload', async () => {
      const middleware = helmet({
        hsts: { maxAge: 31536000, preload: true },
      });
      await middleware(ctx, next);

      const hsts = ctx.headers.get('Strict-Transport-Security');
      expect(hsts).toContain('preload');
    });

    it('should allow disabling includeSubDomains', async () => {
      const middleware = helmet({
        hsts: { maxAge: 15552000, includeSubDomains: false },
      });
      await middleware(ctx, next);

      const hsts = ctx.headers.get('Strict-Transport-Security');
      expect(hsts).not.toContain('includeSubDomains');
    });

    it('should disable HSTS when set to false', async () => {
      const middleware = helmet({
        hsts: false,
      });
      await middleware(ctx, next);

      expect(ctx.headers.has('Strict-Transport-Security')).toBe(false);
    });
  });

  describe('X-Content-Type-Options (noSniff)', () => {
    it('should set nosniff by default', async () => {
      const middleware = helmet();
      await middleware(ctx, next);

      expect(ctx.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('should disable when set to false', async () => {
      const middleware = helmet({
        noSniff: false,
      });
      await middleware(ctx, next);

      expect(ctx.headers.has('X-Content-Type-Options')).toBe(false);
    });
  });

  describe('Origin-Agent-Cluster', () => {
    it('should set ?1 by default', async () => {
      const middleware = helmet();
      await middleware(ctx, next);

      expect(ctx.headers.get('Origin-Agent-Cluster')).toBe('?1');
    });

    it('should disable when set to false', async () => {
      const middleware = helmet({
        originAgentCluster: false,
      });
      await middleware(ctx, next);

      expect(ctx.headers.has('Origin-Agent-Cluster')).toBe(false);
    });
  });

  describe('Permissions-Policy', () => {
    it('should not set by default', async () => {
      const middleware = helmet();
      await middleware(ctx, next);

      expect(ctx.headers.has('Permissions-Policy')).toBe(false);
    });

    it('should set custom permissions policy', async () => {
      const middleware = helmet({
        permissionsPolicy: {
          camera: [],
          microphone: [],
          geolocation: ['self'],
        },
      });
      await middleware(ctx, next);

      const policy = ctx.headers.get('Permissions-Policy');
      expect(policy).toContain('camera=()');
      expect(policy).toContain('microphone=()');
      expect(policy).toContain('geolocation=(self)');
    });

    it('should handle multiple allowed origins', async () => {
      const middleware = helmet({
        permissionsPolicy: {
          geolocation: ['self', 'https://example.com'],
        },
      });
      await middleware(ctx, next);

      const policy = ctx.headers.get('Permissions-Policy');
      expect(policy).toContain('geolocation=(self "https://example.com")');
    });

    it('should handle wildcard', async () => {
      const middleware = helmet({
        permissionsPolicy: {
          camera: ['*'],
        },
      });
      await middleware(ctx, next);

      const policy = ctx.headers.get('Permissions-Policy');
      expect(policy).toContain('camera=(*)');
    });
  });

  describe('Referrer-Policy', () => {
    it('should set no-referrer by default', async () => {
      const middleware = helmet();
      await middleware(ctx, next);

      expect(ctx.headers.get('Referrer-Policy')).toBe('no-referrer');
    });

    it('should allow single policy value', async () => {
      const middleware = helmet({
        referrerPolicy: 'strict-origin-when-cross-origin',
      });
      await middleware(ctx, next);

      expect(ctx.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('should allow multiple policy values (fallback)', async () => {
      const middleware = helmet({
        referrerPolicy: ['no-referrer', 'strict-origin-when-cross-origin'],
      });
      await middleware(ctx, next);

      expect(ctx.headers.get('Referrer-Policy')).toBe(
        'no-referrer, strict-origin-when-cross-origin'
      );
    });

    it('should disable when set to false', async () => {
      const middleware = helmet({
        referrerPolicy: false,
      });
      await middleware(ctx, next);

      expect(ctx.headers.has('Referrer-Policy')).toBe(false);
    });
  });

  describe('X-XSS-Protection', () => {
    it('should set 0 by default (disabled)', async () => {
      const middleware = helmet();
      await middleware(ctx, next);

      expect(ctx.headers.get('X-XSS-Protection')).toBe('0');
    });

    it('should enable when set to true', async () => {
      const middleware = helmet({
        xssFilter: true,
      });
      await middleware(ctx, next);

      expect(ctx.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });
  });

  describe('X-Download-Options (ieNoOpen)', () => {
    it('should set noopen by default', async () => {
      const middleware = helmet();
      await middleware(ctx, next);

      expect(ctx.headers.get('X-Download-Options')).toBe('noopen');
    });

    it('should disable when set to false', async () => {
      const middleware = helmet({
        ieNoOpen: false,
      });
      await middleware(ctx, next);

      expect(ctx.headers.has('X-Download-Options')).toBe(false);
    });
  });

  describe('X-Permitted-Cross-Domain-Policies', () => {
    it('should set none by default', async () => {
      const middleware = helmet();
      await middleware(ctx, next);

      expect(ctx.headers.get('X-Permitted-Cross-Domain-Policies')).toBe('none');
    });

    it('should allow master-only', async () => {
      const middleware = helmet({
        permittedCrossDomainPolicies: 'master-only',
      });
      await middleware(ctx, next);

      expect(ctx.headers.get('X-Permitted-Cross-Domain-Policies')).toBe('master-only');
    });

    it('should allow by-content-type', async () => {
      const middleware = helmet({
        permittedCrossDomainPolicies: 'by-content-type',
      });
      await middleware(ctx, next);

      expect(ctx.headers.get('X-Permitted-Cross-Domain-Policies')).toBe('by-content-type');
    });

    it('should allow all', async () => {
      const middleware = helmet({
        permittedCrossDomainPolicies: 'all',
      });
      await middleware(ctx, next);

      expect(ctx.headers.get('X-Permitted-Cross-Domain-Policies')).toBe('all');
    });

    it('should disable when set to false', async () => {
      const middleware = helmet({
        permittedCrossDomainPolicies: false,
      });
      await middleware(ctx, next);

      expect(ctx.headers.has('X-Permitted-Cross-Domain-Policies')).toBe(false);
    });
  });
});

describe('individual middleware functions', () => {
  let ctx: ReturnType<typeof createMockContext>;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ctx = createMockContext();
    next = vi.fn().mockResolvedValue(undefined);
  });

  describe('contentSecurityPolicy()', () => {
    it('should only set CSP header', async () => {
      const middleware = contentSecurityPolicy();
      await middleware(ctx, next);

      expect(ctx.headers.has('Content-Security-Policy')).toBe(true);
      expect(ctx.headers.has('X-Frame-Options')).toBe(false);
      expect(ctx.headers.has('Strict-Transport-Security')).toBe(false);
    });

    it('should accept options', async () => {
      const middleware = contentSecurityPolicy({
        directives: { 'default-src': ["'none'"] },
        useDefaults: false,
      });
      await middleware(ctx, next);

      const csp = ctx.headers.get('Content-Security-Policy');
      expect(csp).toBe("default-src 'none'");
    });
  });

  describe('hsts()', () => {
    it('should only set HSTS header', async () => {
      const middleware = hsts();
      await middleware(ctx, next);

      expect(ctx.headers.has('Strict-Transport-Security')).toBe(true);
      expect(ctx.headers.has('Content-Security-Policy')).toBe(false);
      expect(ctx.headers.has('X-Frame-Options')).toBe(false);
    });

    it('should accept options', async () => {
      const middleware = hsts({ maxAge: 86400, preload: true });
      await middleware(ctx, next);

      const hstsHeader = ctx.headers.get('Strict-Transport-Security');
      expect(hstsHeader).toContain('max-age=86400');
      expect(hstsHeader).toContain('preload');
    });
  });

  describe('frameguard()', () => {
    it('should only set X-Frame-Options header', async () => {
      const middleware = frameguard();
      await middleware(ctx, next);

      expect(ctx.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
      expect(ctx.headers.has('Content-Security-Policy')).toBe(false);
    });

    it('should accept DENY action', async () => {
      const middleware = frameguard('DENY');
      await middleware(ctx, next);

      expect(ctx.headers.get('X-Frame-Options')).toBe('DENY');
    });
  });

  describe('noSniff()', () => {
    it('should only set X-Content-Type-Options header', async () => {
      const middleware = noSniff();
      await middleware(ctx, next);

      expect(ctx.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(ctx.headers.has('Content-Security-Policy')).toBe(false);
    });
  });

  describe('referrerPolicy()', () => {
    it('should only set Referrer-Policy header', async () => {
      const middleware = referrerPolicy();
      await middleware(ctx, next);

      expect(ctx.headers.get('Referrer-Policy')).toBe('no-referrer');
      expect(ctx.headers.has('Content-Security-Policy')).toBe(false);
    });

    it('should accept custom policy', async () => {
      const middleware = referrerPolicy('same-origin');
      await middleware(ctx, next);

      expect(ctx.headers.get('Referrer-Policy')).toBe('same-origin');
    });

    it('should accept array of policies', async () => {
      const middleware = referrerPolicy(['origin', 'unsafe-url']);
      await middleware(ctx, next);

      expect(ctx.headers.get('Referrer-Policy')).toBe('origin, unsafe-url');
    });
  });
});

describe('edge cases', () => {
  let ctx: ReturnType<typeof createMockContext>;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ctx = createMockContext();
    next = vi.fn().mockResolvedValue(undefined);
  });

  it('should handle empty options object', async () => {
    const middleware = helmet({});
    await middleware(ctx, next);

    // Should use all defaults
    expect(ctx.headers.has('Content-Security-Policy')).toBe(true);
    expect(ctx.headers.has('Strict-Transport-Security')).toBe(true);
  });

  it('should handle all options disabled', async () => {
    const middleware = helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
      dnsPrefetchControl: false,
      frameguard: false,
      hsts: false,
      noSniff: false,
      originAgentCluster: false,
      permissionsPolicy: false,
      referrerPolicy: false,
      xssFilter: false, // xssFilter=false means don't set anything (unlike default which sets '0')
      ieNoOpen: false,
      permittedCrossDomainPolicies: false,
    });
    await middleware(ctx, next);

    // All headers disabled
    expect(ctx.headers.has('Content-Security-Policy')).toBe(false);
    expect(ctx.headers.has('Cross-Origin-Embedder-Policy')).toBe(false);
    expect(ctx.headers.has('Cross-Origin-Opener-Policy')).toBe(false);
    expect(ctx.headers.has('Cross-Origin-Resource-Policy')).toBe(false);
    expect(ctx.headers.has('X-DNS-Prefetch-Control')).toBe(false);
    expect(ctx.headers.has('X-Frame-Options')).toBe(false);
    expect(ctx.headers.has('Strict-Transport-Security')).toBe(false);
    expect(ctx.headers.has('X-Content-Type-Options')).toBe(false);
    expect(ctx.headers.has('Origin-Agent-Cluster')).toBe(false);
    expect(ctx.headers.has('Permissions-Policy')).toBe(false);
    expect(ctx.headers.has('Referrer-Policy')).toBe(false);
    expect(ctx.headers.has('X-XSS-Protection')).toBe(false);
    expect(ctx.headers.has('X-Download-Options')).toBe(false);
    expect(ctx.headers.has('X-Permitted-Cross-Domain-Policies')).toBe(false);
  });

  it('should handle CSP with empty directives', async () => {
    const middleware = helmet({
      contentSecurityPolicy: {
        directives: {},
        useDefaults: false,
      },
    });
    await middleware(ctx, next);

    // Empty directives should not set header
    expect(ctx.headers.has('Content-Security-Policy')).toBe(false);
  });

  it('should handle Permissions-Policy with empty object', async () => {
    const middleware = helmet({
      permissionsPolicy: {},
    });
    await middleware(ctx, next);

    // Empty policy should not set header
    expect(ctx.headers.has('Permissions-Policy')).toBe(false);
  });

  it('should handle concurrent middleware calls', async () => {
    const middleware = helmet();

    const ctx1 = createMockContext();
    const ctx2 = createMockContext();

    await Promise.all([
      middleware(ctx1, vi.fn().mockResolvedValue(undefined)),
      middleware(ctx2, vi.fn().mockResolvedValue(undefined)),
    ]);

    expect(ctx1.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(ctx2.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
  });

  it('should pass through errors from next', async () => {
    const middleware = helmet();
    const error = new Error('Test error');
    const failingNext = vi.fn().mockRejectedValue(error);

    await expect(middleware(ctx, failingNext)).rejects.toThrow('Test error');
  });
});

// ============================================================================
// Production Readiness Tests
// ============================================================================

describe('production readiness', () => {
  describe('securityWarning logging', () => {
    it('should not log empty string when no details provided', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      securityWarning('test message');
      expect(warnSpy).toHaveBeenCalledWith(expect.any(String));
      expect(warnSpy.mock.calls[0]).toHaveLength(1);
      warnSpy.mockRestore();
    });

    it('should include details when provided', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const details = { feature: 'test' };
      securityWarning('test message', details);
      expect(warnSpy).toHaveBeenCalledWith(expect.any(String), details);
      expect(warnSpy.mock.calls[0]).toHaveLength(2);
      warnSpy.mockRestore();
    });
  });

  describe('sanitizeHeaderValue control characters', () => {
    it('should reject null bytes', () => {
      expect(() => sanitizeHeaderValue('value\x00here')).toThrow(/control characters/);
    });

    it('should reject tab characters', () => {
      expect(() => sanitizeHeaderValue('value\there')).toThrow(/control characters/);
    });

    it('should reject carriage returns', () => {
      expect(() => sanitizeHeaderValue('value\rhere')).toThrow(/control characters/);
    });

    it('should reject newlines', () => {
      expect(() => sanitizeHeaderValue('value\nhere')).toThrow(/control characters/);
    });

    it('should reject DEL character', () => {
      expect(() => sanitizeHeaderValue('value\x7fhere')).toThrow(/control characters/);
    });

    it('should accept valid header values', () => {
      expect(sanitizeHeaderValue('  valid-value  ')).toBe('valid-value');
    });
  });

  describe('HSTS NaN/Infinity validation', () => {
    it('should reject NaN maxAge', () => {
      const result = validateHstsOptions({ maxAge: NaN });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('finite');
    });

    it('should reject Infinity maxAge', () => {
      const result = validateHstsOptions({ maxAge: Infinity });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should reject negative Infinity maxAge', () => {
      const result = validateHstsOptions({ maxAge: -Infinity });
      expect(result.valid).toBe(false);
    });

    it('should throw when NaN maxAge used in helmet()', () => {
      expect(() => helmet({ hsts: { maxAge: NaN } })).toThrow(/HSTS Error/);
    });

    it('should throw when Infinity maxAge used in helmet()', () => {
      expect(() => helmet({ hsts: { maxAge: Infinity } })).toThrow(/HSTS Error/);
    });
  });

  describe('HSTS maxAge integer output', () => {
    it('should floor floating point maxAge in header', async () => {
      const ctx = createMockContext();
      const middleware = helmet({ hsts: { maxAge: 86400.7 } });
      await middleware(ctx, vi.fn().mockResolvedValue(undefined));

      const hstsHeader = ctx.headers.get('Strict-Transport-Security');
      expect(hstsHeader).toContain('max-age=86400');
      expect(hstsHeader).not.toContain('max-age=86400.7');
    });
  });

  describe('nonce generation validation', () => {
    it('should throw on length 0', () => {
      expect(() => generateNonce(0)).toThrow(/positive integer/);
    });

    it('should throw on negative length', () => {
      expect(() => generateNonce(-1)).toThrow(/positive integer/);
    });

    it('should throw on NaN length', () => {
      expect(() => generateNonce(NaN)).toThrow(/positive integer/);
    });

    it('should generate valid nonce with default length', () => {
      const nonce = generateNonce();
      expect(nonce.length).toBeGreaterThan(0);
    });
  });

  describe('nonce HTML attribute sanitization', () => {
    it('should reject nonce with double quotes in script', () => {
      expect(() => createNoncedScript('abc"def', 'console.log(1)')).toThrow(/unsafe characters/);
    });

    it('should reject nonce with angle brackets in script', () => {
      expect(() => createNoncedScript('abc<def', 'console.log(1)')).toThrow(/unsafe characters/);
    });

    it('should reject nonce with double quotes in style', () => {
      expect(() => createNoncedStyle('abc"def', 'body { color: red }')).toThrow(
        /unsafe characters/
      );
    });

    it('should reject nonce with greater-than in style', () => {
      expect(() => createNoncedStyle('abc>def', 'body { color: red }')).toThrow(
        /unsafe characters/
      );
    });

    it('should accept valid nonce in script', () => {
      const result = createNoncedScript('abc123', 'console.log(1)');
      expect(result).toBe('<script nonce="abc123">console.log(1)</script>');
    });

    it('should accept valid nonce in style', () => {
      const result = createNoncedStyle('abc123', 'body { color: red }');
      expect(result).toBe('<style nonce="abc123">body { color: red }</style>');
    });
  });

  describe('reporting endpoints URL sanitization', () => {
    it('should reject URL containing double quotes', async () => {
      const ctx = createMockContext();
      const middleware = helmet({
        reportingEndpoints: { default: 'https://example.com/"test' },
      });
      await expect(middleware(ctx, vi.fn().mockResolvedValue(undefined))).rejects.toThrow(
        /quote characters/
      );
    });

    it('should accept valid reporting endpoints', async () => {
      const ctx = createMockContext();
      const middleware = helmet({
        reportingEndpoints: {
          default: 'https://example.com/report',
          csp: 'https://csp.example.com/report',
        },
      });
      await middleware(ctx, vi.fn().mockResolvedValue(undefined));

      const header = ctx.headers.get('Reporting-Endpoints');
      expect(header).toContain('default="https://example.com/report"');
      expect(header).toContain('csp="https://csp.example.com/report"');
    });
  });

  describe('Clear-Site-Data sanitization', () => {
    it('should set valid Clear-Site-Data header', async () => {
      const ctx = createMockContext();
      const middleware = helmet({
        clearSiteData: ['"cache"', '"cookies"'],
        hsts: false,
      });
      await middleware(ctx, vi.fn().mockResolvedValue(undefined));

      const header = ctx.headers.get('Clear-Site-Data');
      expect(header).toBe('"cache", "cookies"');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// hidePoweredBy
// ═══════════════════════════════════════════════════════════════════════════

describe('hidePoweredBy', () => {
  it('should remove X-Powered-By by default', async () => {
    const ctx = createMockContext();
    ctx.headers.set('X-Powered-By', 'NextRush');
    const middleware = helmet();
    await middleware(ctx, vi.fn().mockResolvedValue(undefined));

    expect(ctx.headers.has('X-Powered-By')).toBe(false);
  });

  it('should keep X-Powered-By when disabled', async () => {
    const ctx = createMockContext();
    ctx.headers.set('X-Powered-By', 'NextRush');
    const middleware = helmet({ hidePoweredBy: false });
    await middleware(ctx, vi.fn().mockResolvedValue(undefined));

    expect(ctx.headers.has('X-Powered-By')).toBe(true);
    expect(ctx.headers.get('X-Powered-By')).toBe('NextRush');
  });

  it('should work on ctx without remove method', async () => {
    const headers = new Map<string, string>();
    headers.set('X-Powered-By', 'Express');
    const ctx: HelmetContext & { headers: Map<string, string> } = {
      method: 'GET',
      path: '/',
      status: 200,
      headers,
      set: (name: string, value: string) => headers.set(name, value),
      // no remove method
    };
    const middleware = helmet();
    await middleware(ctx, vi.fn().mockResolvedValue(undefined));

    // Without remove(), the header stays since we can't remove it
    expect(ctx.headers.has('X-Powered-By')).toBe(true);
  });

  it('standalone hidePoweredBy() preset should only remove X-Powered-By', async () => {
    const ctx = createMockContext();
    ctx.headers.set('X-Powered-By', 'Express');
    const middleware = hidePoweredBy();
    await middleware(ctx, vi.fn().mockResolvedValue(undefined));

    expect(ctx.headers.has('X-Powered-By')).toBe(false);
    // Should NOT set other security headers
    expect(ctx.headers.has('X-Content-Type-Options')).toBe(false);
    expect(ctx.headers.has('X-Frame-Options')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CspBuilder
// ═══════════════════════════════════════════════════════════════════════════

describe('CspBuilder', () => {
  it('should build basic CSP with fluent API', () => {
    const builder = new CspBuilder();
    const csp = builder.defaultSrc("'self'").scriptSrc("'self'", 'https://cdn.example.com').build();

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' https://cdn.example.com");
  });

  it('should create via factory function', () => {
    const csp = createCspBuilder().defaultSrc("'self'").build();
    expect(csp).toContain("default-src 'self'");
  });

  it('should support all directive methods', () => {
    const builder = new CspBuilder();
    const csp = builder
      .defaultSrc("'self'")
      .scriptSrc("'self'")
      .styleSrc("'self'")
      .imgSrc("'self'", 'data:')
      .fontSrc("'self'")
      .connectSrc("'self'")
      .mediaSrc("'none'")
      .objectSrc("'none'")
      .frameSrc("'none'")
      .childSrc("'none'")
      .workerSrc("'self'")
      .frameAncestors("'none'")
      .formAction("'self'")
      .baseUri("'self'")
      .manifestSrc("'self'")
      .build();

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("img-src 'self' data:");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it('should support sandbox directive', () => {
    const builder = new CspBuilder();
    const csp = builder.defaultSrc("'self'").sandbox('allow-scripts', 'allow-same-origin').build();

    expect(csp).toContain('sandbox allow-scripts allow-same-origin');
  });

  it('should support reportUri', () => {
    const builder = new CspBuilder();
    const csp = builder.defaultSrc("'self'").reportUri('https://example.com/csp-report').build();

    expect(csp).toContain('report-uri https://example.com/csp-report');
  });

  it('should support withDefaults()', () => {
    const builder = new CspBuilder();
    const csp = builder.withDefaults().build();

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
  });

  it('should support strict()', () => {
    const builder = new CspBuilder();
    const csp = builder.strict().build();

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it('should support reportOnly()', () => {
    const opts = new CspBuilder().defaultSrc("'self'").reportOnly().toOptions();

    expect(opts.reportOnly).toBe(true);
  });

  it('should convert to options with toOptions()', () => {
    const opts = new CspBuilder().defaultSrc("'self'").scriptSrc("'self'").toOptions();

    expect(opts.directives?.['default-src']).toEqual(["'self'"]);
    expect(opts.directives?.['script-src']).toEqual(["'self'"]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PermissionsPolicyBuilder
// ═══════════════════════════════════════════════════════════════════════════

describe('PermissionsPolicyBuilder', () => {
  it('should build basic permissions policy', () => {
    const builder = new PermissionsPolicyBuilder();
    const header = builder.camera().microphone().build();

    expect(header).toContain('camera=()');
    expect(header).toContain('microphone=()');
  });

  it('should create via factory function', () => {
    const header = createPermissionsPolicyBuilder().camera().build();
    expect(header).toContain('camera=()');
  });

  it('should support disable()', () => {
    const builder = new PermissionsPolicyBuilder();
    const header = builder.disable('geolocation').build();

    expect(header).toContain('geolocation=()');
  });

  it('should support allow()', () => {
    const builder = new PermissionsPolicyBuilder();
    const header = builder.allow('camera', 'https://example.com').build();

    expect(header).toContain('camera=("https://example.com")');
  });

  it('should support allowSelf()', () => {
    const builder = new PermissionsPolicyBuilder();
    const header = builder.allowSelf('camera').build();

    expect(header).toContain('camera=(self)');
  });

  it('should support allowAll()', () => {
    const builder = new PermissionsPolicyBuilder();
    const header = builder.allowAll('camera').build();

    expect(header).toContain('camera=(*)');
  });

  it('should support named feature methods', () => {
    const builder = new PermissionsPolicyBuilder();
    const header = builder.camera().microphone().geolocation().fullscreen().build();

    expect(header).toContain('camera=()');
    expect(header).toContain('microphone=()');
    expect(header).toContain('geolocation=()');
    expect(header).toContain('fullscreen=()');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// buildCspHeader
// ═══════════════════════════════════════════════════════════════════════════

describe('buildCspHeader', () => {
  it('should build from directive object', () => {
    const header = buildCspHeader({
      'default-src': ["'self'"],
      'script-src': ["'self'", 'https://cdn.example.com'],
    });

    expect(header).toContain("default-src 'self'");
    expect(header).toContain("script-src 'self' https://cdn.example.com");
  });

  it('should handle boolean directives', () => {
    const header = buildCspHeader({
      'default-src': ["'self'"],
      'upgrade-insecure-requests': true,
    });

    expect(header).toContain("default-src 'self'");
    expect(header).toContain('upgrade-insecure-requests');
  });

  it('should handle string directive values', () => {
    const header = buildCspHeader({
      'default-src': "'self'",
    });

    expect(header).toContain("default-src 'self'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// buildCspWithNonce
// ═══════════════════════════════════════════════════════════════════════════

describe('buildCspWithNonce', () => {
  it('should add nonce to script-src and style-src', () => {
    const result = buildCspWithNonce({
      generateNonce: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
      },
    });

    expect(result.nonce).toBeDefined();
    expect(result.nonce!.length).toBeGreaterThanOrEqual(16);
  });

  it('should use custom nonce provider', () => {
    const customNonce = 'custom-nonce-value-1234567890';
    const result = buildCspWithNonce({
      generateNonce: () => customNonce,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
      },
    });

    expect(result.nonce).toBe(customNonce);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// buildPermissionsPolicyHeader
// ═══════════════════════════════════════════════════════════════════════════

describe('buildPermissionsPolicyHeader', () => {
  it('should build from directive object', () => {
    const header = buildPermissionsPolicyHeader({
      camera: [],
      microphone: ['self'],
    });

    expect(header).toContain('camera=()');
    expect(header).toContain('microphone=(self)');
  });

  it('should handle wildcard', () => {
    const header = buildPermissionsPolicyHeader({
      fullscreen: ['*'],
    });

    expect(header).toContain('fullscreen=(*)');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// restrictivePermissionsPolicy
// ═══════════════════════════════════════════════════════════════════════════

describe('restrictivePermissionsPolicy', () => {
  it('should return a comprehensive restrictive policy', () => {
    const policy = restrictivePermissionsPolicy();

    expect(policy.camera).toEqual([]);
    expect(policy.microphone).toEqual([]);
    expect(policy.geolocation).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// analyzeCsp
// ═══════════════════════════════════════════════════════════════════════════

describe('analyzeCsp', () => {
  it('should return no warnings for strict CSP', () => {
    const warnings = analyzeCsp({
      'default-src': ["'none'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
    });

    expect(warnings).toHaveLength(0);
  });

  it('should warn about unsafe-inline', () => {
    const warnings = analyzeCsp({
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'"],
    });

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w: string) => w.includes('unsafe-inline'))).toBe(true);
  });

  it('should warn about unsafe-eval', () => {
    const warnings = analyzeCsp({
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-eval'"],
    });

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w: string) => w.includes('unsafe-eval'))).toBe(true);
  });

  it('should warn about wildcard sources', () => {
    const warnings = analyzeCsp({
      'default-src': ['*'],
    });

    expect(warnings.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Nonce utilities
// ═══════════════════════════════════════════════════════════════════════════

describe('nonce utilities', () => {
  describe('generateCspNonce', () => {
    it('should generate a CSP nonce string', () => {
      const nonce = generateCspNonce();
      expect(nonce).toMatch(/^'nonce-[A-Za-z0-9+/]+=*'$/);
    });
  });

  describe('createNonceProvider', () => {
    it('should create a provider that generates valid nonces', () => {
      const provider = createNonceProvider();
      const nonce = provider();

      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThanOrEqual(16);
    });

    it('should create provider with custom length', () => {
      const provider = createNonceProvider(32);
      const nonce = provider();

      expect(nonce.length).toBeGreaterThanOrEqual(32);
    });
  });

  describe('validateNonce', () => {
    it('should validate good nonces and return the raw value', () => {
      const nonce = generateNonce();
      expect(validateNonce(nonce)).toBe(nonce);
    });

    it('should return null for short nonces', () => {
      expect(validateNonce('abc')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(validateNonce('')).toBeNull();
    });
  });

  describe('extractNonce', () => {
    it('should extract nonce from CSP nonce string', () => {
      const nonce = generateNonce();
      const cspNonce = `'nonce-${nonce}'`;
      const extracted = extractNonce(cspNonce);

      expect(extracted).toBe(nonce);
    });

    it('should return null for non-nonce string', () => {
      const extracted = extractNonce("'self'");
      expect(extracted).toBeNull();
    });
  });

  describe('isValidNonce', () => {
    it('should accept valid nonces (>= 16 chars)', () => {
      expect(isValidNonce('abcdefghijklmnop')).toBe(true);
    });

    it('should reject short nonces', () => {
      expect(isValidNonce('short')).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Validation utilities
// ═══════════════════════════════════════════════════════════════════════════

describe('validation utilities', () => {
  describe('isValidCspDirective', () => {
    it('should accept valid CSP directives', () => {
      expect(isValidCspDirective('default-src')).toBe(true);
      expect(isValidCspDirective('script-src')).toBe(true);
      expect(isValidCspDirective('style-src')).toBe(true);
      expect(isValidCspDirective('img-src')).toBe(true);
    });

    it('should reject invalid CSP directives', () => {
      expect(isValidCspDirective('invalid-directive')).toBe(false);
      expect(isValidCspDirective('')).toBe(false);
    });
  });

  describe('isBooleanCspDirective', () => {
    it('should identify boolean CSP directives', () => {
      expect(isBooleanCspDirective('upgrade-insecure-requests')).toBe(true);
      expect(isBooleanCspDirective('block-all-mixed-content')).toBe(true);
    });

    it('should reject non-boolean CSP directives', () => {
      expect(isBooleanCspDirective('default-src')).toBe(false);
      expect(isBooleanCspDirective('script-src')).toBe(false);
    });
  });

  describe('isUnsafeCspValue', () => {
    it('should identify unsafe CSP values', () => {
      expect(isUnsafeCspValue("'unsafe-inline'")).toBe(true);
      expect(isUnsafeCspValue("'unsafe-eval'")).toBe(true);
    });

    it('should accept safe CSP values', () => {
      expect(isUnsafeCspValue("'self'")).toBe(false);
      expect(isUnsafeCspValue("'none'")).toBe(false);
    });
  });

  describe('isValidHash', () => {
    it('should accept valid CSP hashes', () => {
      expect(isValidHash("'sha256-abc123def456ghi789jkl012mno345pqr678stu901='")).toBe(true);
    });

    it('should reject invalid hashes', () => {
      expect(isValidHash('not-a-hash')).toBe(false);
    });
  });

  describe('sanitizeCspValue', () => {
    it('should pass through valid CSP values', () => {
      expect(sanitizeCspValue("'self'")).toBe("'self'");
      expect(sanitizeCspValue('https://example.com')).toBe('https://example.com');
    });

    it('should reject values with semicolons', () => {
      expect(() => sanitizeCspValue('value;injection')).toThrow();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Security Presets
// ═══════════════════════════════════════════════════════════════════════════

describe('security presets', () => {
  describe('strictHelmet', () => {
    it('should set restrictive security headers', async () => {
      const ctx = createMockContext();
      const middleware = strictHelmet();
      await middleware(ctx, vi.fn().mockResolvedValue(undefined));

      expect(ctx.headers.has('Content-Security-Policy')).toBe(true);
      expect(ctx.headers.has('Strict-Transport-Security')).toBe(true);
      expect(ctx.headers.get('X-Frame-Options')).toBe('DENY');
      expect(ctx.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });
  });

  describe('apiHelmet', () => {
    it('should set API-appropriate security headers', async () => {
      const ctx = createMockContext();
      const middleware = apiHelmet();
      await middleware(ctx, vi.fn().mockResolvedValue(undefined));

      expect(ctx.headers.has('X-Content-Type-Options')).toBe(true);
    });
  });

  describe('devHelmet', () => {
    it('should set development-friendly security headers', async () => {
      const ctx = createMockContext();
      const middleware = devHelmet();
      await middleware(ctx, vi.fn().mockResolvedValue(undefined));

      // Dev should be more relaxed
      expect(ctx.headers.has('X-Content-Type-Options')).toBe(true);
    });
  });

  describe('staticHelmet', () => {
    it('should set static-file appropriate headers', async () => {
      const ctx = createMockContext();
      const middleware = staticHelmet();
      await middleware(ctx, vi.fn().mockResolvedValue(undefined));

      expect(ctx.headers.has('X-Content-Type-Options')).toBe(true);
    });
  });

  describe('logoutHelmet', () => {
    it('should set Clear-Site-Data header', async () => {
      const ctx = createMockContext();
      const middleware = logoutHelmet();
      await middleware(ctx, vi.fn().mockResolvedValue(undefined));

      expect(ctx.headers.has('Clear-Site-Data')).toBe(true);
      const clearData = ctx.headers.get('Clear-Site-Data')!;
      expect(clearData).toContain('"cache"');
      expect(clearData).toContain('"cookies"');
      expect(clearData).toContain('"storage"');
    });

    it('should accept custom clear data options', async () => {
      const ctx = createMockContext();
      const middleware = logoutHelmet(['"cookies"']);
      await middleware(ctx, vi.fn().mockResolvedValue(undefined));

      expect(ctx.headers.get('Clear-Site-Data')).toBe('"cookies"');
    });
  });
});
