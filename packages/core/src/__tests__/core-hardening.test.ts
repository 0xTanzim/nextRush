/**
 * @nextrush/core - Hardening Tests (deep re-audit)
 *
 * H-1: ready() must be safe under concurrent calls (not just sequential).
 * H-2: a throwing default error path must settle the request, not reject it.
 * H-3: close() must be safe under concurrent calls.
 */

import type { Context, ExtensionContext } from '@nextrush/types';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../application';
import { createMockContext } from './_shared/create-mock-context';

// ---------------------------------------------------------------------------
// H-1 — concurrent ready() must run setup() exactly once
// ---------------------------------------------------------------------------

describe('H-1: ready() is safe under concurrent calls', () => {
  it('runs each extension setup() exactly once even when awaited concurrently', async () => {
    const app = createApp();
    const setup = vi.fn((ctx: ExtensionContext) => {
      // Decorating twice throws — so a double setup() surfaces as a rejection.
      ctx.decorate('svc', { ok: true });
    });
    app.extend({ name: 'svc-ext', setup });

    await Promise.all([app.ready(), app.ready(), app.ready()]);

    expect(setup).toHaveBeenCalledTimes(1);
    expect(app.isReady).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// H-2 — a failing default error handler must not reject the request
// ---------------------------------------------------------------------------

describe('H-2: request settles even if the default error handler throws', () => {
  it('logs and swallows when ctx.json throws (e.g. response already committed)', async () => {
    const errorSpy = vi.fn();
    const app = createApp({
      logger: { info: vi.fn(), warn: vi.fn(), error: errorSpy, debug: vi.fn() },
    });
    app.use(() => {
      throw new Error('handler boom');
    });

    const ctx = createMockContext({
      json: vi.fn(() => {
        throw new Error('headers already sent');
      }) as unknown as Context['json'],
    });

    await expect(app.callback()(ctx)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// H-3 — concurrent close() must destroy each extension once
// ---------------------------------------------------------------------------

describe('H-3: close() is safe under concurrent calls', () => {
  it('destroys each extension exactly once when closed concurrently', async () => {
    const app = createApp();
    const destroy = vi.fn().mockResolvedValue(undefined);
    app.extend({ name: 'res', setup: () => {}, destroy });

    await app.ready();
    await Promise.all([app.close(), app.close(), app.close()]);

    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
