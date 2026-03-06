import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CSRF_FIELD, CSRF_HEADER, DEFAULT_COOKIE_NAME, ERRORS, XSRF_HEADER } from '../constants.js';
import { csrf } from '../middleware.js';
import { clearKeyCache, constantTimeEqual, generateToken, validateToken } from '../token.js';

// ============================================================================
// Mock Context
// ============================================================================

interface MockContext {
  method: string;
  path: string;
  url: string;
  status: number;
  body: unknown;
  query: Record<string, string>;
  state: Record<string, unknown>;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  get: (name: string) => string | undefined;
  set: (name: string, value: string) => void;
  json: ReturnType<typeof vi.fn>;
}

function createMockContext(
  overrides: Partial<{
    method: string;
    path: string;
    body: unknown;
    query: Record<string, string>;
    headers: Record<string, string>;
    state: Record<string, unknown>;
  }> = {}
): MockContext {
  const requestHeaders: Record<string, string> = { ...overrides.headers };
  const responseHeaders: Record<string, string> = {};

  return {
    method: overrides.method ?? 'GET',
    path: overrides.path ?? '/',
    url: overrides.path ?? '/',
    status: 200,
    body: overrides.body,
    query: overrides.query ?? {},
    state: overrides.state ?? {},
    requestHeaders,
    responseHeaders,
    get: (name: string) => requestHeaders[name.toLowerCase()],
    set: (name: string, value: string) => {
      responseHeaders[name] = value;
    },
    json: vi.fn(function (this: MockContext, data: unknown) {
      this.body = data;
    }),
  };
}

// ============================================================================
// Test Constants
// ============================================================================

const TEST_SECRET = 'a-very-secure-secret-that-is-at-least-32-characters-long';
const TEST_SESSION_ID = 'session-abc-123';

function defaultOptions() {
  return { secret: TEST_SECRET };
}

function sessionOptions() {
  return {
    secret: TEST_SECRET,
    getSessionIdentifier: (ctx: MockContext) =>
      (ctx.state as Record<string, string>).sessionId ?? TEST_SESSION_ID,
  };
}

// ============================================================================
// Token Engine Tests
// ============================================================================

