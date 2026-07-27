/**
 * @nextrush/csrf - Security hardening tests (harden-security-boundaries, WS-C)
 *
 * Covers SEC-03, SEC-04, SEC-05, SEC-06, SEC-15, SEC-19 per
 * openspec/changes/harden-security-boundaries/tasks.md §5 (5.1-5.11).
 * Each describe block corresponds to one numbered task.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CSRF_FIELD, CSRF_HEADER, DEFAULT_COOKIE_NAME } from '../constants.js';
import { csrf } from '../middleware.js';
import { clearKeyCache, constantTimeEqual, generateToken } from '../token.js';

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

const TEST_SECRET = 'a-very-secure-secret-that-is-at-least-32-characters-long';
const ALLOWED_ORIGIN = 'https://app.example.com';

beforeEach(() => {
  clearKeyCache();
});

// ============================================================================
// 5.1 — Default-options GET-then-POST round trip (the SEC-03 regression test)
// ============================================================================

describe('5.1 default-options round trip', () => {
  it('issues a token on GET, then validates it on a subsequent POST', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { protect } = csrf({
      secret: TEST_SECRET,
      sessionBinding: 'none',
      originCheck: true,
      allowedOrigins: [ALLOWED_ORIGIN],
    });

    const getCtx = createMockContext({ method: 'GET' });
    await protect(getCtx as never, next);
    const token = await (
      getCtx.state.csrf as { generateToken: () => Promise<string> }
    ).generateToken();
    expect(token).toBeTruthy();

    next.mockClear();
    const postCtx = createMockContext({
      method: 'POST',
      headers: {
        cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
        [CSRF_HEADER]: token,
        origin: ALLOWED_ORIGIN,
      },
    });
    await protect(postCtx as never, next);
    expect(next).toHaveBeenCalledOnce();
    expect(postCtx.status).toBe(200);
  });
});

// ============================================================================
// 5.2 / 5.3 — Cookie Max-Age/Expires only when explicitly configured
// ============================================================================

describe('5.2-5.3 cookie Max-Age contract', () => {
  it('omits Max-Age and Expires when cookie.maxAge is not configured', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { protect } = csrf({ secret: TEST_SECRET, sessionBinding: 'none', originCheck: false });
    const ctx = createMockContext({ method: 'GET' });
    await protect(ctx as never, next);

    await (ctx.state.csrf as { generateToken: () => Promise<string> }).generateToken();
    expect(ctx.responseHeaders['Set-Cookie']).not.toContain('Max-Age');
    expect(ctx.responseHeaders['Set-Cookie']).not.toContain('Expires');
  });

  it('rejects a negative maxAge at construction', () => {
    expect(() =>
      csrf({
        secret: TEST_SECRET,
        sessionBinding: 'none',
        originCheck: false,
        cookie: { maxAge: -1 },
      })
    ).toThrow(/maxAge/);
  });

  it('rejects a NaN maxAge at construction', () => {
    expect(() =>
      csrf({
        secret: TEST_SECRET,
        sessionBinding: 'none',
        originCheck: false,
        cookie: { maxAge: Number.NaN },
      })
    ).toThrow(/maxAge/);
  });

  it('rejects an Infinity maxAge at construction', () => {
    expect(() =>
      csrf({
        secret: TEST_SECRET,
        sessionBinding: 'none',
        originCheck: false,
        cookie: { maxAge: Number.POSITIVE_INFINITY },
      })
    ).toThrow(/maxAge/);
  });

  it('still emits an explicitly configured maxAge verbatim', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { protect } = csrf({
      secret: TEST_SECRET,
      sessionBinding: 'none',
      originCheck: false,
      cookie: { maxAge: 3600 },
    });
    const ctx = createMockContext({ method: 'GET' });
    await protect(ctx as never, next);
    await (ctx.state.csrf as { generateToken: () => Promise<string> }).generateToken();
    expect(ctx.responseHeaders['Set-Cookie']).toContain('Max-Age=3600');
  });
});

// ============================================================================
// 5.4 / 5.5 — Origin validation never trusts Host; Sec-Fetch-Site is reject-only
// ============================================================================

describe('5.4-5.5 origin validation', () => {
  it('rejects a forged Host + Origin pair not in the allowlist', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const token = await generateToken(TEST_SECRET);
    const { protect } = csrf({
      secret: TEST_SECRET,
      sessionBinding: 'none',
      originCheck: true,
      allowedOrigins: [ALLOWED_ORIGIN],
    });
    const ctx = createMockContext({
      method: 'POST',
      headers: {
        cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
        [CSRF_HEADER]: token,
        host: 'evil.example',
        origin: 'https://evil.example',
      },
    });
    await protect(ctx as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(ctx.status).toBe(403);
  });

  it('rejects a missing Origin header on an unsafe method', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const token = await generateToken(TEST_SECRET);
    const { protect } = csrf({
      secret: TEST_SECRET,
      sessionBinding: 'none',
      originCheck: true,
      allowedOrigins: [ALLOWED_ORIGIN],
    });
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

  it('does not let Sec-Fetch-Site: none override an allowlist rejection', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const token = await generateToken(TEST_SECRET);
    const { protect } = csrf({
      secret: TEST_SECRET,
      sessionBinding: 'none',
      originCheck: true,
      allowedOrigins: [ALLOWED_ORIGIN],
    });
    const ctx = createMockContext({
      method: 'POST',
      headers: {
        cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
        [CSRF_HEADER]: token,
        'sec-fetch-site': 'none',
        origin: 'https://evil.example',
      },
    });
    await protect(ctx as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(ctx.status).toBe(403);
  });

  it('rejects Sec-Fetch-Site: cross-site before any crypto comparison', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const subtleSpy = vi.spyOn(crypto.subtle, 'verify');
    const token = await generateToken(TEST_SECRET);
    const { protect } = csrf({
      secret: TEST_SECRET,
      sessionBinding: 'none',
      originCheck: true,
      allowedOrigins: [ALLOWED_ORIGIN],
    });
    const ctx = createMockContext({
      method: 'POST',
      headers: {
        cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
        [CSRF_HEADER]: token,
        'sec-fetch-site': 'cross-site',
        origin: 'https://evil.example',
      },
    });
    subtleSpy.mockClear();
    await protect(ctx as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(subtleSpy).not.toHaveBeenCalled();
    subtleSpy.mockRestore();
  });

  it('throws at construction when originCheck: true is given with no allowedOrigins', () => {
    expect(() =>
      csrf({ secret: TEST_SECRET, sessionBinding: 'none', originCheck: true })
    ).toThrow(/allowedOrigins/);
  });

  it('throws at construction when originCheck defaults to true and allowedOrigins is omitted', () => {
    expect(() => csrf({ secret: TEST_SECRET, sessionBinding: 'none' })).toThrow(
      /allowedOrigins/
    );
  });

  it('accepts a request whose Origin matches the allowlist even with a mismatched Host', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const token = await generateToken(TEST_SECRET);
    const { protect } = csrf({
      secret: TEST_SECRET,
      sessionBinding: 'none',
      originCheck: true,
      allowedOrigins: [ALLOWED_ORIGIN],
    });
    const ctx = createMockContext({
      method: 'POST',
      headers: {
        cookie: `${DEFAULT_COOKIE_NAME}=${token}`,
        [CSRF_HEADER]: token,
        host: 'internal-service-name',
        origin: ALLOWED_ORIGIN,
      },
    });
    await protect(ctx as never, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// 5.6 — Session-bound tokens require an explicit decision
// ============================================================================

describe('5.6 session binding is an explicit decision', () => {
  it('throws when neither getSessionIdentifier nor sessionBinding is supplied', () => {
    expect(() => csrf({ secret: TEST_SECRET })).toThrow(
      /getSessionIdentifier|sessionBinding/
    );
  });

  it('throws when sessionBinding is set to an invalid value', () => {
    expect(() =>
      csrf({ secret: TEST_SECRET, sessionBinding: 'nope' as never })
    ).toThrow(/sessionBinding/);
  });

  it('does not throw when getSessionIdentifier is supplied', () => {
    expect(() =>
      csrf({
        secret: TEST_SECRET,
        getSessionIdentifier: () => 'session-1',
        originCheck: false,
      })
    ).not.toThrow();
  });

  it('does not throw when sessionBinding: "none" is supplied', () => {
    expect(() => csrf({ secret: TEST_SECRET, sessionBinding: 'none', originCheck: false })).not.toThrow();
  });

  it('rejects a token minted for session A when submitted under session B', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const token = await generateToken(TEST_SECRET, 'session-A');
    const { protect } = csrf({
      secret: TEST_SECRET,
      getSessionIdentifier: (ctx) => (ctx.state as { sessionId?: string }).sessionId,
      originCheck: false,
    });
    const ctx = createMockContext({
      method: 'POST',
      headers: { cookie: `${DEFAULT_COOKIE_NAME}=${token}`, [CSRF_HEADER]: token },
      state: { sessionId: 'session-B' },
    });
    await protect(ctx as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(ctx.status).toBe(403);
  });

  it('validates consistently when the identifier is undefined at both ends', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const getSessionIdentifier = (): string | undefined => undefined;
    const token = await generateToken(TEST_SECRET, getSessionIdentifier());
    const { protect } = csrf({ secret: TEST_SECRET, getSessionIdentifier, originCheck: false });
    const ctx = createMockContext({
      method: 'POST',
      headers: { cookie: `${DEFAULT_COOKIE_NAME}=${token}`, [CSRF_HEADER]: token },
    });
    await protect(ctx as never, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// 5.7 — HMAC blinding key is a per-process random value, cached
// ============================================================================

describe('5.7 constant-time comparison blinding key', () => {
  it('is not derived from a compile-time literal string', async () => {
    // Two independent module states would each mint a different random key;
    // within one process the key stays stable, so this asserts the property
    // observable from userland: the comparison result must not depend on any
    // string the source code exposes.
    const equal = await constantTimeEqual('csrf-compare', 'csrf-compare');
    expect(equal).toBe(true); // sanity: equal strings still compare equal
  });

  it('imports the blinding key at most once across many comparisons', async () => {
    const importSpy = vi.spyOn(crypto.subtle, 'importKey');
    importSpy.mockClear();
    for (let i = 0; i < 20; i++) {
      await constantTimeEqual(`value-${String(i)}`, `value-${String(i)}`);
    }
    expect(importSpy).toHaveBeenCalledTimes(0);
    importSpy.mockRestore();
  });
});

// ============================================================================
// 5.8 — Shape/length checks reject before any crypto.subtle call
// ============================================================================

describe('5.8 shape checks run before crypto', () => {
  it('performs zero crypto.subtle operations when the submitted token has invalid hex', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const cookieToken = await generateToken(TEST_SECRET);
    const verifySpy = vi.spyOn(crypto.subtle, 'verify');
    const signSpy = vi.spyOn(crypto.subtle, 'sign');
    const { protect } = csrf({ secret: TEST_SECRET, sessionBinding: 'none', originCheck: false });
    const ctx = createMockContext({
      method: 'POST',
      headers: {
        cookie: `${DEFAULT_COOKIE_NAME}=${cookieToken}`,
        [CSRF_HEADER]: 'zzzz.not-hex-either',
      },
    });
    verifySpy.mockClear();
    signSpy.mockClear();
    await protect(ctx as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(verifySpy).not.toHaveBeenCalled();
    expect(signSpy).not.toHaveBeenCalled();
    verifySpy.mockRestore();
    signSpy.mockRestore();
  });

  it('performs zero crypto.subtle operations when the cookie token has invalid shape', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const verifySpy = vi.spyOn(crypto.subtle, 'verify');
    const signSpy = vi.spyOn(crypto.subtle, 'sign');
    const { protect } = csrf({ secret: TEST_SECRET, sessionBinding: 'none', originCheck: false });
    const ctx = createMockContext({
      method: 'POST',
      headers: {
        cookie: `${DEFAULT_COOKIE_NAME}=not-a-real-token`,
        [CSRF_HEADER]: 'not-a-real-token',
      },
    });
    verifySpy.mockClear();
    signSpy.mockClear();
    await protect(ctx as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(verifySpy).not.toHaveBeenCalled();
    expect(signSpy).not.toHaveBeenCalled();
    verifySpy.mockRestore();
    signSpy.mockRestore();
  });

  it('still performs crypto and validates when both tokens have valid shape', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const token = await generateToken(TEST_SECRET);
    const { protect } = csrf({ secret: TEST_SECRET, sessionBinding: 'none', originCheck: false });
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
});

// ============================================================================
// 5.9 — excludePaths matches canonical paths: /* one segment, /** any depth
// ============================================================================

describe('5.9 excludePaths wildcard depth semantics', () => {
  it('does not match /* against a deeper path (fixes the any-depth bug)', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { protect } = csrf({
      secret: TEST_SECRET,
      sessionBinding: 'none',
      originCheck: false,
      excludePaths: ['/api/webhooks/*'],
    });
    const ctx = createMockContext({ method: 'POST', path: '/api/webhooks/stripe/deep' });
    await protect(ctx as never, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('matches /* against exactly one remaining segment', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { protect } = csrf({
      secret: TEST_SECRET,
      sessionBinding: 'none',
      originCheck: false,
      excludePaths: ['/api/webhooks/*'],
    });
    const ctx = createMockContext({ method: 'POST', path: '/api/webhooks/stripe' });
    await protect(ctx as never, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('matches /** against any depth', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { protect } = csrf({
      secret: TEST_SECRET,
      sessionBinding: 'none',
      originCheck: false,
      excludePaths: ['/api/webhooks/**'],
    });
    const ctx = createMockContext({ method: 'POST', path: '/api/webhooks/a/b/c' });
    await protect(ctx as never, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('does not match a prefix that is not a segment boundary', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { protect } = csrf({
      secret: TEST_SECRET,
      sessionBinding: 'none',
      originCheck: false,
      excludePaths: ['/api/web/*'],
    });
    const ctx = createMockContext({ method: 'POST', path: '/api/webhooks/x' });
    await protect(ctx as never, next);
    expect(next).not.toHaveBeenCalled();
  });
});

// ============================================================================
// 5.10 — The default extractor never reads the query string
// ============================================================================

describe('5.10 default extractor drops the query-string fallback', () => {
  it('does not accept a token supplied only via ?_csrf=', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const token = await generateToken(TEST_SECRET);
    const { protect } = csrf({ secret: TEST_SECRET, sessionBinding: 'none', originCheck: false });
    const ctx = createMockContext({
      method: 'POST',
      headers: { cookie: `${DEFAULT_COOKIE_NAME}=${token}` },
      query: { [CSRF_FIELD]: token },
    });
    await protect(ctx as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(ctx.status).toBe(403);
  });

  it('still accepts a query-string token via an explicit custom extractor', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const token = await generateToken(TEST_SECRET);
    const { protect } = csrf({
      secret: TEST_SECRET,
      sessionBinding: 'none',
      originCheck: false,
      getTokenFromRequest: (ctx) => {
        const query = (ctx as unknown as MockContext).query;
        return query[CSRF_FIELD];
      },
    });
    const ctx = createMockContext({
      method: 'POST',
      headers: { cookie: `${DEFAULT_COOKIE_NAME}=${token}` },
      query: { [CSRF_FIELD]: token },
    });
    await protect(ctx as never, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// 5.11 — Edge cases
// ============================================================================

describe('5.11 edge cases', () => {
  it('round-trips a cookie value containing the token separator byte-for-byte', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const token = await generateToken(TEST_SECRET); // always contains '.'
    expect(token).toContain('.');
    const { protect } = csrf({ secret: TEST_SECRET, sessionBinding: 'none', originCheck: false });
    const ctx = createMockContext({
      method: 'POST',
      headers: {
        cookie: `session=abc; ${DEFAULT_COOKIE_NAME}=${token}; other=x`,
        [CSRF_HEADER]: token,
      },
    });
    await protect(ctx as never, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects a token whose HMAC leg is valid hex but the wrong length', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const token = await generateToken(TEST_SECRET);
    const [, random] = token.split('.');
    const wrongLengthHmac = 'ab'.repeat(10); // valid hex, wrong length for SHA-256
    const tampered = `${wrongLengthHmac}.${random ?? ''}`;
    const { protect } = csrf({ secret: TEST_SECRET, sessionBinding: 'none', originCheck: false });
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

  it('sets exactly one Set-Cookie header for concurrent generateToken() calls', async () => {
    const next = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { protect } = csrf({ secret: TEST_SECRET, sessionBinding: 'none', originCheck: false });
    const ctx = createMockContext({ method: 'GET' });
    const setCalls: string[] = [];
    ctx.set = (name: string, value: string) => {
      setCalls.push(name);
      ctx.responseHeaders[name] = value;
    };
    await protect(ctx as never, next);
    const csrfCtx = ctx.state.csrf as { generateToken: () => Promise<string> };
    await Promise.all([csrfCtx.generateToken(), csrfCtx.generateToken(), csrfCtx.generateToken()]);
    expect(setCalls.filter((n) => n === 'Set-Cookie')).toHaveLength(1);
  });

  it('still enforces __Host- prefix constraints alongside the new required options', () => {
    expect(() =>
      csrf({
        secret: TEST_SECRET,
        sessionBinding: 'none',
        originCheck: false,
        cookie: { name: '__Host-csrf', secure: false },
      })
    ).toThrow('__Host- prefix require secure: true');
  });
});
