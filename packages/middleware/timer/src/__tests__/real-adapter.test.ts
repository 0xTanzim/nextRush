/**
 * @nextrush/timer - behaviour through real adapters
 *
 * The timer always records the duration in `ctx.state`; the response header is
 * opt-in through `exposeHeader`. The header is written after `ctx.next()`
 * resolves, and every shipped adapter now flushes the recorded response after
 * the middleware chain unwinds (RFC-041), so the header lands on both families.
 * These tests pin that against a real Node listener and a real Web request
 * instead of trusting a mock context.
 */
import { createFetchHandler } from '@nextrush/adapter-edge';
import { listen } from '@nextrush/adapter-node';
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import type { Context, Middleware } from '@nextrush/types';
import { afterEach, describe, expect, it } from 'vitest';
import { serverTiming, timer } from '../index';

const ROUTE = '/';
const RESPONSE_TIME_HEADER = 'x-response-time';
const SERVER_TIMING_HEADER = 'server-timing';
const RESPONSE_TIME_VALUE = /^\d+\.\d{2}ms$/;
const SERVER_TIMING_VALUE = /^total;dur=\d+\.\d{2}$/;

type TestApp = ReturnType<typeof createApp>;

interface Harness {
  request: (path: string) => Promise<Response>;
  close: () => Promise<void>;
}

interface Observed {
  responseTime?: unknown;
}

interface Chain {
  settled: Promise<void>;
  arrive: () => void;
}

/** Resolves once the middleware chain has unwound. */
function createChain(): Chain {
  let arrive!: () => void;
  const settled = new Promise<void>((resolve) => {
    arrive = resolve;
  });
  return { settled, arrive };
}

function buildApp(observed: Observed, middleware: Middleware[], chain: Chain): TestApp {
  const app = createApp();
  const router = createRouter();

  router.get(ROUTE, (ctx) => ctx.json({ ok: true }));

  app.use(async (ctx: Context, next: () => Promise<void>) => {
    try {
      await next();
    } finally {
      observed.responseTime = (ctx.state as Record<string, unknown> | undefined)?.responseTime;
      chain.arrive();
    }
  });
  for (const layer of middleware) {
    app.use(layer);
  }
  app.route('/', router);

  return app;
}

async function startNode(app: TestApp): Promise<Harness> {
  const server = await listen(app, 0);
  return {
    request: (path) => fetch(`http://127.0.0.1:${String(server.port)}${path}`),
    close: () => server.close(),
  };
}

function startWeb(app: TestApp): Harness {
  const handler = createFetchHandler(app);
  return {
    request: (path) => Promise.resolve(handler(new Request(`http://localhost${path}`))),
    close: () => Promise.resolve(),
  };
}

const ADAPTERS: ReadonlyArray<{
  name: string;
  start: (app: TestApp) => Harness | Promise<Harness>;
}> = [
  { name: 'node adapter', start: startNode },
  { name: 'web adapter', start: startWeb },
];

for (const adapter of ADAPTERS) {
  describe(`timer on the ${adapter.name}`, () => {
    let close: (() => Promise<void>) | undefined;

    afterEach(async () => {
      await close?.();
      close = undefined;
    });

    async function start(
      middleware: Middleware[],
      observed: Observed = {}
    ): Promise<{ harness: Harness; observed: Observed; chain: Chain }> {
      const chain = createChain();
      const harness = await adapter.start(buildApp(observed, middleware, chain));
      close = harness.close;
      return { harness, observed, chain };
    }

    it('records the duration without advertising a header unless asked', async () => {
      const { harness, observed, chain } = await start([timer(), serverTiming()]);

      const res = await harness.request(ROUTE);
      await chain.settled;

      expect(res.headers.get(RESPONSE_TIME_HEADER)).toBeNull();
      expect(res.headers.get(SERVER_TIMING_HEADER)).toBeNull();
      expect(typeof observed.responseTime).toBe('number');
    });

    it('writes the header on opt-in after the handler ran', async () => {
      const { harness, chain } = await start([
        timer({ exposeHeader: true }),
        serverTiming({ exposeHeader: true }),
      ]);

      const res = await harness.request(ROUTE);
      await chain.settled;

      expect(res.headers.get(RESPONSE_TIME_HEADER)).toMatch(RESPONSE_TIME_VALUE);
      expect(res.headers.get(SERVER_TIMING_HEADER)).toMatch(SERVER_TIMING_VALUE);
      await expect(res.json()).resolves.toEqual({ ok: true });
    });
  });
}
