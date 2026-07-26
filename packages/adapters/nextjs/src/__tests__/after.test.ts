import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// resolveAfter() caches its result at module scope for the process lifetime
// (RFC-024 §8.3 — "resolved once"), so each scenario needs a fresh module
// registry: vi.resetModules() + a dynamic re-import of the code under test,
// rather than relying on whatever `next` happens to be on disk in this
// monorepo (apps/docs pulls in a real `next`, making ambient-absence tests
// non-deterministic).
describe('handle() — ctx.waitUntil / after() capability probe', () => {
  /** Every real Next.js invocation always supplies a context. */
  const NO_PARAMS = { params: Promise.resolve({}) };

  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock('next/server');
  });

  function buildApp(onWaitUntil: (ctx: { waitUntil: (p: Promise<unknown>) => void }) => void) {
    const router = createRouter();
    router.get('/bg', (ctx) => {
      onWaitUntil(ctx);
      ctx.json({ accepted: true });
    });
    return createApp({ router });
  }

  it('no-ops without throwing when next/server cannot be imported at all', async () => {
    vi.doMock('next/server', () => {
      throw new Error('Cannot find module next/server');
    });
    const { handle } = await import('../index');

    let called = false;
    const app = buildApp((ctx) => {
      ctx.waitUntil(Promise.resolve());
      called = true;
    });

    const { GET } = handle(app);
    const response = await GET(new Request('http://localhost/bg'), NO_PARAMS);

    expect(response.status).toBe(200);
    expect(called).toBe(true);
  });

  it('no-ops without throwing when next/server exists but exports no `after`', async () => {
    vi.doMock('next/server', () => ({}));
    const { handle } = await import('../index');

    let called = false;
    const app = buildApp((ctx) => {
      ctx.waitUntil(Promise.resolve());
      called = true;
    });

    const { GET } = handle(app);
    const response = await GET(new Request('http://localhost/bg'), NO_PARAMS);

    expect(response.status).toBe(200);
    expect(called).toBe(true);
  });

  it('forwards the promise to a resolved `after()`', async () => {
    const after = vi.fn((task: () => void | Promise<void>) => {
      void task();
    });
    vi.doMock('next/server', () => ({ after }));
    const { handle } = await import('../index');

    let called = false;
    const app = buildApp((ctx) => {
      ctx.waitUntil(Promise.resolve());
      called = true;
    });

    const { GET } = handle(app);
    const response = await GET(new Request('http://localhost/bg'), NO_PARAMS);

    expect(response.status).toBe(200);
    expect(called).toBe(true);
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('does not propagate a synchronous throw from `after()` itself', async () => {
    // Mirrors Next's real behaviour when `after()` is called outside a
    // request scope — ctx.waitUntil must still not throw (RFC-024 §8.3;
    // EdgeContext's own waitUntil is documented never to throw).
    const after = vi.fn(() => {
      throw new Error('`after` was called outside a request scope');
    });
    vi.doMock('next/server', () => ({ after }));
    const { handle } = await import('../index');

    let threw = false;
    const app = buildApp((ctx) => {
      try {
        ctx.waitUntil(Promise.resolve());
      } catch {
        threw = true;
      }
    });

    const { GET } = handle(app);
    const response = await GET(new Request('http://localhost/bg'), NO_PARAMS);

    expect(response.status).toBe(200);
    expect(threw).toBe(false);
  });
});
