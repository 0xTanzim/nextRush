/**
 * @nextrush/security - security() composite preset (task 8.3)
 *
 * Applies helmet + strict cookies + CSRF + rate limit in one call, with
 * production-safe defaults, so the secure configuration is the shortest
 * path (`security-boundaries` capability, spec: "A composite security
 * preset exists").
 */
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { listen } from '@nextrush/adapter-node';
import { afterEach, describe, expect, it } from 'vitest';
import { security } from '../index';

async function withApp(mw: ReturnType<typeof security>) {
  const app = createApp();
  const router = createRouter();
  router.get('/', (ctx) => ctx.json({ ok: true }));
  router.post('/', (ctx) => ctx.json({ ok: true }));
  app.use(mw);
  app.route('/', router);
  const server = await listen(app, 0);
  return {
    baseUrl: `http://127.0.0.1:${String(server.port)}`,
    close: () => server.close(),
  };
}

describe('security()', () => {
  let closeServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await closeServer?.();
    closeServer = undefined;
  });

  const csrfConfig = {
    secret: 'a'.repeat(32),
    sessionBinding: 'none' as const,
    originCheck: false as const,
  };

  it('throws at construction when required CSRF configuration is missing', () => {
    expect(() => security({ csrf: { secret: 'a'.repeat(32) } } as never)).toThrow(
      /getSessionIdentifier|sessionBinding/
    );
  });

  it('applies the helmet header set on a plain request', async () => {
    const mw = security({ csrf: csrfConfig });
    const { baseUrl, close } = await withApp(mw);
    closeServer = close;

    const res = await fetch(baseUrl, { method: 'GET' });
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('rejects a state-changing request without a CSRF token', async () => {
    const mw = security({ csrf: csrfConfig });
    const { baseUrl, close } = await withApp(mw);
    closeServer = close;

    const res = await fetch(baseUrl, { method: 'POST' });
    expect(res.status).toBe(403);
  });

  it('honors a per-layer override without dropping other layers', async () => {
    const mw = security({
      csrf: csrfConfig,
      rateLimit: { max: 1, window: '1m' },
    });
    const { baseUrl, close } = await withApp(mw);
    closeServer = close;

    const first = await fetch(baseUrl, { method: 'GET' });
    expect(first.status).toBe(200);
    expect(first.headers.get('x-content-type-options')).toBe('nosniff');

    const second = await fetch(baseUrl, { method: 'GET' });
    expect(second.status).toBe(429);
  });
});
