/**
 * @nextrush/core — calling the request entry point before boot.
 *
 * @remarks
 * `callback()` snapshots the middleware stack, so calling it before `ready()`
 * used to silently omit everything boot contributes: the extension-registered
 * middleware AND the application's own router. Silence is what made the trap
 * invisible — the resulting handler answers 404 for every declared route. These
 * tests pin the two halves of the fix: an application that owns an unmounted
 * router fails loudly and actionably, while an explicitly mounted router (the
 * bring-your-own path) still dispatches without boot.
 */

import type { Context, Router } from '@nextrush/types';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../application';
import { createMockContext } from './_shared/create-mock-context';

const routeHandler = (ctx: Context): void => {
  ctx.json({ ok: true });
};

/** Only `routes()` is reached on this path; the rest of `Router` is irrelevant here. */
function fakeRouter(): Router {
  return { routes: () => routeHandler } as unknown as Router;
}

describe('callback() before boot — an owned router', () => {
  it('throws instead of composing a stack with no router mounted', () => {
    const app = createApp({ router: fakeRouter() });

    expect(() => app.callback()).toThrow();
  });

  it('names what is wrong, what it would cause, and how to fix it', () => {
    const app = createApp({ router: fakeRouter() });

    const message = (() => {
      try {
        app.callback();
      } catch (error) {
        return (error as Error).message;
      }
      return '';
    })();

    expect(message).toMatch(/before ready\(\)/);
    expect(message).toMatch(/router/i);
    expect(message).toMatch(/await app\.ready\(\)/);
    expect(message).toMatch(/listen|serve|createHandler/);
  });

  it('does not throw once the application has booted', async () => {
    const app = createApp({ router: fakeRouter() });
    await app.ready();

    expect(() => app.callback()).not.toThrow();
  });
});

describe('callback() before boot — an explicitly mounted router', () => {
  it('dispatches through a router mounted at the root', async () => {
    const app = createApp();
    app.route('/', fakeRouter());

    const handler = app.callback();
    const ctx = createMockContext({ path: '/users' });

    await handler(ctx);

    expect(ctx.json).toHaveBeenCalledWith({ ok: true });
  });

  it('dispatches through a router whose routes() were registered directly', async () => {
    const app = createApp();
    app.use(fakeRouter().routes());

    const handler = app.callback();
    const ctx = createMockContext({ path: '/users' });

    await handler(ctx);

    expect(ctx.json).toHaveBeenCalledWith({ ok: true });
  });

  it('serves middleware registered directly, with no router involved', async () => {
    const app = createApp();
    app.use(routeHandler);

    const handler = app.callback();
    const ctx = createMockContext();

    await handler(ctx);

    expect(ctx.json).toHaveBeenCalledWith({ ok: true });
  });
});

describe('callback() before boot — the extension warning is kept', () => {
  it('warns about skipped extension setup when the application owns no router', () => {
    const warn = vi.fn();
    const app = createApp({
      logger: { info: vi.fn(), warn, error: vi.fn(), debug: vi.fn() },
    });
    app.extend({ name: 'forgotten', setup: vi.fn() });

    app.callback();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('extend()'));
  });
});
