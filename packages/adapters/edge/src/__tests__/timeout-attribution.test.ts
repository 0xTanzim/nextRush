/**
 * P1-3b (report/dx-review-serverless-edge-adapters.md): when the framework's
 * own timeout fires (a 504), the error log should name the effective timeout
 * value AND its source (an explicit `options.timeout` vs. the
 * `DEFAULT_EDGE_TIMEOUT_MS` fallback) — today a 504 gives no indication of
 * which timeout fired or why, forcing a developer to go read the adapter's
 * source to find out.
 */

import { createApp } from '@nextrush/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFetchHandler, DEFAULT_EDGE_TIMEOUT_MS } from '../adapter';

function neverSettlingApp(): ReturnType<typeof createApp> {
  const app = createApp();
  app.use(async (ctx) => {
    await new Promise<void>((resolve) => {
      ctx.signal.addEventListener('abort', () => resolve());
    });
  });
  return app;
}

describe('timeout attribution on the 504 path (P1-3b)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('logs the effective value and "default" as the source when no explicit timeout was passed', async () => {
    const app = neverSettlingApp();
    const warnSpy = vi.spyOn(app.logger, 'warn').mockImplementation(() => undefined);
    const handler = createFetchHandler(app, {}); // no explicit timeout -> DEFAULT_EDGE_TIMEOUT_MS

    const resPromise = handler(new Request('http://localhost/'));
    await vi.advanceTimersByTimeAsync(DEFAULT_EDGE_TIMEOUT_MS);
    const res = await resPromise;

    expect(res.status).toBe(504);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = warnSpy.mock.calls[0]?.[0] as string;
    expect(message).toMatch(/\[nextrush\/edge\]/);
    expect(message).toMatch(new RegExp(`${DEFAULT_EDGE_TIMEOUT_MS}ms`));
    expect(message).toMatch(/default/i);
    warnSpy.mockRestore();
  });

  it('logs the effective value and "explicit options.timeout" as the source when a timeout is passed', async () => {
    const app = neverSettlingApp();
    const warnSpy = vi.spyOn(app.logger, 'warn').mockImplementation(() => undefined);
    const handler = createFetchHandler(app, { timeout: 12 });

    const resPromise = handler(new Request('http://localhost/'));
    await vi.advanceTimersByTimeAsync(12);
    const res = await resPromise;

    expect(res.status).toBe(504);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = warnSpy.mock.calls[0]?.[0] as string;
    expect(message).toMatch(/\[nextrush\/edge\]/);
    expect(message).toMatch(/12ms/);
    expect(message).toMatch(/explicit/i);
    warnSpy.mockRestore();
  });

  it('does not log a timeout warning when the handler completes before the timeout', async () => {
    const app = createApp();
    app.use((ctx) => ctx.json({ ok: true }));
    const warnSpy = vi.spyOn(app.logger, 'warn').mockImplementation(() => undefined);
    const handler = createFetchHandler(app, { timeout: 5000 });

    await handler(new Request('http://localhost/'));

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
