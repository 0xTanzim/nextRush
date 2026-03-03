import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  contentSecurityPolicy,
  createNoncedScript,
  createNoncedStyle,
  frameguard,
  generateNonce,
  helmet,
  hsts,
  noSniff,
  referrerPolicy,
  sanitizeHeaderValue,
  securityWarning,
  validateHstsOptions,
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
        crossOriginOpenerPolicy: 'same-site',
      });
      await middleware(ctx, next);

      expect(ctx.headers.get('Cross-Origin-Opener-Policy')).toBe('same-site');
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
