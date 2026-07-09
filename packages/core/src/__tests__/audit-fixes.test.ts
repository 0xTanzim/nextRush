/**
 * @nextrush/core - Audit Remediation Tests
 *
 * C-1 (unified error shape), C-2 (re-boot no double-mount),
 * C-4 (compose no process default), C-6 (setErrorHandler frozen after ready).
 */

import type { Context, Middleware, Router } from '@nextrush/types';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../application';
import { NotFoundError } from '../errors';
import { compose } from '../middleware';
import { createMockContext } from './_shared/create-mock-context';

// A tiny in-memory router double that records how many times routes() is mounted.
function fakeRouter(): Router & { routesCalls: number } {
  const r = {
    routesCalls: 0,
    routes(): Middleware {
      this.routesCalls++;
      return async (_ctx, next) => {
        if (next) await next();
      };
    },
    get() { return this as unknown as Router; },
    post() { return this as unknown as Router; },
    put() { return this as unknown as Router; },
    patch() { return this as unknown as Router; },
    delete() { return this as unknown as Router; },
    head() { return this as unknown as Router; },
    all() { return this as unknown as Router; },
  };
  return r as unknown as Router & { routesCalls: number };
}

// ---------------------------------------------------------------------------
// C-1 — one error response shape, delegated to @nextrush/errors serialization
// ---------------------------------------------------------------------------

describe('C-1: default error handler emits the @nextrush/errors shape', () => {
  it('serializes a NextRushError via its toJSON (code + status + message)', async () => {
    const app = createApp();
    app.use(() => {
      throw new NotFoundError('User not found');
    });
    const ctx = createMockContext();
    await app.callback()(ctx);

    expect(ctx.status).toBe(404);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'NotFoundError',
        message: 'User not found',
        code: 'NOT_FOUND',
        status: 404,
      })
    );
  });

  it('emits a coded 500 shape for a plain Error (not just { error })', async () => {
    const app = createApp();
    app.use(() => {
      throw new Error('boom');
    });
    const ctx = createMockContext();
    await app.callback()(ctx);

    expect(ctx.status).toBe(500);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal Server Error', code: 'INTERNAL_ERROR', status: 500 })
    );
  });
});

// ---------------------------------------------------------------------------
// C-2 — close() undoes the router mount so a re-boot does not double-mount
// ---------------------------------------------------------------------------

describe('C-2: re-boot does not double-mount the router', () => {
  it('keeps a stable middleware count across close()/ready() cycles', async () => {
    const router = fakeRouter();
    const app = createApp({ router });
    app.use(async (_ctx: Context, next) => {
      if (next) await next();
    });

    await app.ready();
    const countAfterFirstReady = app.middlewareCount;

    await app.close();
    await app.ready();

    expect(app.middlewareCount).toBe(countAfterFirstReady);
  });
});

// ---------------------------------------------------------------------------
// C-6 — setErrorHandler is frozen after ready()
// ---------------------------------------------------------------------------

describe('C-6: setErrorHandler is frozen after ready()', () => {
  it('throws when called after ready()', async () => {
    const app = createApp();
    await app.ready();
    expect(() => app.setErrorHandler(() => {})).toThrow(/frozen/);
  });
});

// ---------------------------------------------------------------------------
// C-4 — compose does not warn by default (no process.env read)
// ---------------------------------------------------------------------------

describe('C-4: compose double-response warning is opt-in (no process default)', () => {
  it('does not warn by default even when a response was already committed', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = createMockContext();
    const mw: Middleware[] = [
      async (c, next) => {
        (c as { responded: boolean }).responded = true;
        if (next) await next();
      },
      async () => {},
    ];
    await compose(mw)(ctx); // no options → must be silent
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
