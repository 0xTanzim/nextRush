/**
 * @nextrush/timer - behaviour through real adapters
 *
 * The timer always records the duration in `ctx.state`; the response header is
 * opt-in through `exposeHeader`. The header is written after `ctx.next()`
 * resolves, which only lands where the adapter has not committed the response
 * yet — so these tests pin the documented promise against what each adapter
 * family can actually do, instead of trusting a mock context.
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

/**
 * Resolves once the middleware chain has unwound. Both adapters can hand the
 * response to the client before the timer's `finally` block has run.
 */
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
      // A late header write can fail where the adapter has already committed the
      // response. The observation has to survive that, so the test measures the
      // documented contract rather than the failure mode.
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
  /** Whether a header written after the handler ran still reaches the client. */
  honorsPostHandlerHeader: boolean;
}> = [
  { name: 'node adapter', start: startNode, honorsPostHandlerHeader: false },
  { name: 'web adapter', start: startWeb, honorsPostHandlerHeader: true },
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

    it('writes the header on opt-in where the adapter still allows a late write', async () => {
      const { harness, chain } = await start([
        timer({ exposeHeader: true }),
        serverTiming({ exposeHeader: true }),
      ]);

      const res = await harness.request(ROUTE);
      await chain.settled;

      if (adapter.honorsPostHandlerHeader) {
        expect(res.headers.get(RESPONSE_TIME_HEADER)).toMatch(RESPONSE_TIME_VALUE);
        expect(res.headers.get(SERVER_TIMING_HEADER)).toMatch(SERVER_TIMING_VALUE);
      } else {
        // This adapter has written the response by the time the timer finishes
        // measuring, so the late write cannot land. The package README states
        // the limitation; this assertion is what keeps it honest.
        expect(res.headers.get(RESPONSE_TIME_HEADER)).toBeNull();
        expect(res.headers.get(SERVER_TIMING_HEADER)).toBeNull();
      }

      await expect(res.json()).resolves.toEqual({ ok: true });
    });
  });
}
