import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../application';
import { RESOLVED_PROMISE } from '@nextrush/types';

describe('Application.callback() synchronous resolution fast path', () => {
  it('returns RESOLVED_PROMISE directly when the dispatch settles synchronously', async () => {
    const app = createApp();
    app.use((ctx) => {
      ctx.status = 200;
    });
    await app.ready();

    const cb = app.callback();
    const ctx = {
      status: 200,
      responded: false,
      headers: {},
      state: {},
      params: {},
    } as never;

    const res = cb(ctx);
    expect(res).toBe(RESOLVED_PROMISE);
  });

  it('still routes synchronous errors to handleError', async () => {
    const app = createApp();
    const errorHandler = vi.fn();
    app.setErrorHandler(errorHandler);
    app.use(() => {
      throw new Error('sync explosion');
    });
    await app.ready();

    const cb = app.callback();
    const ctx = {
      status: 200,
      responded: false,
      headers: {},
      state: {},
      params: {},
    } as never;

    const res = cb(ctx);
    expect(res).not.toBe(RESOLVED_PROMISE);
    await res;
    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler.mock.calls[0]?.[0]?.message).toBe('sync explosion');
  });

  it('still awaits asynchronous middleware and routes rejections to handleError', async () => {
    const app = createApp();
    const errorHandler = vi.fn();
    app.setErrorHandler(errorHandler);
    app.use(async () => {
      await new Promise((r) => setTimeout(r, 10));
      throw new Error('async explosion');
    });
    await app.ready();

    const cb = app.callback();
    const ctx = {
      status: 200,
      responded: false,
      headers: {},
      state: {},
      params: {},
    } as never;

    const res = cb(ctx);
    expect(res).not.toBe(RESOLVED_PROMISE);
    await res;
    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler.mock.calls[0]?.[0]?.message).toBe('async explosion');
  });
});
