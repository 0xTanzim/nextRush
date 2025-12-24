/**
 * @nextrush/cors - CORS Middleware Tests
 */

import { describe, expect, it, vi } from 'vitest';
import { cors, simpleCors, strictCors, type CorsContext } from '../index';

function createMockContext(overrides: Partial<CorsContext> = {}): CorsContext {
  const headers: Record<string, string> = {};
  return {
    method: 'GET',
    path: '/test',
    status: 200,
    get: vi.fn((name: string) => {
      if (name === 'origin') return 'https://example.com';
      if (name === 'vary') return headers['vary'];
      if (name === 'access-control-request-headers') return undefined;
      return undefined;
    }),
    set: vi.fn((name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    }),
    send: vi.fn(),
    ...overrides,
  };
}

describe('cors middleware', () => {
  describe('basic functionality', () => {
    it('should set CORS headers with default options', async () => {
      const middleware = cors();
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    });

    it('should call next middleware', async () => {
      const middleware = cors();
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx, next);

      expect(next).toHaveBeenCalled();
    });

    it('should skip CORS for same-origin requests (no Origin header)', async () => {
      const middleware = cors();
      const ctx = createMockContext({
        get: vi.fn(() => undefined),
      });
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.set).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('origin option', () => {
    it('should allow wildcard origin', async () => {
      const middleware = cors({ origin: '*' });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    });

    it('should reflect origin when true', async () => {
      const middleware = cors({ origin: true });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
      expect(ctx.set).toHaveBeenCalledWith('Vary', 'Origin');
    });

    it('should not set CORS headers when origin is false', async () => {
      const middleware = cors({ origin: false });
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.anything());
      expect(next).toHaveBeenCalled();
    });

    it('should allow specific origin string', async () => {
      const middleware = cors({ origin: 'https://example.com' });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
    });

    it('should reject non-matching origin string', async () => {
      const middleware = cors({ origin: 'https://other.com' });
      const ctx = createMockContext();
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.anything());
      expect(next).toHaveBeenCalled();
    });

    it('should allow origin from array', async () => {
      const middleware = cors({ origin: ['https://example.com', 'https://app.com'] });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
    });

    it('should reject origin not in array', async () => {
      const middleware = cors({ origin: ['https://other.com', 'https://app.com'] });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.anything());
    });

    it('should allow origin matching regex', async () => {
      const middleware = cors({ origin: /\.example\.com$/ });
      const ctx = createMockContext({
        get: vi.fn((name) => name === 'origin' ? 'https://app.example.com' : undefined),
      });

      await middleware(ctx);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://app.example.com');
    });

    it('should reject origin not matching regex', async () => {
      const middleware = cors({ origin: /\.example\.com$/ });
      const ctx = createMockContext({
        get: vi.fn((name) => name === 'origin' ? 'https://other.com' : undefined),
      });

      await middleware(ctx);

      expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.anything());
    });

    it('should allow origin using function returning true', async () => {
      const validator = vi.fn().mockReturnValue(true);
      const middleware = cors({ origin: validator });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(validator).toHaveBeenCalledWith('https://example.com', ctx);
      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
    });

    it('should reject origin using function returning false', async () => {
      const validator = vi.fn().mockReturnValue(false);
      const middleware = cors({ origin: validator });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', expect.anything());
    });

    it('should allow custom origin from function returning string', async () => {
      const validator = vi.fn().mockReturnValue('https://custom.com');
      const middleware = cors({ origin: validator });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://custom.com');
    });

    it('should support async origin validator', async () => {
      const validator = vi.fn().mockResolvedValue(true);
      const middleware = cors({ origin: validator });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
    });
  });

  describe('credentials option', () => {
    it('should not set credentials header by default', async () => {
      const middleware = cors();
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Credentials', expect.anything());
    });

    it('should set credentials header when enabled', async () => {
      const middleware = cors({ credentials: true });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
    });
  });

  describe('exposedHeaders option', () => {
    it('should set exposed headers as string', async () => {
      const middleware = cors({ exposedHeaders: 'X-Custom-Header' });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Expose-Headers', 'X-Custom-Header');
    });

    it('should set exposed headers as array', async () => {
      const middleware = cors({ exposedHeaders: ['X-Custom-Header', 'X-Another-Header'] });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Expose-Headers', 'X-Custom-Header, X-Another-Header');
    });
  });

  describe('preflight requests (OPTIONS)', () => {
    it('should handle preflight request', async () => {
      const middleware = cors();
      const ctx = createMockContext({ method: 'OPTIONS' });

      await middleware(ctx);

      expect(ctx.status).toBe(204);
      expect(ctx.send).toHaveBeenCalledWith('');
      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, HEAD, PUT, PATCH, POST, DELETE');
    });

    it('should set custom methods', async () => {
      const middleware = cors({ methods: ['GET', 'POST'] });
      const ctx = createMockContext({ method: 'OPTIONS' });

      await middleware(ctx);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST');
    });

    it('should set methods from string', async () => {
      const middleware = cors({ methods: 'GET, POST' });
      const ctx = createMockContext({ method: 'OPTIONS' });

      await middleware(ctx);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST');
    });

    it('should set allowed headers', async () => {
      const middleware = cors({ allowedHeaders: ['Content-Type', 'Authorization'] });
      const ctx = createMockContext({ method: 'OPTIONS' });

      await middleware(ctx);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    });

    it('should reflect request headers when allowedHeaders not specified', async () => {
      const middleware = cors();
      const ctx = createMockContext({
        method: 'OPTIONS',
        get: vi.fn((name) => {
          if (name === 'origin') return 'https://example.com';
          if (name === 'access-control-request-headers') return 'Content-Type, X-Custom';
          return undefined;
        }),
      });

      await middleware(ctx);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, X-Custom');
    });

    it('should set max age', async () => {
      const middleware = cors({ maxAge: 3600 });
      const ctx = createMockContext({ method: 'OPTIONS' });

      await middleware(ctx);

      expect(ctx.set).toHaveBeenCalledWith('Access-Control-Max-Age', '3600');
    });

    it('should use custom optionsSuccessStatus', async () => {
      const middleware = cors({ optionsSuccessStatus: 200 });
      const ctx = createMockContext({ method: 'OPTIONS' });

      await middleware(ctx);

      expect(ctx.status).toBe(200);
    });

    it('should continue to next handler when preflightContinue is true', async () => {
      const middleware = cors({ preflightContinue: true });
      const ctx = createMockContext({ method: 'OPTIONS' });
      const next = vi.fn();

      await middleware(ctx, next);

      expect(ctx.send).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Vary header', () => {
    it('should set Vary header for non-wildcard origin', async () => {
      const middleware = cors({ origin: true });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.set).toHaveBeenCalledWith('Vary', 'Origin');
    });

    it('should not set Vary header for wildcard origin', async () => {
      const middleware = cors({ origin: '*' });
      const ctx = createMockContext();

      await middleware(ctx);

      expect(ctx.set).not.toHaveBeenCalledWith('Vary', 'Origin');
    });
  });
});

