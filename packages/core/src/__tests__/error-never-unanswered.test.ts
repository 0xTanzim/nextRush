/**
 * @nextrush/core - A request is never left unanswered
 *
 * The application error path is the first of three deliberately redundant
 * layers that guarantee a response. A custom error handler that completes
 * without writing one — because it returned early, or because its own write
 * threw — must not leave the request unanswered, which is what a Node socket
 * observes as a hang and a Web adapter observes as an empty response.
 */

import type { Context } from '@nextrush/types';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../application';
import { createMockContext } from './_shared/create-mock-context';

const silentLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

/**
 * A context whose write methods model the adapters' contract: producing a
 * response is what marks it responded. `createMockContext`'s bare `vi.fn()`
 * writes do not, which would make every handler look like it wrote nothing.
 */
function createRespondingContext(): Context {
  const ctx = createMockContext();
  const state = ctx as { responded: boolean };
  const respond = (): void => {
    state.responded = true;
  };

  ctx.json = vi.fn(respond);
  ctx.send = vi.fn(respond);
  ctx.html = vi.fn(respond);
  ctx.redirect = vi.fn(respond);

  return ctx;
}

function createFailingApp() {
  const app = createApp({ logger: silentLogger });
  app.use(async () => {
    throw new Error('handler boom');
  });
  return app;
}

describe('the application error path answers the client', () => {
  it('supplies the default 500 when a custom error handler writes nothing', async () => {
    const app = createFailingApp();
    app.setErrorHandler(() => {
      // Forgets to respond.
    });
    const ctx = createRespondingContext();

    await app.callback()(ctx);

    expect(ctx.responded).toBe(true);
    expect(ctx.status).toBe(500);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal Server Error', code: 'INTERNAL_ERROR', status: 500 })
    );
  });

  it('supplies the default 500 when the error handler throws instead of writing', async () => {
    const app = createFailingApp();
    app.setErrorHandler(() => {
      throw new Error('error handler boom');
    });
    const ctx = createRespondingContext();

    await app.callback()(ctx);

    expect(ctx.responded).toBe(true);
    expect(ctx.status).toBe(500);
  });

  it('leaves a responding custom error handler alone', async () => {
    const app = createFailingApp();
    const handler = vi.fn((_error: Error, ctx: Context) => {
      ctx.status = 418;
      ctx.json({ handler: 'custom' });
    });
    app.setErrorHandler(handler);
    const ctx = createRespondingContext();

    await app.callback()(ctx);

    expect(ctx.status).toBe(418);
    expect(ctx.json).toHaveBeenCalledTimes(1);
    expect(ctx.json).toHaveBeenCalledWith({ handler: 'custom' });
  });

  it('answers with the default 500 when no error handler is registered', async () => {
    const app = createFailingApp();
    const ctx = createRespondingContext();

    await app.callback()(ctx);

    expect(ctx.responded).toBe(true);
    expect(ctx.status).toBe(500);
  });
});
