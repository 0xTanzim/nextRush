/**
 * P1-3a (report/dx-review-serverless-edge-adapters.md): warn, once per
 * process/isolate, when a SECOND distinct `Application` instance boots
 * through this module's request runner — the mechanical signature of the
 * #1 documented cold-start mistake (calling `createApp()`/`createFetchHandler()`
 * inside the exported handler instead of at module scope, which rebuilds and
 * reboots the app on every invocation).
 *
 * Uses `vi.resetModules()` + dynamic re-import per test so each test gets a
 * fresh copy of `adapter.ts`'s module-level tracking state, since the whole
 * point of this feature is that the state persists ACROSS `createFetchHandler`
 * calls within one module instance.
 */

import { createApp } from '@nextrush/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { createFetchHandler as CreateFetchHandler } from '../adapter';

async function freshAdapterModule(): Promise<{ createFetchHandler: typeof CreateFetchHandler }> {
  vi.resetModules();
  return import('../adapter');
}

function devApp(): ReturnType<typeof createApp> {
  const app = createApp({ env: 'development' });
  app.use(async (ctx) => ctx.json({ ok: true }));
  return app;
}

describe('boot-reuse warning (P1-3a)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('does not warn when the same Application boots once', async () => {
    const { createFetchHandler } = await freshAdapterModule();
    const app = devApp();
    const handler = createFetchHandler(app);
    await handler(new Request('http://localhost/'));

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('does not warn when the same Application is passed to a second createFetchHandler call (rebuilding the handler, not the app, is not the mistake)', async () => {
    const { createFetchHandler } = await freshAdapterModule();
    const app = devApp();
    await createFetchHandler(app)(new Request('http://localhost/'));
    await createFetchHandler(app)(new Request('http://localhost/'));

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('warns once when a second, distinct Application boots in the same module instance', async () => {
    const { createFetchHandler } = await freshAdapterModule();
    const appOne = devApp();
    const appTwo = devApp();

    await createFetchHandler(appOne)(new Request('http://localhost/'));
    await createFetchHandler(appTwo)(new Request('http://localhost/'));

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/\[nextrush\/edge\].*module scope/i);
    warnSpy.mockRestore();
  });

  it('does not warn in production even with two distinct Applications', async () => {
    const { createFetchHandler } = await freshAdapterModule();
    const appOne = createApp({ env: 'production' });
    appOne.use(async (ctx) => ctx.json({ ok: true }));
    const appTwo = createApp({ env: 'production' });
    appTwo.use(async (ctx) => ctx.json({ ok: true }));

    await createFetchHandler(appOne)(new Request('http://localhost/'));
    await createFetchHandler(appTwo)(new Request('http://localhost/'));

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('warns only once even across a third and fourth distinct Application', async () => {
    const { createFetchHandler } = await freshAdapterModule();
    for (let i = 0; i < 4; i++) {
      const app = devApp();
      // eslint-disable-next-line no-await-in-loop -- sequential boots are the point of this test
      await createFetchHandler(app)(new Request('http://localhost/'));
    }

    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});
