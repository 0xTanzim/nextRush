/**
 * @nextrush/express-bridge — branch-coverage closure tests
 */

import { describe, expect, it, vi } from 'vitest';
import type { Context } from '@nextrush/types';
import { createContinuation } from '../continuation';
import { serializeCookie } from '../cookie-serialize';
import { compat } from '../compat';

function ctx(partial: Partial<Context> = {}): Context {
  return {
    method: 'GET',
    url: '/',
    path: '/',
    query: {},
    headers: {},
    ip: '127.0.0.1',
    body: undefined,
    params: {},
    status: 200,
    state: {},
    cookies: {} as never,
    raw: {
      req: { on() {}, method: 'GET', url: '/', headers: {} },
      res: { setHeader() {}, end() {}, headersSent: false, statusCode: 200, writeHead() {} },
    },
    runtime: 'node',
    platform: undefined,
    json: vi.fn(),
    send: vi.fn(),
    html: vi.fn(),
    redirect: vi.fn(),
    throw: vi.fn(),
    assert: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    next: vi.fn(),
    responded: false,
    bodySource: {} as never,
    signal: new AbortController().signal,
    sendStream: vi.fn(),
    stream: vi.fn(),
    sse: vi.fn(),
    ndjson: vi.fn(),
    ...partial,
  };
}

describe('continuation remaining branches', () => {
  it('downstream rejection settles error state', async () => {
    const err = new Error('downstream');
    const cont = createContinuation({ ctx: ctx(), downstream: () => Promise.reject(err), rawRes: {} });
    cont.expressNext();
    await expect(cont.promise).rejects.toBe(err);
    expect(cont.state).toBe('error');
  });

  it('non-thenable object return is callback continuation', async () => {
    const cont = createContinuation({ ctx: ctx(), downstream: async () => {}, rawRes: {} });
    cont.adoptReturn({ then: 'not-a-function' });
    expect(cont.state).toBe('idle');
  });

  it('non-Error fail value is wrapped', async () => {
    const cont = createContinuation({ ctx: ctx(), downstream: async () => {}, rawRes: {} });
    cont.fail('string-error');
    await expect(cont.promise).rejects.toThrow('string-error');
  });

  it('fail after continuation is ignored', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const cont = createContinuation({ ctx: ctx(), downstream: async () => {}, rawRes: {} });
      cont.markTerminated();
      cont.fail(new Error('late'));
      await expect(cont.promise).resolves.toBeUndefined();
    } finally {
      warn.mockRestore();
    }
  });
});

describe('cookie-serialize remaining branches', () => {
  it('serializes domain, expires, partitioned, priority, and sameSite variants', () => {
    const date = new Date('2030-01-01T00:00:00Z');
    expect(serializeCookie('sid', 'x', { domain: 'example.com' })).toContain('Domain=example.com');
    expect(serializeCookie('sid', 'x', { expires: date })).toContain(date.toUTCString());
    expect(serializeCookie('sid', 'x', { partitioned: true })).toContain('Partitioned');
    expect(serializeCookie('sid', 'x', { priority: 'high' })).toContain('Priority=high');
    expect(serializeCookie('sid', 'x', { sameSite: true })).toContain('SameSite=Strict');
    expect(serializeCookie('sid', 'x', { sameSite: false })).toContain('SameSite=None');
  });

  it('serializes a custom path', () => {
    expect(serializeCookie('sid', 'x', { path: '/app' })).toContain('Path=/app');
  });
});

describe('compat markResponded duck-call', () => {
  it('calls markResponded when raw headersSent and !responded', async () => {
    const markResponded = vi.fn();
    const c = ctx();
    (c as unknown as { markResponded?: () => void }).markResponded = markResponded;
    (c.raw as { res?: { headersSent?: boolean } }).res = {
      setHeader() {},
      end() {},
      headersSent: true,
      writeHead() {},
    };

    const mw = compat((_req, _res, next) => {
      (next as () => void)();
    });
    await mw(c, async () => {});
    expect(markResponded).toHaveBeenCalled();
  });

  it('does not call markResponded when responded is already true', async () => {
    const markResponded = vi.fn();
    const c = ctx({ responded: true });
    (c as unknown as { markResponded?: () => void }).markResponded = markResponded;
    (c.raw as { res?: { headersSent?: boolean } }).res = {
      setHeader() {},
      end() {},
      headersSent: true,
      writeHead() {},
    };

    const mw = compat((_req, _res, next) => {
      (next as () => void)();
    });
    await mw(c, async () => {});
    expect(markResponded).not.toHaveBeenCalled();
  });
});
