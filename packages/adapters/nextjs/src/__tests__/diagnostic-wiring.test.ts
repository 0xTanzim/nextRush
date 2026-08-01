import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('handle() — mount-mismatch diagnostic wiring', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildMismatchedApp() {
    // The route is declared WITHOUT the /api prefix — the exact mistake the
    // diagnostic exists to catch (RFC-024 §8.4/§3.2.5).
    const router = createRouter();
    router.get('/hello', (ctx) => ctx.json({ message: 'hello' }));
    return createApp({ router, env: 'development' });
  }

  it('logs an actionable message through app.logger on a mount-prefix mismatch, in development', async () => {
    const { handle } = await import('../index');
    const app = buildMismatchedApp();
    const warn = vi.fn();
    (app as unknown as { logger: { warn: typeof warn } }).logger = {
      ...(app as unknown as { logger: Record<string, unknown> }).logger,
      warn,
    };

    const { GET } = handle(app);
    const response = await GET(new Request('http://localhost/api/hello'), {
      params: Promise.resolve({ route: ['hello'] }),
    });

    expect(response.status).toBe(404);
    expect(warn).toHaveBeenCalledTimes(1);
    const [message] = warn.mock.calls[0] as [string];
    expect(message).toContain('/api');
    expect(message).toContain("app.route('/api'");
  });

  it('never serves the re-dispatched response — the original 404 is returned unchanged', async () => {
    const { handle } = await import('../index');
    const app = buildMismatchedApp();

    const { GET } = handle(app);
    const response = await GET(new Request('http://localhost/api/hello'), {
      params: Promise.resolve({ route: ['hello'] }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Not Found' });
  });

  it('does not diagnose or log in production, even on a genuine mismatch', async () => {
    const { handle } = await import('../index');
    const router = createRouter();
    router.get('/hello', (ctx) => ctx.json({ message: 'hello' }));
    const app = createApp({ router, env: 'production' });
    const warn = vi.fn();
    (app as unknown as { logger: { warn: typeof warn } }).logger = {
      ...(app as unknown as { logger: Record<string, unknown> }).logger,
      warn,
    };

    const { GET } = handle(app);
    const response = await GET(new Request('http://localhost/api/hello'), {
      params: Promise.resolve({ route: ['hello'] }),
    });

    expect(response.status).toBe(404);
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not diagnose a genuine 404 with no matching route once stripped', async () => {
    const { handle } = await import('../index');
    const app = buildMismatchedApp();
    const warn = vi.fn();
    (app as unknown as { logger: { warn: typeof warn } }).logger = {
      ...(app as unknown as { logger: Record<string, unknown> }).logger,
      warn,
    };

    const { GET } = handle(app);
    const response = await GET(new Request('http://localhost/api/does-not-exist'), {
      params: Promise.resolve({ route: ['does-not-exist'] }),
    });

    expect(response.status).toBe(404);
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not diagnose on a successful (non-404) response', async () => {
    const router = createRouter();
    router.get('/api/hello', (ctx) => ctx.json({ message: 'hello' }));
    const app = createApp({ router, env: 'development' });
    const warn = vi.fn();
    (app as unknown as { logger: { warn: typeof warn } }).logger = {
      ...(app as unknown as { logger: Record<string, unknown> }).logger,
      warn,
    };
    const { handle } = await import('../index');

    const { GET } = handle(app);
    const response = await GET(new Request('http://localhost/api/hello'), {
      params: Promise.resolve({ route: ['hello'] }),
    });

    expect(response.status).toBe(200);
    expect(warn).not.toHaveBeenCalled();
  });
});
