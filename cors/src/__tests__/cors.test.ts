/**
 * @nextrush/cors - Enterprise-grade CORS Middleware Tests
 *
 * Comprehensive test suite covering:
 * - Basic functionality
 * - Origin validation (string, array, regex, function)
 * - Security features (null origin, ReDoS, credentials)
 * - Preflight handling
 * - Private Network Access (PNA)
 * - Edge cases
 */

import { describe, expect, it, vi } from 'vitest';
import { cors, simpleCors, strictCors } from '../index';

// ============================================================================
// Mock Context Factory
// ============================================================================

interface MockContext {
  method: string;
  path: string;
  status: number;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
  responseHeaders: Record<string, string>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  next: ReturnType<typeof vi.fn>;
}

function createMockContext(overrides: Partial<MockContext> = {}): MockContext {
  const responseHeaders: Record<string, string> = {};
  const requestHeaders: Record<string, string | undefined> = {
    origin: 'https://example.com',
    ...overrides.headers,
  };

  return {
    method: 'GET',
    path: '/test',
    status: 200,
    body: undefined,
    headers: requestHeaders,
    responseHeaders,
    get: vi.fn((name: string) => {
      const key = name.toLowerCase();
      return requestHeaders[key];
    }),
    set: vi.fn((name: string, value: string) => {
      responseHeaders[name] = value;
    }),
    next: vi.fn(),
    ...overrides,
  };
}

// ============================================================================
// Basic Functionality Tests
// ============================================================================

