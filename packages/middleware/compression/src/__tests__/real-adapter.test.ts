/**
 * @nextrush/compression - behaviour through real adapters
 *
 * `compression.test.ts` drives the middleware against a mock context that hands
 * it a buffered outgoing body. No shipped adapter offers that shape: the Node
 * adapter ends the response inside the handler and writes its headers outside
 * Node's own header store, and the Web adapters record the response privately
 * and materialise it afterwards. These tests pin what the middleware actually
 * does against a real Node listener and a real Web request, so the mock cannot
 * hide the difference.
 *
 * Both adapters flush the response before the middleware chain unwinds, so every
 * assertion about post-handler work waits on the chain instead of racing it.
 */
import { createFetchHandler } from '@nextrush/adapter-edge';
import { listen } from '@nextrush/adapter-node';
import { bodyParser } from '@nextrush/body-parser';
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { compression } from '../middleware.js';
import { resetNoOutgoingBodyWarning } from '../warnings.js';

const BIG_ROUTE = '/big';
const ECHO_ROUTE = '/echo';
const PAYLOAD_CHARS = 20_000;
const THRESHOLD_BYTES = 0;
const ACCEPT_GZIP = { 'accept-encoding': 'gzip' };
const JSON_HEADERS = { 'content-type': 'application/json' };
const PACKAGE_TAG = '@nextrush/compression';

type TestApp = ReturnType<typeof createApp>;

interface Harness {
  request: (path: string, init?: RequestInit) => Promise<Response>;
  close: () => Promise<void>;
}

interface Observed {
  requestBody?: unknown;
  compressionError?: unknown;
}

interface Chain {
  arrive: () => void;
  unwound: (count: number) => Promise<void>;
}

/**
 * Counts completed middleware chains so a test can wait for the post-handler
 * work instead of assuming it finished before the client saw the response.
 */
function createChain(): Chain {
  let arrivals = 0;
  const waiters: Array<{ count: number; resolve: () => void }> = [];

  return {
    arrive() {
      arrivals += 1;
      for (let index = waiters.length - 1; index >= 0; index -= 1) {
        const waiter = waiters[index];
        if (arrivals >= waiter.count) {
          waiters.splice(index, 1);
          waiter.resolve();
        }
      }
    },
    unwound(count) {
      if (arrivals >= count) return Promise.resolve();
      return new Promise<void>((resolve) => {
        waiters.push({ count, resolve });
      });
    },
  };
}

function bigPayload(): string {
  return 'x'.repeat(PAYLOAD_CHARS);
}

interface AppOptions {
  observed: Observed;
  chain: Chain;
  /**
   * Declares the response type before the handler runs. Some API middleware
   * (a security or CORS layer) does exactly this, and it is the only shape for
   * which the middleware can currently read a compressible response at all.
   */
  declareContentType?: boolean;
}

function buildApp({ observed, chain, declareContentType = false }: AppOptions): TestApp {
  const app = createApp();
  const router = createRouter();

  router.get(BIG_ROUTE, (ctx) => ctx.json({ data: bigPayload() }));
  router.post(ECHO_ROUTE, (ctx) => ctx.json({ received: ctx.body }));

  app.use(async (ctx, next) => {
    if (declareContentType) {
      ctx.set('Content-Type', JSON_HEADERS['content-type']);
    }
    await next();
    observed.requestBody = ctx.body;
    observed.compressionError = ctx.state?.compressionError;
    chain.arrive();
  });
  app.use(bodyParser());
  app.use(compression({ threshold: THRESHOLD_BYTES }));
  app.route('/', router);

  return app;
}

async function startNode(app: TestApp): Promise<Harness> {
  const server = await listen(app, 0);
  return {
    request: (path, init) => fetch(`http://127.0.0.1:${String(server.port)}${path}`, init),
    close: () => server.close(),
  };
}

function startWeb(app: TestApp): Harness {
  const handler = createFetchHandler(app);
  return {
    request: (path, init) => Promise.resolve(handler(new Request(`http://localhost${path}`, init))),
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
  describe(`compression on the ${adapter.name}`, () => {
    let warnSpy: MockInstance;
    let close: (() => Promise<void>) | undefined;

    beforeEach(() => {
      resetNoOutgoingBodyWarning();
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(async () => {
      await close?.();
      close = undefined;
      warnSpy.mockRestore();
    });

    function packageWarnings(): string[] {
      return warnSpy.mock.calls
        .map((call) => String(call[0]))
        .filter((message) => message.includes(PACKAGE_TAG));
    }

    async function start(options: Partial<AppOptions> = {}): Promise<{
      observed: Observed;
      chain: Chain;
      harness: Harness;
    }> {
      const observed: Observed = {};
      const chain = createChain();
      const harness = await adapter.start(buildApp({ observed, chain, ...options }));
      close = harness.close;
      return { observed, chain, harness };
    }

    it('leaves a response it cannot see unencoded, and reports that once per process', async () => {
      const { chain, harness } = await start();

      const first = await harness.request(BIG_ROUTE, { headers: ACCEPT_GZIP });
      const second = await harness.request(BIG_ROUTE, { headers: ACCEPT_GZIP });
      await chain.unwound(2);

      expect(first.headers.get('content-encoding')).toBeNull();
      expect(second.headers.get('content-encoding')).toBeNull();
      await expect(first.json()).resolves.toEqual({ data: bigPayload() });
      await expect(second.json()).resolves.toEqual({ data: bigPayload() });

      expect(packageWarnings()).toHaveLength(1);
    });

    it('never transforms the body of a request that carries one', async () => {
      const { observed, chain, harness } = await start({ declareContentType: true });
      const sent = { data: bigPayload() };

      const res = await harness.request(ECHO_ROUTE, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(sent),
      });
      await chain.unwound(1);

      expect(res.headers.get('content-encoding')).toBeNull();
      await expect(res.json()).resolves.toEqual({ received: sent });
      expect(observed.requestBody).toEqual(sent);
      expect(observed.compressionError).toBeUndefined();
      expect(packageWarnings()).toHaveLength(1);
    });
  });
}
