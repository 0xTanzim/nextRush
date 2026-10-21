/**
 * @nextrush/runtime — the shared Web runner, in isolation.
 *
 * @remarks
 * The adapters' suites drive this through their own handlers, but they consume the
 * package's built `dist`, so those runs never appear in this package's coverage and
 * a change here can regress the adapters without a failing test in this repository
 * location. These tests exercise the runner directly against a fake application and
 * a fake context, one behaviour per case.
 */

import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '@nextrush/types';
import { createWebRunner, SETTLE_TURNS, type WebRunnerContext } from '../web-runner';
import type { WebRunnerApp } from '../web-runner';
import { WebResponseBuilder } from '../response-builder';

/** A context that records what the runner asked of it. */
class FakeContext {
  readonly method = 'GET' as const;
  readonly path = '/';
  status = 200;
  responded = false;
  timeoutTriggered = 0;
  body: unknown;
  headers: Record<string, string> = {};

  markResponded(): void {
    this.responded = true;
  }

  triggerTimeout(): void {
    this.timeoutTriggered += 1;
  }

  set(field: string, value: string | number | string[]): void {
    this.headers[field.toLowerCase()] = Array.isArray(value) ? value.join(',') : String(value);
  }

  json(data: unknown): void {
    this.body = data;
    this.responded = true;
  }

  getResponse(): Response {
    return new Response(JSON.stringify(this.body ?? null), {
      status: this.status,
      headers: this.headers,
    });
  }
}

/** A structural application: only what the runner needs, with call counters. */
class FakeApp implements WebRunnerApp<(ctx: TestCtx) => Promise<void>> {
  isReady = false;
  isProduction = true;
  startCount = 0;
  readyCount = 0;
  dispatched = 0;
  logger: Logger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };

  constructor(private readonly dispatch: (ctx: TestCtx) => Promise<void>) {}

  ready(): Promise<unknown> {
    this.readyCount += 1;
    this.isReady = true;
    return Promise.resolve();
  }

  callback(): (ctx: TestCtx) => Promise<void> {
    return async (ctx: TestCtx) => {
      this.dispatched += 1;
      await this.dispatch(ctx);
    };
  }

  start(): void {
    this.startCount += 1;
  }
}

/**
 * A context backed by the real response builder, so a runner test observes the
 * actual materialisation instead of a fake's shortcut.
 */
class BuilderContext {
  readonly method = 'GET' as const;
  readonly path = '/';
  status = 200;
  body: unknown;
  private readonly builder = new WebResponseBuilder('GET');

  get responded(): boolean {
    return this.builder.responded;
  }

  markResponded(): void {
    this.builder.markResponded();
  }

  triggerTimeout(): void {}

  set(field: string, value: string | number | string[]): void {
    this.builder.set(field, value);
  }

  json(data: unknown): void {
    this.builder.json(data, this.status);
  }

  getResponse(): Response {
    return this.builder.getResponse(this.status);
  }
}

type TestCtx = WebRunnerContext & FakeContext;

function makeContext(): TestCtx {
  return new FakeContext() as unknown as TestCtx;
}

function makeBuilderContext(): TestCtx {
  return new BuilderContext() as unknown as TestCtx;
}

function runnerFor(
  app: FakeApp,
  overrides: Partial<Parameters<typeof createWebRunner<TestCtx, undefined>>[1]> = {}
) {
  return createWebRunner<TestCtx, undefined>(app as never, {
    label: 'test',
    timeout: 30,
    makeContext: () => makeContext(),
    ...overrides,
  });
}

describe('SETTLE_TURNS', () => {
  it('is the one shared settle-turn bound', () => {
    expect(SETTLE_TURNS).toBe(4);
  });
});