describe('cors middleware', () => {
  describe('basic functionality', () => {
    it('should skip CORS for same-origin requests (no Origin header)', async () => {
      const middleware = cors({ origin: '*' });
      const ctx = createMockContext({
        headers: { origin: undefined },
        get: vi.fn(() => undefined),
      });
      const next = vi.fn();

      await middleware(ctx as any, next);

      // Should only set Vary header and call next
      expect(ctx.set).toHaveBeenCalledWith('Vary', 'Origin');
      expect(next).toHaveBeenCalled();
    });

    it('should call next middleware', async () => {
      const middleware = cors({ origin: '*' });
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(next).toHaveBeenCalled();
    });

    it('should use ctx.next() when next parameter is not provided', async () => {
      const middleware = cors({ origin: '*' });
      const ctx = createMockContext();

      await middleware(ctx as any);

      expect(ctx.next).toHaveBeenCalled();
    });

    it('should set Access-Control-Allow-Origin for wildcard', async () => {
      const middleware = cors({ origin: '*' });
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    });
  });

  // ============================================================================
  // Origin Option Tests
  // ============================================================================

  describe('origin option', () => {
    it('should allow wildcard origin', async () => {
      const middleware = cors({ origin: '*' });
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    });

    it('should reflect origin when true', async () => {
      const middleware = cors({ origin: true });
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
    });

    it('should not set CORS headers when origin is false', async () => {
      const middleware = cors({ origin: false });
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.anything());
      expect(next).toHaveBeenCalled();
    });

    it('should allow specific origin string', async () => {
      const middleware = cors({ origin: 'https://example.com' });
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
    });

    it('should reject non-matching origin string', async () => {
      const middleware = cors({ origin: 'https://other.com' });
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.anything());
      expect(next).toHaveBeenCalled();
    });

    it('should allow origin from array', async () => {
      const middleware = cors({ origin: ['https://example.com', 'https://app.com'] });
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
    });

    it('should reject origin not in array', async () => {
      const middleware = cors({ origin: ['https://other.com', 'https://app.com'] });
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.anything());
    });

    it('should allow origin matching regex', async () => {
      const middleware = cors({ origin: /\.example\.com$/ });
      const ctx = createMockContext({
        headers: { origin: 'https://app.example.com' },
        get: vi.fn((name) => (name.toLowerCase() === 'origin' ? 'https://app.example.com' : undefined)),
      });
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://app.example.com');
    });

    it('should reject origin not matching regex', async () => {
      const middleware = cors({ origin: /\.example\.com$/ });
      const ctx = createMockContext({
        headers: { origin: 'https://other.com' },
        get: vi.fn((name) => (name.toLowerCase() === 'origin' ? 'https://other.com' : undefined)),
      });
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.anything());
    });

    it('should allow origin using function returning true', async () => {
      const validator = vi.fn().mockReturnValue(true);
      const middleware = cors({ origin: validator });
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(validator).toHaveBeenCalled();
      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
    });

    it('should reject origin using function returning false', async () => {
      const validator = vi.fn().mockReturnValue(false);
      const middleware = cors({ origin: validator });
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.anything());
    });

    it('should allow custom origin from function returning string', async () => {
      const validator = vi.fn().mockReturnValue('https://custom.com');
      const middleware = cors({ origin: validator });
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://custom.com');
    });

    it('should support async origin validator', async () => {
      const validator = vi.fn().mockResolvedValue(true);
      const middleware = cors({ origin: validator });
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
    });
  });

  // ============================================================================
  // Credentials Option Tests
  // ============================================================================

  describe('credentials option', () => {
    it('should not set credentials header by default', async () => {
      const middleware = cors({ origin: '*' });
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Credentials', expect.anything());
    });

    it('should set credentials header when enabled', async () => {
      const middleware = cors({ origin: 'https://example.com', credentials: true });
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
    });

    it('should throw error when credentials=true with origin="*"', () => {
      expect(() => cors({ origin: '*', credentials: true })).toThrow(/Security Error/);
    });
  });

  // ============================================================================
  // Exposed Headers Option Tests
  // ============================================================================

  describe('exposedHeaders option', () => {
    it('should set exposed headers as string', async () => {
      const middleware = cors({ origin: '*', exposedHeaders: 'X-Custom-Header' });
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Expose-Headers', 'X-Custom-Header');
    });

    it('should set exposed headers as array', async () => {
      const middleware = cors({ origin: '*', exposedHeaders: ['X-Custom-Header', 'X-Another-Header'] });
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Expose-Headers', 'X-Custom-Header,X-Another-Header');
    });
  });

  // ============================================================================
  // Preflight Request Tests
  // ============================================================================

  describe('preflight requests (OPTIONS)', () => {
    it('should handle preflight request', async () => {
      const middleware = cors({ origin: '*' });
      const ctx = createMockContext({
        method: 'OPTIONS',
        get: vi.fn((name) => {
          if (name.toLowerCase() === 'origin') return 'https://example.com';
          if (name.toLowerCase() === 'access-control-request-method') return 'POST';
          return undefined;
        }),
      });
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.status).toBe(204);
      expect(ctx.body).toBe('');
      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
    });

    it('should set custom methods as array', async () => {
      const middleware = cors({ origin: '*', methods: ['GET', 'POST'] });
      const ctx = createMockContext({
        method: 'OPTIONS',
        get: vi.fn((name) => {
          if (name.toLowerCase() === 'origin') return 'https://example.com';
          if (name.toLowerCase() === 'access-control-request-method') return 'POST';
          return undefined;
        }),
      });
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET,POST');
    });

    it('should set methods from string', async () => {
      const middleware = cors({ origin: '*', methods: 'GET,POST' });
      const ctx = createMockContext({
        method: 'OPTIONS',
        get: vi.fn((name) => {
          if (name.toLowerCase() === 'origin') return 'https://example.com';
          if (name.toLowerCase() === 'access-control-request-method') return 'POST';
          return undefined;
        }),
      });
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET,POST');
    });

    it('should set allowed headers', async () => {
      const middleware = cors({ origin: '*', allowedHeaders: ['Content-Type', 'Authorization'] });
      const ctx = createMockContext({
        method: 'OPTIONS',
        get: vi.fn((name) => {
          if (name.toLowerCase() === 'origin') return 'https://example.com';
          if (name.toLowerCase() === 'access-control-request-method') return 'POST';
          return undefined;
        }),
      });
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    });

    it('should reflect request headers when allowedHeaders not specified', async () => {
      const middleware = cors({ origin: '*' });
      const ctx = createMockContext({
        method: 'OPTIONS',
        get: vi.fn((name) => {
          const key = name.toLowerCase();
          if (key === 'origin') return 'https://example.com';
          if (key === 'access-control-request-method') return 'POST';
          if (key === 'access-control-request-headers') return 'Content-Type, X-Custom';
          return undefined;
        }),
      });
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, X-Custom');
    });

    it('should set max age', async () => {
      const middleware = cors({ origin: '*', maxAge: 3600 });
      const ctx = createMockContext({
        method: 'OPTIONS',
        get: vi.fn((name) => {
          if (name.toLowerCase() === 'origin') return 'https://example.com';
          if (name.toLowerCase() === 'access-control-request-method') return 'POST';
          return undefined;
        }),
      });
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Max-Age', '3600');
    });

    it('should use custom optionsSuccessStatus', async () => {
      const middleware = cors({ origin: '*', optionsSuccessStatus: 200 });
      const ctx = createMockContext({
        method: 'OPTIONS',
        get: vi.fn((name) => {
          if (name.toLowerCase() === 'origin') return 'https://example.com';
          if (name.toLowerCase() === 'access-control-request-method') return 'POST';
          return undefined;
        }),
      });
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.status).toBe(200);
    });

    it('should continue to next handler when preflightContinue is true', async () => {
      const middleware = cors({ origin: '*', preflightContinue: true });
      const ctx = createMockContext({
        method: 'OPTIONS',
        get: vi.fn((name) => {
          if (name.toLowerCase() === 'origin') return 'https://example.com';
          if (name.toLowerCase() === 'access-control-request-method') return 'POST';
          return undefined;
        }),
      });
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Vary Header Tests
  // ============================================================================

  describe('Vary header', () => {
    it('should always set Vary: Origin', async () => {
      const middleware = cors({ origin: '*' });
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).toHaveBeenCalledWith('Vary', 'Origin');
    });

    it('should append to existing Vary header', async () => {
      const middleware = cors({ origin: '*' });
      let varyValue = 'Accept-Encoding';
      const ctx = createMockContext({
        get: vi.fn((name) => {
          if (name.toLowerCase() === 'origin') return 'https://example.com';
          if (name === 'Vary') return varyValue;
          return undefined;
        }),
        set: vi.fn((name, value) => {
          if (name === 'Vary') varyValue = value;
        }),
      });
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).toHaveBeenCalledWith('Vary', 'Accept-Encoding, Origin');
    });
  });

  // ============================================================================
  // Security Tests
  // ============================================================================

  describe('security features', () => {
    describe('null origin protection', () => {
      it('should block null origin by default', async () => {
        const middleware = cors({ origin: true });
        const ctx = createMockContext({
          headers: { origin: 'null' },
          get: vi.fn((name) => (name.toLowerCase() === 'origin' ? 'null' : undefined)),
        });
        const next = vi.fn();

        await middleware(ctx as any, next);

        expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.anything());
      });

      it('should allow null origin when blockNullOrigin is false', async () => {
        const middleware = cors({ origin: true, blockNullOrigin: false });
        const ctx = createMockContext({
          headers: { origin: 'null' },
          get: vi.fn((name) => (name.toLowerCase() === 'origin' ? 'null' : undefined)),
        });
        const next = vi.fn();

        await middleware(ctx as any, next);

        expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'null');
      });
    });

    describe('malformed origin rejection', () => {
      it('should reject javascript: protocol origins', async () => {
        const middleware = cors({ origin: true });
        const ctx = createMockContext({
          headers: { origin: 'javascript:void(0)' },
          get: vi.fn((name) => (name.toLowerCase() === 'origin' ? 'javascript:void(0)' : undefined)),
        });
        const next = vi.fn();

        await middleware(ctx as any, next);

        expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.anything());
      });

      it('should reject data: protocol origins', async () => {
        const middleware = cors({ origin: true });
        const ctx = createMockContext({
          headers: { origin: 'data:text/html,<h1>test</h1>' },
          get: vi.fn((name) => (name.toLowerCase() === 'origin' ? 'data:text/html,<h1>test</h1>' : undefined)),
        });
        const next = vi.fn();

        await middleware(ctx as any, next);

        expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.anything());
      });

      it('should reject file: protocol origins', async () => {
        const middleware = cors({ origin: true });
        const ctx = createMockContext({
          headers: { origin: 'file:///etc/passwd' },
          get: vi.fn((name) => (name.toLowerCase() === 'origin' ? 'file:///etc/passwd' : undefined)),
        });
        const next = vi.fn();

        await middleware(ctx as any, next);

        expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.anything());
      });
    });

    describe('credentials + wildcard validation', () => {
      it('should throw error when credentials=true with wildcard origin', () => {
        expect(() => cors({ origin: '*', credentials: true })).toThrow();
      });

      it('should not throw for credentials=true with explicit origin', () => {
        expect(() => cors({ origin: 'https://example.com', credentials: true })).not.toThrow();
      });
    });

    describe('validator error handling', () => {
      it('should handle validator errors gracefully', async () => {
        const validator = vi.fn().mockRejectedValue(new Error('DB connection failed'));
        const middleware = cors({ origin: validator });
        const ctx = createMockContext();
        const next = vi.fn();

        await middleware(ctx as any, next);

        // Should not allow origin if validator throws
        expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.anything());
        expect(next).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Private Network Access Tests
  // ============================================================================

  describe('Private Network Access (PNA)', () => {
    it('should set PNA header when enabled and requested', async () => {
      const middleware = cors({ origin: '*', privateNetworkAccess: true });
      const ctx = createMockContext({
        method: 'OPTIONS',
        get: vi.fn((name) => {
          const key = name.toLowerCase();
          if (key === 'origin') return 'https://example.com';
          if (key === 'access-control-request-method') return 'POST';
          if (key === 'access-control-request-private-network') return 'true';
          return undefined;
        }),
      });
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Private-Network', 'true');
    });

    it('should not set PNA header when not requested', async () => {
      const middleware = cors({ origin: '*', privateNetworkAccess: true });
      const ctx = createMockContext({
        method: 'OPTIONS',
        get: vi.fn((name) => {
          if (name.toLowerCase() === 'origin') return 'https://example.com';
          if (name.toLowerCase() === 'access-control-request-method') return 'POST';
          return undefined;
        }),
      });
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Private-Network', expect.anything());
    });

    it('should not set PNA header when disabled', async () => {
      const middleware = cors({ origin: '*', privateNetworkAccess: false });
      const ctx = createMockContext({
        method: 'OPTIONS',
        get: vi.fn((name) => {
          const key = name.toLowerCase();
          if (key === 'origin') return 'https://example.com';
          if (key === 'access-control-request-method') return 'POST';
          if (key === 'access-control-request-private-network') return 'true';
          return undefined;
        }),
      });
      const next = vi.fn();

      await middleware(ctx as any, next);

      expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Private-Network', expect.anything());
    });
  });
});

// ============================================================================
// simpleCors Preset Tests
// ============================================================================

describe('simpleCors', () => {
  it('should allow all origins', async () => {
    const middleware = simpleCors();
    const ctx = createMockContext();
    const next = vi.fn();

    await middleware(ctx as any, next);

    expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
  });

  it('should not set credentials', async () => {
    const middleware = simpleCors();
    const ctx = createMockContext();
    const next = vi.fn();

    await middleware(ctx as any, next);

    expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Credentials', expect.anything());
  });
});

// ============================================================================
// strictCors Preset Tests
// ============================================================================

describe('strictCors', () => {
  it('should set credentials by default', async () => {
    const middleware = strictCors('https://example.com');
    const ctx = createMockContext();
    const next = vi.fn();

    await middleware(ctx as any, next);

    expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
  });

  it('should set default maxAge for preflight', async () => {
    const middleware = strictCors('https://example.com');
    const ctx = createMockContext({
      method: 'OPTIONS',
      get: vi.fn((name) => {
        if (name.toLowerCase() === 'origin') return 'https://example.com';
        if (name.toLowerCase() === 'access-control-request-method') return 'POST';
        return undefined;
      }),
    });
    const next = vi.fn();

    await middleware(ctx as any, next);

    expect(ctx.set).toHaveBeenCalledWith('Access-Control-Max-Age', '86400');
  });

  it('should allow custom maxAge option', async () => {
    const middleware = strictCors('https://example.com', { maxAge: 7200 });
    const ctx = createMockContext({
      method: 'OPTIONS',
      get: vi.fn((name) => {
        if (name.toLowerCase() === 'origin') return 'https://example.com';
        if (name.toLowerCase() === 'access-control-request-method') return 'POST';
        return undefined;
      }),
    });
    const next = vi.fn();

    await middleware(ctx as any, next);

    expect(ctx.set).toHaveBeenCalledWith('Access-Control-Max-Age', '7200');
  });

  it('should work with array of origins', async () => {
    const middleware = strictCors(['https://example.com', 'https://app.com']);
    const ctx = createMockContext();
    const next = vi.fn();

    await middleware(ctx as any, next);

    expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
  });

  it('should throw error when no origin provided', () => {
    expect(() => strictCors('')).toThrow(/requires an explicit origin/);
  });

  it('should throw error for wildcard origin', () => {
    expect(() => strictCors('*')).toThrow(/cannot use wildcard origin/);
  });

  it('should block null origins', async () => {
    const middleware = strictCors('https://example.com');
    const ctx = createMockContext({
      headers: { origin: 'null' },
      get: vi.fn((name) => (name.toLowerCase() === 'origin' ? 'null' : undefined)),
    });
    const next = vi.fn();

    await middleware(ctx as any, next);

    expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', 'null');
  });
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe('edge cases', () => {
  it('should handle missing next function by using ctx.next()', async () => {
    const middleware = cors({ origin: '*' });
    const ctx = createMockContext();

    await expect(middleware(ctx as any)).resolves.not.toThrow();
    expect(ctx.next).toHaveBeenCalled();
  });

  it('should handle empty origin header', async () => {
    const middleware = cors({ origin: '*' });
    const ctx = createMockContext({
      headers: { origin: '' },
      get: vi.fn((name) => (name.toLowerCase() === 'origin' ? '' : undefined)),
    });
    const next = vi.fn();

    await middleware(ctx as any, next);

    // Empty string is falsy, should skip CORS
    expect(next).toHaveBeenCalled();
  });

  it('should handle undefined options gracefully', async () => {
    const middleware = cors({
      origin: '*',
      allowedHeaders: undefined,
      exposedHeaders: undefined,
      maxAge: undefined,
    });
    const ctx = createMockContext({
      method: 'OPTIONS',
      get: vi.fn((name) => {
        if (name.toLowerCase() === 'origin') return 'https://example.com';
        if (name.toLowerCase() === 'access-control-request-method') return 'POST';
        return undefined;
      }),
    });
    const next = vi.fn();

    await expect(middleware(ctx as any, next)).resolves.not.toThrow();
  });

  it('should work with complex async origin validator', async () => {
    const middleware = cors({
      origin: async (origin) => {
        // Simulate async database lookup
        await new Promise((resolve) => setTimeout(resolve, 1));
        return origin.endsWith('.example.com');
      },
    });
    const ctx = createMockContext({
      headers: { origin: 'https://app.example.com' },
      get: vi.fn((name) => (name.toLowerCase() === 'origin' ? 'https://app.example.com' : undefined)),
    });
    const next = vi.fn();

    await middleware(ctx as any, next);

    expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://app.example.com');
  });

  it('should handle OPTIONS without preflight indicators as regular request', async () => {
    const middleware = cors({ origin: '*' });
    const ctx = createMockContext({
      method: 'OPTIONS',
      get: vi.fn((name) => {
        if (name.toLowerCase() === 'origin') return 'https://example.com';
        // No Access-Control-Request-Method header = not a preflight
        return undefined;
      }),
    });
    const next = vi.fn();

    await middleware(ctx as any, next);

    // Should set CORS headers but not end response (not a preflight)
    expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    expect(next).toHaveBeenCalled();
    expect(ctx.status).not.toBe(204);
  });
});
