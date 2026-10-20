/**
 * @nextrush/runtime — the Web runner's timeout contract.
 *
 * @remarks
 * These cases pin what the runner promises around deadlines, separately from the
 * general runner behaviour in `web-runner.test.ts`. The distinction that matters
 * here is between a *committed response* and a *settled dispatch*: a handler can
 * publish a response and then keep running, and the runner must not treat those
 * two facts as the same thing.
 *
 * Self-contained fixtures: importing the other suite would register its cases a
 * second time.
 */

import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '@nextrush/types';
import { createWebRunner } from '../web-runner';
import type { WebRunnerApp, WebRunnerContext } from '../web-runner';
import { WebResponseBuilder } from '../response-builder';

class ContractContext {
  readonly method = 'POST' as const;
  readonly path = '/';
  status = 200;
  timeoutTriggered = 0;
  body: unknown;
  private readonly builder = new WebResponseBuilder('POST');

  get responded(): boolean {
    return this.builder.responded;
  }

  triggerTimeout(): void {
    this.timeoutTriggered += 1;
  }

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

type Ctx = WebRunnerContext & ContractContext;

class ContractApp implements WebRunnerApp<(ctx: Ctx) => Promise<void>> {
  isReady = false;
  isProduction = true;
  logger: Logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };

  constructor(private readonly dispatch: (ctx: Ctx) => Promise<void>) {}

  ready(): Promise<unknown> {
    this.isReady = true;
    return Promise.resolve();
  }

  callback(): (ctx: Ctx) => Promise<void> {
    return (ctx: Ctx) => this.dispatch(ctx);
  }

  start(): void {}
}

/** A never-settling promise, typed so the test reads as intent rather than a cast. */
function never(): Promise<void> {
  return new Promise<void>(() => undefined);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function runWith(
  dispatch: (ctx: Ctx) => Promise<void>,
  timeout: number
): { run: () => Promise<Response>; contexts: Ctx[] } {
  const contexts: Ctx[] = [];
  const run = createWebRunner<Ctx, undefined>(new ContractApp(dispatch) as never, {
    label: 'test',
    timeout,
    makeContext: () => {
      const ctx = new ContractContext() as unknown as Ctx;
      contexts.push(ctx);
      return ctx;
    },
  });
  return { run: () => run(new Request('http://localhost/slow', { method: 'POST' }), undefined), contexts };
}

/**
 * `Promise.race` against a wall-clock guard so a regression fails the assertion
 * instead of hanging the suite.
 */
async function within<T>(promise: Promise<T>, ms: number, label: string): Promise<T | string> {
  return Promise.race([promise, delay(ms).then(() => label)]);
}

describe('timeout contract — committed response vs settled dispatch', () => {
  it('answers a committed response whose dispatch never settles, at the deadline', async () => {
    // The handler publishes its response, then blocks forever. Commitment is not
    // settlement: without a bound, this request would hold the connection open
    // for the lifetime of the server.
    const { run, contexts } = runWith(async (ctx) => {
      ctx.json({ ok: true });
      await never();
    }, 5);

    const settled = await within(run(), 200, 'HUNG');

    expect(settled).not.toBe('HUNG');
    const response = settled as Response;
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    // The deadline still cancelled the handler cooperatively.
    expect(contexts[0]?.timeoutTriggered).toBe(1);
  });

  it('still delivers a committed response that lands after the deadline', async () => {
    const { run, contexts } = runWith(async (ctx) => {
      await Promise.resolve();
      ctx.json({ ok: true });
      await never();
    }, 5);

    const settled = await within(run(), 200, 'HUNG');

    expect(settled).not.toBe('HUNG');
    const response = settled as Response;
    expect(response.status).toBe(200);
    expect(contexts[0]?.timeoutTriggered).toBe(1);
  });

  it('keeps a header written after commit when it arrives before the deadline', async () => {
    const { run } = runWith(async (ctx) => {
      ctx.json({ ok: true });
      ctx.set('x-late', 'before-deadline');
      await delay(2);
    }, 50);

    const response = await run();

    expect(response.status).toBe(200);
    expect(response.headers.get('x-late')).toBe('before-deadline');
  });

  it('answers 504 and cancels the context when nothing was committed', async () => {
    const { run, contexts } = runWith(() => never(), 5);

    const response = await run();

    expect(response.status).toBe(504);
    expect(contexts[0]?.timeoutTriggered).toBe(1);
  });

  it('propagates a synchronous rejection as a 500', async () => {
    const { run } = runWith(() => {
      throw new Error('sync boom');
    }, 50);

    const response = await run();

    expect(response.status).toBe(500);
  });

  it('propagates an asynchronous rejection as a 500', async () => {
    const { run } = runWith(async () => {
      await Promise.resolve();
      throw new Error('async boom');
    }, 50);

    const response = await run();

    expect(response.status).toBe(500);
  });

  it('answers 504, not 500, when the handler rejects only after the deadline', async () => {
    // The deadline already decided the response. A late rejection must not
    // replace it, and must not surface as an unhandled rejection.
    const { run, contexts } = runWith(async () => {
      await delay(30);
      throw new Error('late boom');
    }, 5);

    const response = await run();
    await delay(40);

    expect(response.status).toBe(504);
    expect(contexts[0]?.timeoutTriggered).toBe(1);
  });

  it('does not race at all when the timeout is disabled', async () => {
    // `timeout: 0` means "no deadline": a handler that never settles keeps the
    // request open. This case pins that the disabled mode really is disabled.
    const { run, contexts } = runWith(async (ctx) => {
      ctx.json({ ok: true });
      await never();
    }, 0);

    const settled = await within(run(), 60, 'NO-DEADLINE');

    expect(settled).toBe('NO-DEADLINE');
    expect(contexts[0]?.timeoutTriggered).toBe(0);
  });

  it('arms no timer for a dispatch that settles inside the turn window', async () => {
    const { run } = runWith(async (ctx) => {
      ctx.json({ ok: true });
    }, 5);

    const realSetTimeout = globalThis.setTimeout;
    let armed = 0;
    globalThis.setTimeout = ((...args: Parameters<typeof setTimeout>) => {
      armed += 1;
      return realSetTimeout(...args);
    }) as typeof setTimeout;

    try {
      const response = await run();
      expect(response.status).toBe(200);
    } finally {
      globalThis.setTimeout = realSetTimeout;
    }

    expect(armed).toBe(0);
  });
});
