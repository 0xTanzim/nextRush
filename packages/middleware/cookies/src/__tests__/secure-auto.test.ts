/**
 * @nextrush/cookies - secure: 'auto' transport tests (SEC-08)
 *
 * RED tests for tasks 6.6-6.7. secure: 'auto' becomes the default: Secure is
 * emitted unless the request is demonstrably plaintext loopback; an
 * untrusted forwarded-protocol claim never talks the framework out of
 * Secure (fail closed). See openspec/changes/harden-security-boundaries/
 * tasks.md §6 and specs/security-boundaries/spec.md "Cookies default to
 * Secure outside plaintext loopback".
 */

import { describe, expect, it, vi } from 'vitest';
import { cookies } from '../middleware.js';
import type { CookieContext } from '../middleware-types.js';

function createMockContext(options: {
  ip: string;
  encrypted?: boolean;
  headers?: Record<string, string>;
}) {
  const responseHeaders: Record<string, string | string[]> = {};
  const state: Record<string, unknown> = {};

  return {
    method: 'GET',
    url: '/',
    path: '/',
    query: {},
    headers: options.headers ?? {},
    ip: options.ip,
    body: undefined,
    params: {},
    status: 200,
    state,
    raw: {
      req: { socket: { encrypted: options.encrypted ?? false } },
      res: {
        getHeader: (name: string) => responseHeaders[name.toLowerCase()],
        setHeader: (name: string, value: string | string[]) => {
          responseHeaders[name.toLowerCase()] = value;
        },
      },
    },
    json: vi.fn(),
    send: vi.fn(),
    html: vi.fn(),
    redirect: vi.fn(),
    throw: vi.fn(),
    assert: vi.fn(),
    set: vi.fn((field: string, value: string | number | string[]) => {
      const key = field.toLowerCase();
      if (key === 'set-cookie' && !Array.isArray(value)) {
        const existing = responseHeaders[key];
        if (existing === undefined) {
          responseHeaders[key] = [String(value)];
        } else if (Array.isArray(existing)) {
          existing.push(String(value));
        } else {
          responseHeaders[key] = [String(existing), String(value)];
        }
        return;
      }
      responseHeaders[key] = Array.isArray(value) ? value : String(value);
    }),
    get: vi.fn((field: string) => (options.headers ?? {})[field.toLowerCase()]),
    _responseHeaders: responseHeaders,
  };
}

async function setAndCapture(ctx: ReturnType<typeof createMockContext>): Promise<string> {
  const middleware = cookies();
  const next = vi.fn(async () => {
    const api = ctx.state.cookies as CookieContext;
    api.set('session', 'value');
  });
  await middleware(ctx as never, next);
  const setCookie = ctx._responseHeaders['set-cookie'] as string[];
  return setCookie[0];
}

describe('SEC-08: secure "auto" default', () => {
  it('emits Secure on a TLS request', async () => {
    const ctx = createMockContext({ ip: '203.0.113.5', encrypted: true });
    const cookie = await setAndCapture(ctx);
    expect(cookie).toContain('Secure');
  });

  it('emits Secure on a trusted-forwarded HTTPS request', async () => {
    const middleware = cookies({ trustProxy: true });
    const ctx = createMockContext({
      ip: '203.0.113.5',
      encrypted: false,
      headers: { 'x-forwarded-proto': 'https' },
    });
    const next = vi.fn(async () => {
      const api = ctx.state.cookies as CookieContext;
      api.set('session', 'value');
    });
    await middleware(ctx as never, next);
    const setCookie = ctx._responseHeaders['set-cookie'] as string[];
    expect(setCookie[0]).toContain('Secure');
  });

  it('omits Secure on plaintext loopback', async () => {
    const ctx = createMockContext({ ip: '127.0.0.1', encrypted: false });
    const cookie = await setAndCapture(ctx);
    expect(cookie).not.toContain('Secure');
  });

  it('omits Secure on plaintext IPv6 loopback', async () => {
    const ctx = createMockContext({ ip: '::1', encrypted: false });
    const cookie = await setAndCapture(ctx);
    expect(cookie).not.toContain('Secure');
  });

  it('fails closed: emits Secure anyway when an untrusted X-Forwarded-Proto: https claim arrives on plaintext non-loopback', async () => {
    // trustProxy is NOT set — the header must not be trusted.
    const ctx = createMockContext({
      ip: '203.0.113.5',
      encrypted: false,
      headers: { 'x-forwarded-proto': 'https' },
    });
    const cookie = await setAndCapture(ctx);
    expect(cookie).toContain('Secure');
  });

  it('emits Secure on plaintext non-loopback with no forwarded-proto claim at all', async () => {
    const ctx = createMockContext({ ip: '203.0.113.5', encrypted: false });
    const cookie = await setAndCapture(ctx);
    expect(cookie).toContain('Secure');
  });

  it('honors an explicit secure: false override even on a TLS request', async () => {
    const middleware = cookies();
    const ctx = createMockContext({ ip: '203.0.113.5', encrypted: true });
    const next = vi.fn(async () => {
      const api = ctx.state.cookies as CookieContext;
      api.set('session', 'value', { secure: false });
    });
    await middleware(ctx as never, next);
    const setCookie = ctx._responseHeaders['set-cookie'] as string[];
    expect(setCookie[0]).not.toContain('Secure');
  });

  it('honors an explicit secure: true override on plaintext loopback', async () => {
    const middleware = cookies();
    const ctx = createMockContext({ ip: '127.0.0.1', encrypted: false });
    const next = vi.fn(async () => {
      const api = ctx.state.cookies as CookieContext;
      api.set('session', 'value', { secure: true });
    });
    await middleware(ctx as never, next);
    const setCookie = ctx._responseHeaders['set-cookie'] as string[];
    expect(setCookie[0]).toContain('Secure');
  });
});