describe('Token Engine', () => {
  beforeEach(() => {
    clearKeyCache();
  });

  describe('generateToken', () => {
    it('should generate a token in the format hmac.random', async () => {
      const token = await generateToken(TEST_SECRET);
      expect(token).toContain('.');
      const parts = token.split('.');
      expect(parts).toHaveLength(2);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThan(0);
    });

    it('should generate hex-encoded values', async () => {
      const token = await generateToken(TEST_SECRET);
      const [hmac, random] = token.split('.');
      expect(hmac).toMatch(/^[0-9a-f]+$/);
      expect(random).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate unique tokens on each call', async () => {
      const tokens = await Promise.all(
        Array.from({ length: 10 }, () => generateToken(TEST_SECRET))
      );
      const unique = new Set(tokens);
      expect(unique.size).toBe(10);
    });

    it('should generate tokens with specified size', async () => {
      const token16 = await generateToken(TEST_SECRET, undefined, 16);
      const token64 = await generateToken(TEST_SECRET, undefined, 64);
      const [, random16] = token16.split('.');
      const [, random64] = token64.split('.');
      // Each byte = 2 hex chars
      expect(random16.length).toBe(32);
      expect(random64.length).toBe(128);
    });

    it('should generate tokens with session binding', async () => {
      const token = await generateToken(TEST_SECRET, TEST_SESSION_ID);
      expect(token).toContain('.');
      const isValid = await validateToken(token, TEST_SECRET, TEST_SESSION_ID);
      expect(isValid).toBe(true);
    });
  });

  describe('validateToken', () => {
    it('should validate a correctly generated token', async () => {
      const token = await generateToken(TEST_SECRET);
      const isValid = await validateToken(token, TEST_SECRET);
      expect(isValid).toBe(true);
    });

    it('should validate a session-bound token', async () => {
      const token = await generateToken(TEST_SECRET, TEST_SESSION_ID);
      const isValid = await validateToken(token, TEST_SECRET, TEST_SESSION_ID);
      expect(isValid).toBe(true);
    });

    it('should reject a token with wrong secret', async () => {
      const token = await generateToken(TEST_SECRET);
      const isValid = await validateToken(token, 'different-secret-that-is-also-32-characters-lo');
      expect(isValid).toBe(false);
    });

    it('should reject a token with wrong session ID', async () => {
      const token = await generateToken(TEST_SECRET, 'session-1');
      const isValid = await validateToken(token, TEST_SECRET, 'session-2');
      expect(isValid).toBe(false);
    });

    it('should reject a token generated without session when validated with session', async () => {
      const token = await generateToken(TEST_SECRET);
      const isValid = await validateToken(token, TEST_SECRET, TEST_SESSION_ID);
      expect(isValid).toBe(false);
    });

    it('should reject a token generated with session when validated without session', async () => {
      const token = await generateToken(TEST_SECRET, TEST_SESSION_ID);
      const isValid = await validateToken(token, TEST_SECRET);
      expect(isValid).toBe(false);
    });

    it('should reject a tampered HMAC', async () => {
      const token = await generateToken(TEST_SECRET);
      const [hmac, random] = token.split('.');
      // Flip a character in the HMAC
      const tampered = (hmac[0] === 'a' ? 'b' : 'a') + hmac.slice(1);
      const isValid = await validateToken(`${tampered}.${random}`, TEST_SECRET);
      expect(isValid).toBe(false);
    });

    it('should reject a tampered random value', async () => {
      const token = await generateToken(TEST_SECRET);
      const [hmac, random] = token.split('.');
      const tampered = (random[0] === 'a' ? 'b' : 'a') + random.slice(1);
      const isValid = await validateToken(`${hmac}.${tampered}`, TEST_SECRET);
      expect(isValid).toBe(false);
    });

    it('should reject empty string', async () => {
      const isValid = await validateToken('', TEST_SECRET);
      expect(isValid).toBe(false);
    });

    it('should reject token without separator', async () => {
      const isValid = await validateToken('abcdef1234567890', TEST_SECRET);
      expect(isValid).toBe(false);
    });

    it('should reject non-hex token parts', async () => {
      const isValid = await validateToken('not-hex.also-not-hex', TEST_SECRET);
      expect(isValid).toBe(false);
    });

    it('should reject token with empty HMAC part', async () => {
      const isValid = await validateToken('.abcdef', TEST_SECRET);
      expect(isValid).toBe(false);
    });

    it('should reject token with empty random part', async () => {
      const isValid = await validateToken('abcdef.', TEST_SECRET);
      expect(isValid).toBe(false);
    });

    it('should reject null/undefined', async () => {
      expect(await validateToken(null as unknown as string, TEST_SECRET)).toBe(false);
      expect(await validateToken(undefined as unknown as string, TEST_SECRET)).toBe(false);
    });

    it('should reject non-string input', async () => {
      expect(await validateToken(123 as unknown as string, TEST_SECRET)).toBe(false);
      expect(await validateToken({} as unknown as string, TEST_SECRET)).toBe(false);
    });
  });

  describe('constantTimeEqual', () => {
    it('should return true for identical strings', async () => {
      expect(await constantTimeEqual('hello', 'hello')).toBe(true);
    });

    it('should return false for different strings', async () => {
      expect(await constantTimeEqual('hello', 'world')).toBe(false);
    });

    it('should return false for strings of different lengths', async () => {
      expect(await constantTimeEqual('short', 'longer-string')).toBe(false);
    });

    it('should return true for empty strings', async () => {
      expect(await constantTimeEqual('', '')).toBe(true);
    });

    it('should return false for strings differing by one character', async () => {
      expect(await constantTimeEqual('abcdef', 'abcdeg')).toBe(false);
    });

    it('should handle non-string inputs gracefully', async () => {
      expect(await constantTimeEqual(null as unknown as string, 'test')).toBe(false);
      expect(await constantTimeEqual('test', undefined as unknown as string)).toBe(false);
      expect(await constantTimeEqual(123 as unknown as string, 456 as unknown as string)).toBe(
        false
      );
    });
  });
});

// ============================================================================
// Middleware Tests
// ============================================================================

