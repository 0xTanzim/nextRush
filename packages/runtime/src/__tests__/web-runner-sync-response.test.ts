/**
 * @nextrush/runtime — the Web runner's synchronous answer path.
 *
 * @remarks
 * Bun, Deno and edge runtimes all accept a handler that returns either a
 * `Response` or a `Promise<Response>`. Returning the `Response` directly avoids a
 * promise hop per request, which is measurable on Bun (~8 % of request CPU at
 * 64 connections). The runner may only do that when the dispatch proved it had
 * already finished, so these tests pin both the win and its guard.
 */

import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '@nextrush/types';
import { DISPATCH_SETTLED_SYNC } from '@nextrush/types';
import { createWebRunner, type WebRunnerApp, type WebRunnerContext } from '../web-runner';

class SyncContext {
  readonly method = 'GET' as const;
  readonly path = '/';
  status = 200;
  responded = false;
  body: unknown;
  timeoutTriggered = 0;

  triggerTimeout(): void {
    this.timeoutTriggered += 1;
  }

  json(data: unknown): void {
    this.body = data;
    this.responded = true;
  }

  getResponse(): Response {
    return new Response(JSON.stringify(this.body ?? null), {
      status: this.status,
      headers: { 'content-type': 'application/json' },
    });
  }
}

type TestCtx = WebRunnerContext & SyncContext;

const logger: Logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };

function makeApp(
  dispatch: (ctx: TestCtx) => Promise<void>,
  syncDispatchSafe: boolean
): WebRunnerApp<(ctx: TestCtx) => Promise<void>> & { syncDispatchSafe: boolean } {
  return {
    isReady: true,
    isProduction: true,
    logger,
    syncDispatchSafe,
    ready: () => Promise.resolve(),
    start: () => undefined,
    callback: () => async (ctx: TestCtx) => {
      await dispatch(ctx);
    },
  };
}

function runnerFor(app: WebRunnerApp<(ctx: TestCtx) => Promise<void>>, timeout = 30) {
  const ctx = new SyncContext() as unknown as TestCtx;
  const runner = createWebRunner<TestCtx, undefined>(app as never, {
    label: 'test',
    timeout,
    makeContext: () => ctx,
  });
  return { runner, ctx };
}

describe('Web runner — synchronous answer path', () => {
  it('returns the Response itself when the dispatch settled synchronously', () => {
    const app = makeApp(
      (ctx) => {
        ctx.json({ ok: true });
        (ctx as unknown as Record<symbol, boolean>)[DISPATCH_SETTLED_SYNC] = true;
        return Promise.resolve();
      },
      true
    );
    const { runner } = runnerFor(app);

    const result = runner(new Request('http://localhost/'), undefined);

    expect(result).toBeInstanceOf(Response);
    expect(typeof (result as Promise<Response>).then).toBe('undefined');
  });

  it('answers the not-found body on the synchronous path', () => {
    const app = makeApp(
      (ctx) => {
        ctx.status = 404;
        (ctx as unknown as Record<symbol, boolean>)[DISPATCH_SETTLED_SYNC] = true;
        return Promise.resolve();
      },
      true
    );
    const { runner } = runnerFor(app);

    const result = runner(new Request('http://localhost/'), undefined) as Response;

    expect(result.status).toBe(404);
  });

  it('returns a promise when the application is not synchronous-safe', async () => {
    const app = makeApp(
      (ctx) => {
        ctx.json({ ok: true });
        (ctx as unknown as Record<symbol, boolean>)[DISPATCH_SETTLED_SYNC] = true;
        return Promise.resolve();
      },
      false
    );
    const { runner } = runnerFor(app);

    const result = runner(new Request('http://localhost/'), undefined);

    expect(typeof (result as Promise<Response>).then).toBe('function');
    await expect(result).resolves.toBeInstanceOf(Response);
  });

  it('returns a promise when the dispatch did not settle synchronously', async () => {
    const app = makeApp(async (ctx) => {
      await Promise.resolve();
      ctx.json({ ok: true });
    }, true);
    const { runner } = runnerFor(app);

    const result = runner(new Request('http://localhost/'), undefined);

    expect(typeof (result as Promise<Response>).then).toBe('function');
    await expect(result).resolves.toBeInstanceOf(Response);
  });
});
