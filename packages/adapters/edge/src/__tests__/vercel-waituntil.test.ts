import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '@nextrush/core';
import { createEdgeContext } from '../context';
import { createFetchHandler, createVercelHandler } from '../adapter';

describe('Vercel Edge waitUntil support (Issue #76)', () => {
  const vercelSymbol = Symbol.for('@vercel/request-context');
  const nextSymbol = Symbol.for('@next/request-context');

  afterEach(() => {
    delete (globalThis as unknown as Record<symbol, unknown>)[vercelSymbol];
    delete (globalThis as unknown as Record<symbol, unknown>)[nextSymbol];
    vi.restoreAllMocks();
  });

  it('delegates ctx.waitUntil to the 2nd argument context parameter without warning', async () => {
    const waitUntilSpy = vi.fn();
    const mockVercelContext = { waitUntil: waitUntilSpy };
    const consoleWarnSpy = vi.spyOn(console, 'warn');

    const app = createApp();
    app.use(async (ctx) => {
      ctx.waitUntil(Promise.resolve('background-task'));
      ctx.json({ ok: true });
    });

    const handler = createVercelHandler(app);
    const req = new Request('http://localhost/test');

    const res = await handler(req, mockVercelContext);
    expect(res.status).toBe(200);

    expect(waitUntilSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(expect.stringContaining('ctx.waitUntil()'));
  });

  it('delegates to globalThis[Symbol.for("@vercel/request-context")] when available', async () => {
    const globalWaitUntil = vi.fn();
    (globalThis as unknown as Record<symbol, unknown>)[vercelSymbol] = {
      get: () => ({ waitUntil: globalWaitUntil }),
    };
    const consoleWarnSpy = vi.spyOn(console, 'warn');

    const app = createApp();
    app.use(async (ctx) => {
      ctx.waitUntil(Promise.resolve('vercel-analytics'));
      ctx.json({ ok: true });
    });

    const handler = createFetchHandler(app);
    const req = new Request('http://localhost/test');

    // No context parameter passed to handler
    const res = await handler(req);
    expect(res.status).toBe(200);

    expect(globalWaitUntil).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(expect.stringContaining('ctx.waitUntil()'));
  });

  it('delegates to globalThis[Symbol.for("@next/request-context")] when vercel context is absent', async () => {
    const nextWaitUntil = vi.fn();
    (globalThis as unknown as Record<symbol, unknown>)[nextSymbol] = {
      get: () => ({ waitUntil: nextWaitUntil }),
    };

    const ctx = createEdgeContext(new Request('http://localhost/test'), undefined, false, undefined, true);
    ctx.waitUntil(Promise.resolve('next-after'));

    expect(nextWaitUntil).toHaveBeenCalledTimes(1);
  });

  it('tracks promises and drains them deterministically when no host context exists', async () => {
    let taskFinished = false;
    const backgroundTask = new Promise<void>((resolve) => {
      setTimeout(() => {
        taskFinished = true;
        resolve();
      }, 20);
    });

    const ctx = createEdgeContext(new Request('http://localhost/test'), undefined, false, undefined, true);
    ctx.waitUntil(backgroundTask);

    expect(taskFinished).toBe(false);
    expect(ctx.pendingWaitUntils.length).toBe(1);

    await ctx.drainWaitUntil();
    expect(taskFinished).toBe(true);
  });
});