describe('CSRF Middleware', () => {
  let next: ReturnType<typeof vi.fn<() => Promise<void>>>;

  beforeEach(() => {
    clearKeyCache();
    next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  });

  // --------------------------------------------------------------------------
  // Options Validation
  // --------------------------------------------------------------------------

  describe('options validation', () => {
    it('should throw on missing secret', () => {
      expect(() => csrf({ secret: '' })).toThrow(ERRORS.MISSING_SECRET);
    });

    it('should throw on short secret', () => {
      expect(() => csrf({ secret: 'too-short' })).toThrow(ERRORS.SECRET_TOO_SHORT);
    });

    it('should accept a secret of exactly 32 characters', () => {
      expect(() => csrf({ secret: '12345678901234567890123456789012' })).not.toThrow();
    });

    it('should accept a function secret', () => {
      expect(() =>
        csrf({ secret: () => 'a-dynamic-secret-that-is-at-least-32-chars-long' })
      ).not.toThrow();
    });

    it('should throw if function secret returns short string', () => {
      expect(() => csrf({ secret: () => 'short' })).toThrow(ERRORS.SECRET_TOO_SHORT);
    });

    it('should throw if __Host- prefix used without secure', () => {
      expect(() =>
        csrf({
          secret: TEST_SECRET,
          cookie: { name: '__Host-csrf', secure: false },
        })
      ).toThrow('__Host- prefix require secure: true');
    });

    it('should throw if __Host- prefix used with domain', () => {
      expect(() =>
        csrf({
          secret: TEST_SECRET,
          cookie: { name: '__Host-csrf', domain: 'example.com' },
        })
      ).toThrow('__Host- prefix cannot have a Domain');
    });

    it('should throw if __Host- prefix used with non-root path', () => {
      expect(() =>
        csrf({
          secret: TEST_SECRET,
          cookie: { name: '__Host-csrf', path: '/api' },
        })
      ).toThrow('__Host- prefix must have path: "/"');
    });

    it('should allow custom cookie name without __Host- prefix constraints', () => {
      expect(() =>
        csrf({
          secret: TEST_SECRET,
          cookie: { name: 'csrf-token', secure: false, path: '/api', domain: 'example.com' },
        })
      ).not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // Safe Methods (pass-through)
  // --------------------------------------------------------------------------

  describe('safe methods', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS', 'TRACE']) {
      it(`should pass through ${method} requests without validation`, async () => {
        const { protect } = csrf(defaultOptions());
        const ctx = createMockContext({ method });
        await protect(ctx as never, next);
        expect(next).toHaveBeenCalledOnce();
      });

      it(`should attach csrf context on ${method} requests`, async () => {
        const { protect } = csrf(defaultOptions());
        const ctx = createMockContext({ method });
        await protect(ctx as never, next);
        expect(ctx.state.csrf).toBeDefined();
        expect(
          (ctx.state.csrf as { generateToken: () => Promise<string> }).generateToken
        ).toBeTypeOf('function');
      });
    }

    it('should handle lowercase method names', async () => {
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({ method: 'get' });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });
  });

  // --------------------------------------------------------------------------
  // Unsafe Methods (require validation)
  // --------------------------------------------------------------------------

  describe('unsafe methods', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      it(`should reject ${method} without cookie`, async () => {
        const { protect } = csrf(defaultOptions());
        const ctx = createMockContext({ method });
        await protect(ctx as never, next);
        expect(next).not.toHaveBeenCalled();
        expect(ctx.status).toBe(403);
        expect(ctx.json).toHaveBeenCalled();
      });

      it(`should reject ${method} with cookie but no submitted token`, async () => {
        // Generate a valid token first
        const token = await generateToken(TEST_SECRET);
        const { protect } = csrf(defaultOptions());
        const ctx = createMockContext({
          method,
          headers: { cookie: `${DEFAULT_COOKIE_NAME}=${token}` },
        });
        await protect(ctx as never, next);
        expect(next).not.toHaveBeenCalled();
        expect(ctx.status).toBe(403);
      });

      it(`should accept ${method} with valid cookie and header token`, async () => {
        const token = await generateToken(TEST_SECRET);
        const { protect } = csrf(defaultOptions());
        const ctx = createMockContext({
          method,
          headers: {
            cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
            [CSRF_HEADER]: token,
          },
        });
        await protect(ctx as never, next);
        expect(next).toHaveBeenCalledOnce();
      });
    }
  });

  // --------------------------------------------------------------------------
  // Token Extraction
  // --------------------------------------------------------------------------

  describe('token extraction', () => {
    it('should extract token from x-csrf-token header', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
        },
      });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should extract token from x-xsrf-token header (Angular)', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [XSRF_HEADER]: token,
        },
      });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should extract token from body._csrf field', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({
        method: 'POST',
        headers: { cookie: `${DEFAULT_COOKIE_NAME}=${token}` },
        body: { [CSRF_FIELD]: token },
      });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should extract token from query._csrf field', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({
        method: 'POST',
        headers: { cookie: `${DEFAULT_COOKIE_NAME}=${token}` },
        query: { [CSRF_FIELD]: token },
      });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should prefer header over body over query', async () => {
      const token = await generateToken(TEST_SECRET);
      const wrongToken = 'wrong.token';
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
        },
        body: { [CSRF_FIELD]: wrongToken },
        query: { [CSRF_FIELD]: wrongToken },
      });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should use custom token extractor', async () => {
      const token = await generateToken(TEST_SECRET);
      const customExtractor = vi.fn((ctx: MockContext) => ctx.requestHeaders['x-custom-csrf']);
      const { protect } = csrf({
        ...defaultOptions(),
        getTokenFromRequest: customExtractor as never,
      });
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          'x-custom-csrf': token,
        },
      });
      await protect(ctx as never, next);
      expect(customExtractor).toHaveBeenCalled();
      expect(next).toHaveBeenCalledOnce();
    });

    it('should ignore non-string body._csrf values', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({
        method: 'POST',
        headers: { cookie: `${DEFAULT_COOKIE_NAME}=${token}` },
        body: { [CSRF_FIELD]: 12345 },
      });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
      expect(ctx.status).toBe(403);
    });
  });

  // --------------------------------------------------------------------------
  // Token Validation
  // --------------------------------------------------------------------------

  describe('token validation', () => {
    it('should reject mismatched cookie and header tokens', async () => {
      const token1 = await generateToken(TEST_SECRET);
      const token2 = await generateToken(TEST_SECRET);
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token1}`,
          [CSRF_HEADER]: token2,
        },
      });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
      expect(ctx.status).toBe(403);
    });

    it('should reject a tampered token (same cookie and header, but HMAC invalid)', async () => {
      const token = await generateToken(TEST_SECRET);
      const [hmac, random] = token.split('.');
      const tamperedHmac = (hmac[0] === 'a' ? 'b' : 'a') + hmac.slice(1);
      const tampered = `${tamperedHmac}.${random}`;

      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${tampered}`,
          [CSRF_HEADER]: tampered,
        },
      });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
      expect(ctx.status).toBe(403);
    });

    it('should reject a token signed with a different secret', async () => {
      const otherSecret = 'another-secret-that-is-also-at-least-32-characters-long';
      const token = await generateToken(otherSecret);
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
        },
      });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
      expect(ctx.status).toBe(403);
    });
  });

  // --------------------------------------------------------------------------
  // Session Binding
  // --------------------------------------------------------------------------

  describe('session binding', () => {
    it('should validate token bound to correct session', async () => {
      const token = await generateToken(TEST_SECRET, TEST_SESSION_ID);
      const { protect } = csrf(sessionOptions() as never);
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
        },
        state: { sessionId: TEST_SESSION_ID },
      });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should reject token bound to different session', async () => {
      const token = await generateToken(TEST_SECRET, 'session-1');
      const { protect } = csrf(sessionOptions() as never);
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
        },
        state: { sessionId: 'session-2' },
      });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
      expect(ctx.status).toBe(403);
    });

    it('should reject unbound token when session is expected', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf(sessionOptions() as never);
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
        },
        state: { sessionId: TEST_SESSION_ID },
      });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
      expect(ctx.status).toBe(403);
    });
  });

  // --------------------------------------------------------------------------
  // Path Exclusion
  // --------------------------------------------------------------------------

  describe('path exclusion', () => {
    it('should skip validation for exact excluded path', async () => {
      const { protect } = csrf({
        ...defaultOptions(),
        excludePaths: ['/api/webhooks/stripe'],
      });
      const ctx = createMockContext({ method: 'POST', path: '/api/webhooks/stripe' });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should not skip for non-matching path', async () => {
      const { protect } = csrf({
        ...defaultOptions(),
        excludePaths: ['/api/webhooks/stripe'],
      });
      const ctx = createMockContext({ method: 'POST', path: '/api/users' });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('should support single wildcard pattern', async () => {
      const { protect } = csrf({
        ...defaultOptions(),
        excludePaths: ['/api/webhooks/*'],
      });

      const ctx1 = createMockContext({ method: 'POST', path: '/api/webhooks/stripe' });
      await protect(ctx1 as never, next);
      expect(next).toHaveBeenCalledOnce();

      next.mockClear();

      const ctx2 = createMockContext({ method: 'POST', path: '/api/webhooks/github' });
      await protect(ctx2 as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should support double wildcard pattern', async () => {
      const { protect } = csrf({
        ...defaultOptions(),
        excludePaths: ['/api/webhooks/**'],
      });

      const ctx = createMockContext({ method: 'POST', path: '/api/webhooks/stripe/events' });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should not match wildcard across different paths', async () => {
      const { protect } = csrf({
        ...defaultOptions(),
        excludePaths: ['/api/webhooks/*'],
      });
      const ctx = createMockContext({ method: 'POST', path: '/api/users/123' });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Token Generation (via ctx.state.csrf)
  // --------------------------------------------------------------------------

  describe('token generation', () => {
    it('should provide generateToken on ctx.state.csrf', async () => {
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({ method: 'GET' });
      await protect(ctx as never, next);

      const csrfCtx = ctx.state.csrf as { generateToken: () => Promise<string> };
      const token = await csrfCtx.generateToken();
      expect(token).toContain('.');
      expect(token).toMatch(/^[0-9a-f]+\.[0-9a-f]+$/);
    });

    it('should set cookie when token is generated', async () => {
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({ method: 'GET' });
      await protect(ctx as never, next);

      await (ctx.state.csrf as { generateToken: () => Promise<string> }).generateToken();
      expect(ctx.responseHeaders['Set-Cookie']).toBeDefined();
      expect(ctx.responseHeaders['Set-Cookie']).toContain(DEFAULT_COOKIE_NAME);
    });

    it('should include Secure flag in cookie', async () => {
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({ method: 'GET' });
      await protect(ctx as never, next);

      await (ctx.state.csrf as { generateToken: () => Promise<string> }).generateToken();
      expect(ctx.responseHeaders['Set-Cookie']).toContain('Secure');
    });

    it('should NOT include HttpOnly flag in cookie', async () => {
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({ method: 'GET' });
      await protect(ctx as never, next);

      await (ctx.state.csrf as { generateToken: () => Promise<string> }).generateToken();
      expect(ctx.responseHeaders['Set-Cookie']).not.toContain('HttpOnly');
    });

    it('should include SameSite=Strict in cookie', async () => {
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({ method: 'GET' });
      await protect(ctx as never, next);

      await (ctx.state.csrf as { generateToken: () => Promise<string> }).generateToken();
      expect(ctx.responseHeaders['Set-Cookie']).toContain('SameSite=Strict');
    });

    it('should set cookie only once per request', async () => {
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({ method: 'GET' });
      const setCalls: string[] = [];
      ctx.set = (name: string, value: string) => {
        setCalls.push(name);
        ctx.responseHeaders[name] = value;
      };

      await protect(ctx as never, next);

      const csrfCtx = ctx.state.csrf as { generateToken: () => Promise<string> };
      await csrfCtx.generateToken();
      await csrfCtx.generateToken();

      const setCookieCalls = setCalls.filter((n) => n === 'Set-Cookie');
      expect(setCookieCalls).toHaveLength(1);
    });

    it('should report existing cookie token via cookieToken', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({
        method: 'GET',
        headers: { cookie: `${DEFAULT_COOKIE_NAME}=${token}` },
      });
      await protect(ctx as never, next);

      const csrfCtx = ctx.state.csrf as { cookieToken: string | undefined };
      expect(csrfCtx.cookieToken).toBe(token);
    });

    it('should return undefined cookieToken when no cookie exists', async () => {
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({ method: 'GET' });
      await protect(ctx as never, next);

      const csrfCtx = ctx.state.csrf as { cookieToken: string | undefined };
      expect(csrfCtx.cookieToken).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Token Provider Middleware
  // --------------------------------------------------------------------------

  describe('tokenProvider middleware', () => {
    it('should attach csrf context without enforcing protection', async () => {
      const { tokenProvider } = csrf(defaultOptions());
      const ctx = createMockContext({ method: 'POST' });
      await tokenProvider(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
      expect(ctx.state.csrf).toBeDefined();
    });

    it('should allow generating tokens from tokenProvider', async () => {
      const { tokenProvider } = csrf(defaultOptions());
      const ctx = createMockContext({ method: 'GET' });
      await tokenProvider(ctx as never, next);

      const csrfCtx = ctx.state.csrf as { generateToken: () => Promise<string> };
      const token = await csrfCtx.generateToken();
      expect(token).toMatch(/^[0-9a-f]+\.[0-9a-f]+$/);
    });
  });

  // --------------------------------------------------------------------------
  // Custom Ignored Methods
  // --------------------------------------------------------------------------

  describe('custom ignored methods', () => {
    it('should allow customizing ignored methods', async () => {
      const { protect } = csrf({
        ...defaultOptions(),
        ignoredMethods: ['GET'],
      });

      // HEAD is no longer ignored
      const ctx = createMockContext({ method: 'HEAD' });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive method comparison', async () => {
      const { protect } = csrf({
        ...defaultOptions(),
        ignoredMethods: ['get', 'post'],
      });

      const ctx = createMockContext({ method: 'POST' });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });
  });

  // --------------------------------------------------------------------------
  // Custom Error Handler
  // --------------------------------------------------------------------------

  describe('custom error handler', () => {
    it('should call custom error handler on failure', async () => {
      const onError = vi.fn();
      const { protect } = csrf({
        ...defaultOptions(),
        onError,
      });
      const ctx = createMockContext({ method: 'POST' });
      await protect(ctx as never, next);

      expect(onError).toHaveBeenCalledWith(ctx, ERRORS.MISSING_COOKIE);
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass correct reason for missing token', async () => {
      const onError = vi.fn();
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf({
        ...defaultOptions(),
        onError,
      });
      const ctx = createMockContext({
        method: 'POST',
        headers: { cookie: `${DEFAULT_COOKIE_NAME}=${token}` },
      });
      await protect(ctx as never, next);
      expect(onError).toHaveBeenCalledWith(ctx, ERRORS.MISSING_TOKEN);
    });

    it('should pass correct reason for token mismatch', async () => {
      const onError = vi.fn();
      const token1 = await generateToken(TEST_SECRET);
      const token2 = await generateToken(TEST_SECRET);
      const { protect } = csrf({
        ...defaultOptions(),
        onError,
      });
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token1}`,
          [CSRF_HEADER]: token2,
        },
      });
      await protect(ctx as never, next);
      expect(onError).toHaveBeenCalledWith(ctx, ERRORS.TOKEN_MISMATCH);
    });
  });

  // --------------------------------------------------------------------------
  // Origin Check
  // --------------------------------------------------------------------------

  describe('origin check', () => {
    it('should reject cross-site requests via Sec-Fetch-Site', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf({
        ...defaultOptions(),
        originCheck: true,
      });
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
          'sec-fetch-site': 'cross-site',
        },
      });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
      expect(ctx.status).toBe(403);
    });

    it('should allow same-origin requests via Sec-Fetch-Site', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf({
        ...defaultOptions(),
        originCheck: true,
      });
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
          'sec-fetch-site': 'same-origin',
        },
      });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should allow same-site requests via Sec-Fetch-Site', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf({
        ...defaultOptions(),
        originCheck: true,
      });
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
          'sec-fetch-site': 'same-site',
        },
      });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should allow direct navigation (Sec-Fetch-Site: none)', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf({
        ...defaultOptions(),
        originCheck: true,
      });
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
          'sec-fetch-site': 'none',
        },
      });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should check Origin header against Host', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf({
        ...defaultOptions(),
        originCheck: true,
      });
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
          origin: 'https://evil.com',
          host: 'example.com',
        },
      });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
      expect(ctx.status).toBe(403);
    });

    it('should accept matching Origin and Host', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf({
        ...defaultOptions(),
        originCheck: true,
      });
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
          origin: 'https://example.com',
          host: 'example.com',
        },
      });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should allow requests from allowedOrigins', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf({
        ...defaultOptions(),
        originCheck: true,
        allowedOrigins: ['https://trusted.com'],
      });
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
          origin: 'https://trusted.com',
          host: 'api.example.com',
        },
      });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should not perform origin check when disabled', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf({
        ...defaultOptions(),
        originCheck: false,
      });
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
          'sec-fetch-site': 'cross-site',
        },
      });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });
  });

  // --------------------------------------------------------------------------
  // Cookie Parsing
  // --------------------------------------------------------------------------

  describe('cookie parsing', () => {
    it('should extract token from cookie with multiple cookies', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `session=abc; ${DEFAULT_COOKIE_NAME}=${token}; other=value`,
          [CSRF_HEADER]: token,
        },
      });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should handle cookie with leading whitespace', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `  ${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
        },
      });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should use custom cookie name', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf({
        ...defaultOptions(),
        cookie: { name: 'my-csrf', secure: false },
      });
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `my-csrf=${token}`,
          [CSRF_HEADER]: token,
        },
      });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });
  });

  // --------------------------------------------------------------------------
  // Cookie Attributes
  // --------------------------------------------------------------------------

  describe('cookie attributes', () => {
    it('should set custom SameSite=Lax', async () => {
      const { protect } = csrf({
        ...defaultOptions(),
        cookie: { sameSite: 'lax' },
      });
      const ctx = createMockContext({ method: 'GET' });
      await protect(ctx as never, next);

      await (ctx.state.csrf as { generateToken: () => Promise<string> }).generateToken();
      expect(ctx.responseHeaders['Set-Cookie']).toContain('SameSite=Lax');
    });

    it('should set custom cookie domain', async () => {
      const { protect } = csrf({
        ...defaultOptions(),
        cookie: { name: 'csrf', domain: 'example.com', secure: false },
      });
      const ctx = createMockContext({ method: 'GET' });
      await protect(ctx as never, next);

      await (ctx.state.csrf as { generateToken: () => Promise<string> }).generateToken();
      expect(ctx.responseHeaders['Set-Cookie']).toContain('Domain=example.com');
    });

    it('should set Max-Age when specified', async () => {
      const { protect } = csrf({
        ...defaultOptions(),
        cookie: { maxAge: 3600 },
      });
      const ctx = createMockContext({ method: 'GET' });
      await protect(ctx as never, next);

      await (ctx.state.csrf as { generateToken: () => Promise<string> }).generateToken();
      expect(ctx.responseHeaders['Set-Cookie']).toContain('Max-Age=3600');
    });
  });

  // --------------------------------------------------------------------------
  // Dynamic Secret
  // --------------------------------------------------------------------------

  describe('dynamic secret', () => {
    it('should call secret function on each validation', async () => {
      const secretFn = vi.fn(() => TEST_SECRET);
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf({ secret: secretFn });
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
        },
      });
      await protect(ctx as never, next);
      // Called once during options resolution + once during validation
      expect(secretFn).toHaveBeenCalled();
      expect(next).toHaveBeenCalledOnce();
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle missing Cookie header gracefully', async () => {
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({ method: 'POST' });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
      expect(ctx.status).toBe(403);
    });

    it('should handle empty Cookie header', async () => {
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({
        method: 'POST',
        headers: { cookie: '' },
      });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle cookie with no matching CSRF cookie', async () => {
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({
        method: 'POST',
        headers: { cookie: 'session=abc; other=value' },
      });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle null body gracefully', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({
        method: 'POST',
        headers: { cookie: `${DEFAULT_COOKIE_NAME}=${token}` },
        body: null,
      });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle string body gracefully', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({
        method: 'POST',
        headers: { cookie: `${DEFAULT_COOKIE_NAME}=${token}` },
        body: 'plain text body',
      });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle completely empty token submission', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: '',
        },
      });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Full Request Lifecycle
  // --------------------------------------------------------------------------

  describe('full lifecycle', () => {
    it('should complete a full generate → submit → validate cycle', async () => {
      const opts = defaultOptions();
      const { protect } = csrf(opts);

      // Step 1: GET request to generate token
      const getCtx = createMockContext({ method: 'GET' });
      await protect(getCtx as never, next);

      const generatedToken = await (
        getCtx.state.csrf as { generateToken: () => Promise<string> }
      ).generateToken();
      expect(generatedToken).toBeTruthy();

      // Step 2: POST request with generated token
      next.mockClear();
      const postCtx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${generatedToken}`,
          [CSRF_HEADER]: generatedToken,
        },
      });
      await protect(postCtx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should complete lifecycle with session binding', async () => {
      const opts = sessionOptions();
      const { protect } = csrf(opts as never);

      // Step 1: Generate token with session
      const getCtx = createMockContext({
        method: 'GET',
        state: { sessionId: TEST_SESSION_ID },
      });
      await protect(getCtx as never, next);
      const generatedToken = await (
        getCtx.state.csrf as { generateToken: () => Promise<string> }
      ).generateToken();

      // Step 2: Submit with same session
      next.mockClear();
      const postCtx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${generatedToken}`,
          [CSRF_HEADER]: generatedToken,
        },
        state: { sessionId: TEST_SESSION_ID },
      });
      await protect(postCtx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should reject lifecycle with session mismatch', async () => {
      const opts = sessionOptions();
      const { protect } = csrf(opts as never);

      // Step 1: Generate token with session A
      const getCtx = createMockContext({
        method: 'GET',
        state: { sessionId: 'session-A' },
      });
      await protect(getCtx as never, next);
      const generatedToken = await (
        getCtx.state.csrf as { generateToken: () => Promise<string> }
      ).generateToken();

      // Step 2: Submit with session B (session fixation attack)
      next.mockClear();
      const postCtx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${generatedToken}`,
          [CSRF_HEADER]: generatedToken,
        },
        state: { sessionId: 'session-B' },
      });
      await protect(postCtx as never, next);
      expect(next).not.toHaveBeenCalled();
      expect(postCtx.status).toBe(403);
    });
  });

  // --------------------------------------------------------------------------
  // Key Cache Eviction (100% coverage: token.ts L48-49)
  // --------------------------------------------------------------------------

  describe('key cache eviction', () => {
    it('should evict oldest key when cache exceeds MAX_CACHED_KEYS', async () => {
      clearKeyCache();

      // Generate tokens with 12 unique secrets to exceed the cache limit of 10
      const secrets = Array.from(
        { length: 12 },
        (_, i) => `secret-number-${i}-that-is-at-least-32-characters-long!!`
      );

      for (const secret of secrets) {
        await generateToken(secret);
      }

      // Validate that the most recent secret still works
      const lastSecret = secrets[11]!;
      const token = await generateToken(lastSecret);
      const isValid = await validateToken(token, lastSecret);
      expect(isValid).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Malformed Origin (100% coverage: middleware.ts L128)
  // --------------------------------------------------------------------------

  describe('malformed origin header', () => {
    it('should reject request with malformed origin URL', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf({
        ...defaultOptions(),
        originCheck: true,
      });
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
          origin: 'not-a-valid-url',
          host: 'example.com',
        },
      });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
      expect(ctx.status).toBe(403);
    });

    it('should reject request when host header is missing', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf({
        ...defaultOptions(),
        originCheck: true,
      });
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
          origin: 'https://evil.com',
        },
      });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
      expect(ctx.status).toBe(403);
    });
  });

  // --------------------------------------------------------------------------
  // Double-wildcard path exact match (middleware.ts L151)
  // --------------------------------------------------------------------------

  describe('double-wildcard exact prefix match', () => {
    it('should match path equal to double-wildcard prefix', async () => {
      const { protect } = csrf({
        ...defaultOptions(),
        excludePaths: ['/api/webhooks/**'],
      });
      const ctx = createMockContext({ method: 'POST', path: '/api/webhooks' });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });
  });

  // --------------------------------------------------------------------------
  // Cookie serialization branches
  // --------------------------------------------------------------------------

  describe('cookie serialization edge cases', () => {
    it('should include HttpOnly when set to true', async () => {
      const { protect } = csrf({
        ...defaultOptions(),
        cookie: { name: 'csrf', httpOnly: true, secure: false },
      });
      const ctx = createMockContext({ method: 'GET' });
      await protect(ctx as never, next);

      await (ctx.state.csrf as { generateToken: () => Promise<string> }).generateToken();
      expect(ctx.responseHeaders['Set-Cookie']).toContain('HttpOnly');
    });

    it('should omit SameSite when set to empty string', async () => {
      const { protect } = csrf({
        ...defaultOptions(),
        cookie: { name: 'csrf', sameSite: '' as 'strict', secure: false },
      });
      const ctx = createMockContext({ method: 'GET' });
      await protect(ctx as never, next);

      await (ctx.state.csrf as { generateToken: () => Promise<string> }).generateToken();
      expect(ctx.responseHeaders['Set-Cookie']).not.toContain('SameSite');
    });

    it('should omit Path when set to empty string', async () => {
      const { protect } = csrf({
        ...defaultOptions(),
        cookie: { name: 'csrf', path: '', secure: false },
      });
      const ctx = createMockContext({ method: 'GET' });
      await protect(ctx as never, next);

      await (ctx.state.csrf as { generateToken: () => Promise<string> }).generateToken();
      expect(ctx.responseHeaders['Set-Cookie']).not.toContain('Path=');
    });
  });

  // --------------------------------------------------------------------------
  // Token validation edge branches (token.ts)
  // --------------------------------------------------------------------------

  describe('token validation edge branches', () => {
    it('should reject token with empty HMAC part', async () => {
      const isValid = await validateToken('.abcdef1234567890', TEST_SECRET);
      expect(isValid).toBe(false);
    });

    it('should reject token with empty random part', async () => {
      const isValid = await validateToken('abcdef1234567890.', TEST_SECRET);
      expect(isValid).toBe(false);
    });

    it('should reject token with non-hex HMAC', async () => {
      const isValid = await validateToken('zzzz.abcdef1234567890', TEST_SECRET);
      expect(isValid).toBe(false);
    });

    it('should reject token with non-hex random', async () => {
      const isValid = await validateToken('abcdef1234567890.zzzz', TEST_SECRET);
      expect(isValid).toBe(false);
    });

    it('should reject null value', async () => {
      const isValid = await validateToken(null as never, TEST_SECRET);
      expect(isValid).toBe(false);
    });

    it('should reject numeric value', async () => {
      const isValid = await validateToken(123 as never, TEST_SECRET);
      expect(isValid).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Origin check without Sec-Fetch-Site (branch coverage)
  // --------------------------------------------------------------------------

  describe('origin check without Sec-Fetch-Site', () => {
    it('should reject cross-origin request via Origin/Host without Sec-Fetch-Site', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf({
        ...defaultOptions(),
        originCheck: true,
      });
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
          origin: 'https://evil.com',
          host: 'example.com',
          // no sec-fetch-site header
        },
      });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow request without Origin or Sec-Fetch-Site (same-origin assumed)', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf({
        ...defaultOptions(),
        originCheck: true,
      });
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
          host: 'example.com',
          // no origin, no sec-fetch-site
        },
      });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should fall through to Origin check on unknown Sec-Fetch-Site value', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf({
        ...defaultOptions(),
        originCheck: true,
      });
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
          'sec-fetch-site': 'unknown-value',
          origin: 'https://example.com',
          host: 'example.com',
        },
      });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should allow request from allowedOrigins without Sec-Fetch-Site', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf({
        ...defaultOptions(),
        originCheck: true,
        allowedOrigins: ['https://allowed.com'],
      });
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
          origin: 'https://allowed.com',
          host: 'api.example.com',
          // no sec-fetch-site header
        },
      });
      await protect(ctx as never, next);
      expect(next).toHaveBeenCalledOnce();
    });

    it('should reject request not in allowedOrigins without Sec-Fetch-Site', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf({
        ...defaultOptions(),
        originCheck: true,
        allowedOrigins: ['https://allowed.com'],
      });
      const ctx = createMockContext({
        method: 'POST',
        headers: {
          cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
          [CSRF_HEADER]: token,
          origin: 'https://evil.com',
          host: 'api.example.com',
          // no sec-fetch-site header
        },
      });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Query-based token extraction with non-string value (branch coverage)
  // --------------------------------------------------------------------------

  describe('query token extraction edge cases', () => {
    it('should not extract token from query when value is non-string', async () => {
      const token = await generateToken(TEST_SECRET);
      const { protect } = csrf(defaultOptions());
      const ctx = createMockContext({
        method: 'POST',
        headers: { cookie: `${DEFAULT_COOKIE_NAME}=${token}` },
        query: { [CSRF_FIELD]: 12345 as unknown as string },
      });
      await protect(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