describe('createWebRunner', () => {
  it('boots once behind the first request and reuses the handler afterwards', async () => {
    const app = new FakeApp(async (ctx) => ctx.json({ ok: true }));
    const run = runnerFor(app);

    const first = await run(new Request('http://localhost/'), undefined);
    const second = await run(new Request('http://localhost/'), undefined);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(app.readyCount).toBe(1);
    expect(app.dispatched).toBe(2);
  });

  it('marks the application running only when asked to', async () => {
    const marked = new FakeApp(async (ctx) => ctx.json({ ok: true }));
    await runnerFor(marked, { markRunning: true })(new Request('http://localhost/'), undefined);
    expect(marked.startCount).toBe(1);

    const plain = new FakeApp(async (ctx) => ctx.json({ ok: true }));
    await runnerFor(plain)(new Request('http://localhost/'), undefined);
    expect(plain.startCount).toBe(0);
  });

  it('carries a header a middleware writes after the handler committed the response', async () => {
    // A middleware wraps a handler: the handler commits, then the middleware's
    // post-`next()` work writes a header. The materialised Response must carry
    // it — this is the behaviour the recorded model exists to guarantee on every
    // adapter, and the Web family must keep it.
    const app = new FakeApp(async (ctx) => {
      const handler = async (): Promise<void> => {
        ctx.json({ ok: true });
      };
      await handler();
      ctx.set('x-late', 'after-handler');
    });

    const run = createWebRunner<TestCtx, undefined>(app as never, {
      label: 'test',
      timeout: 30,
      makeContext: makeBuilderContext,
    });

    const response = await run(new Request('http://localhost/'), undefined);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-late')).toBe('after-handler');
    expect(await response.json()).toEqual({ ok: true });
  });

  it('writes the not-found body through the context, preserving headers it already set', async () => {
    const app = new FakeApp(async (ctx) => {
      ctx.set('x-kept', 'yes');
      ctx.status = 404;
    });

    const response = await runnerFor(app)(new Request('http://localhost/missing'), undefined);

    expect(response.status).toBe(404);
    expect(response.headers.get('x-kept')).toBe('yes');
    expect(await response.json()).toEqual({ error: 'Not Found' });
  });

  it('answers a thrown error with 500 and logs it, without leaking the message', async () => {
    const app = new FakeApp(async () => {
      throw new Error('internal detail');
    });

    const response = await runnerFor(app)(new Request('http://localhost/'), undefined);
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toContain('internal detail');
    expect(app.logger.error).toHaveBeenCalled();
  });

  it('uses the caller-supplied error response when one is given', async () => {
    const app = new FakeApp(async () => {
      throw new Error('boom');
    });
    const onError = vi.fn(() => new Response('custom', { status: 503 }));

    const response = await runnerFor(app, { onError })(new Request('http://localhost/'), undefined);

    expect(response.status).toBe(503);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('arms no timeout timer for a handler that settles immediately', async () => {
    const app = new FakeApp(async (ctx) => ctx.json({ ok: true }));
    const realSetTimeout = globalThis.setTimeout;
    let armed = 0;
    globalThis.setTimeout = ((...args: Parameters<typeof setTimeout>) => {
      armed += 1;
      return realSetTimeout(...args);
    }) as typeof setTimeout;

    try {
      await runnerFor(app)(new Request('http://localhost/'), undefined);
    } finally {
      globalThis.setTimeout = realSetTimeout;
    }

    expect(armed).toBe(0);
  });

  it('waits for a handler that settles after its microtask window but within the timeout', async () => {
    const app = new FakeApp(async (ctx) => {
      await new Promise((resolve) => setTimeout(resolve, 2));
      ctx.json({ ok: true });
    });

    const response = await runnerFor(app, { timeout: 50 })(new Request('http://localhost/'), undefined);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('answers 504, cancels the context, and names the timeout where a source is declared', async () => {
    const app = new FakeApp(
      () => new Promise<void>(() => undefined) // never settles
    );

    let ctx: TestCtx | undefined;
    const run = createWebRunner<TestCtx, undefined>(app as never, {
      label: 'test',
      timeout: 5,
      timeoutWarningSource: 'default',
      makeContext: () => (ctx = makeContext()),
    });

    const response = await run(new Request('http://localhost/slow'), undefined);

    expect(response.status).toBe(504);
    expect(ctx?.timeoutTriggered).toBe(1);
    expect(app.logger.warn).toHaveBeenCalledWith(expect.stringContaining('after 5ms (default)'));
  });

  it('delivers a response the handler committed before the timeout fired, instead of a 504', async () => {
    const app = new FakeApp(async (ctx) => {
      // Commit after a microtask, so the runner's synchronous "already settled"
      // check does not apply and a timer really is armed for this request.
      await Promise.resolve();
      ctx.json({ ok: true });
      // Outlives the 5ms timeout: the response is already committed when the
      // timer fires, so the 504 must not replace it.
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    let ctx: TestCtx | undefined;
    const run = createWebRunner<TestCtx, undefined>(app as never, {
      label: 'test',
      timeout: 5,
      makeContext: () => (ctx = makeContext()),
    });

    const response = await run(new Request('http://localhost/slow'), undefined);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    // A timer was armed, and firing it cancelled the still-running handler.
    expect(ctx?.timeoutTriggered).toBe(1);
  });

  it('cuts off a handler that committed its response and then outlived the timeout', async () => {
    // Commitment is not settlement. The response is already produced, so the
    // committed body is delivered instead of a 504 — but the wait is bounded by
    // the deadline, and the still-running handler is cancelled cooperatively.
    // Awaiting this chain without a bound would hold the connection open for as
    // long as the handler runs (or forever, if it never settles).
    const app = new FakeApp(async (ctx) => {
      ctx.json({ ok: true });
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    let ctx: TestCtx | undefined;
    const run = createWebRunner<TestCtx, undefined>(app as never, {
      label: 'test',
      timeout: 5,
      makeContext: () => (ctx = makeContext()),
    });

    const started = Date.now();
    const response = await run(new Request('http://localhost/'), undefined);
    const elapsed = Date.now() - started;

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    // Delivered at the deadline, not when the handler finally finished.
    expect(elapsed).toBeLessThan(100);
    expect(ctx?.timeoutTriggered).toBe(1);
  });

  it('arms a deadline when the handler has not settled', async () => {
    const app = new FakeApp(() => new Promise<void>(() => undefined));
    const realSetTimeout = globalThis.setTimeout;
    let armed = 0;
    globalThis.setTimeout = ((...args: Parameters<typeof setTimeout>) => {
      armed += 1;
      return realSetTimeout(...args);
    }) as typeof setTimeout;

    let response: Response | undefined;
    try {
      response = await runnerFor(app, { timeout: 5 })(new Request('http://localhost/'), undefined);
    } finally {
      globalThis.setTimeout = realSetTimeout;
    }

    expect(response?.status).toBe(504);
    // The deadline is served by the runner's shared scheduler, so the count is
    // not one-per-request: a platform that fires its timer a fraction early
    // makes the scheduler re-arm for the remaining time.
    expect(armed).toBeGreaterThanOrEqual(1);
  });

  it('does not race at all when the timeout is disabled', async () => {
    const app = new FakeApp(async (ctx) => ctx.json({ ok: true }));
    const realSetTimeout = globalThis.setTimeout;
    let armed = 0;
    globalThis.setTimeout = ((...args: Parameters<typeof setTimeout>) => {
      armed += 1;
      return realSetTimeout(...args);
    }) as typeof setTimeout;

    try {
      const response = await runnerFor(app, { timeout: 0 })(new Request('http://localhost/'), undefined);
      expect(response.status).toBe(200);
    } finally {
      globalThis.setTimeout = realSetTimeout;
    }

    expect(armed).toBe(0);
  });
});
