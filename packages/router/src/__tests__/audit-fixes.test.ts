/**
 * @nextrush/router - Audit Remediation Tests
 *
 * RT-1 (reset clears the introspection registry), RT-5 (param-name conflict
 * throws at registration), RT-7 (routes() is idempotent — no double-seal).
 */

import type { Context } from '@nextrush/types';
import { describe, expect, it, vi } from 'vitest';
import { createRouter } from '../router';

describe('RT-1: reset() clears the introspection registry', () => {
  it('getRoutes() is empty after reset()', () => {
    const router = createRouter();
    router.get('/users', vi.fn());
    router.get('/users/:id', vi.fn());
    expect(router.getRoutes().length).toBeGreaterThan(0);

    router.reset();
    expect(router.getRoutes()).toHaveLength(0);
  });
});

describe('RT-5: param-name conflict throws at registration', () => {
  it('throws when the same position uses two different param names', () => {
    const router = createRouter();
    router.get('/users/:id', vi.fn());
    expect(() => router.get('/users/:userId/posts', vi.fn())).toThrow(/param/i);
  });

  it('does not throw when the param name is consistent', () => {
    const router = createRouter();
    router.get('/users/:id', vi.fn());
    expect(() => router.get('/users/:id/posts', vi.fn())).not.toThrow();
  });
});

describe('RT-7: routes() is idempotent w.r.t. router middleware sealing', () => {
  it('runs router-level middleware exactly once even if routes() is called twice', async () => {
    const router = createRouter();
    const calls = { n: 0 };
    router.use(async (_ctx: Context, next) => {
      calls.n++;
      if (next) await next();
    });
    router.get('/x', (ctx: Context) => {
      ctx.body = 'ok';
    });

    router.routes();
    router.routes(); // second call must not re-seal

    const match = router.match('GET', '/x');
    expect(match).not.toBeNull();
    const ctx = { method: 'GET', path: '/x', params: {}, body: undefined } as unknown as Context;
    await match!.executor!(ctx);
    expect(calls.n).toBe(1);
  });
});