describe('simpleCors', () => {
  it('should allow all origins', async () => {
    const middleware = simpleCors();
    const ctx = createMockContext();

    await middleware(ctx);

    expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
  });
});

describe('strictCors', () => {
  it('should set credentials and maxAge by default', async () => {
    const middleware = strictCors({ origin: 'https://example.com' });
    const ctx = createMockContext({ method: 'OPTIONS' });

    await middleware(ctx);

    expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
    expect(ctx.set).toHaveBeenCalledWith('Access-Control-Max-Age', '86400');
  });

  it('should allow custom credentials option', async () => {
    const middleware = strictCors({ origin: 'https://example.com', credentials: false });
    const ctx = createMockContext();

    await middleware(ctx);

    expect(ctx.set).not.toHaveBeenCalledWith('Access-Control-Allow-Credentials', expect.anything());
  });

  it('should allow custom maxAge option', async () => {
    const middleware = strictCors({ origin: 'https://example.com', maxAge: 7200 });
    const ctx = createMockContext({ method: 'OPTIONS' });

    await middleware(ctx);

    expect(ctx.set).toHaveBeenCalledWith('Access-Control-Max-Age', '7200');
  });

  it('should work with array of origins', async () => {
    const middleware = strictCors({ origin: ['https://example.com', 'https://app.com'] });
    const ctx = createMockContext();

    await middleware(ctx);

    expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
  });
});

describe('edge cases', () => {
  it('should handle missing next function', async () => {
    const middleware = cors();
    const ctx = createMockContext();

    await expect(middleware(ctx)).resolves.not.toThrow();
  });

  it('should handle empty origin header', async () => {
    const middleware = cors();
    const ctx = createMockContext({
      get: vi.fn((name) => name === 'origin' ? '' : undefined),
    });
    const next = vi.fn();

    await middleware(ctx, next);

    // Empty string is falsy, should skip CORS
    expect(next).toHaveBeenCalled();
  });

  it('should handle null values gracefully', async () => {
    const middleware = cors({
      allowedHeaders: undefined,
      exposedHeaders: undefined,
      maxAge: undefined,
    });
    const ctx = createMockContext({ method: 'OPTIONS' });

    await expect(middleware(ctx)).resolves.not.toThrow();
  });

  it('should work with complex async origin validator', async () => {
    const middleware = cors({
      origin: async (origin) => {
        // Simulate async database lookup
        await new Promise(resolve => setTimeout(resolve, 1));
        return origin.endsWith('.example.com');
      },
    });
    const ctx = createMockContext({
      get: vi.fn((name) => name === 'origin' ? 'https://app.example.com' : undefined),
    });

    await middleware(ctx);

    expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://app.example.com');
  });
});
